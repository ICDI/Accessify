import http from 'node:http';
import { findTabByUrl } from '../lib/browser.js';

/**
 * POST JSON ao Ollama por node:http. O fetch do Node desiste sozinho se os cabeçalhos
 * demoram mais de 300 s, e o Ollama sem streaming só responde quando termina de gerar:
 * as recomendações da v1.0.0 (max_tokens 32000, com raciocínio) passam disso. Aqui o
 * único prazo é o do estudo (timeouts.llmCallMs).
 */
function postJson(url, payload, { timeoutMs, signal }) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload));
    const request = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
      signal
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        clearTimeout(timer);
        resolve({ status: response.statusCode, text: Buffer.concat(chunks).toString('utf8') });
      });
      response.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const timer = setTimeout(() => request.destroy(new Error(`sem resposta do Ollama em ${timeoutMs} ms`)), timeoutMs);
    request.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.end(body);
  });
}

/**
 * Adaptador de provedor da v1.0.0 (decisão D1). A v1.0.0 só fala com o OpenRouter; uma
 * rota de contexto intercepta as chamadas do service worker dela (Playwright >= 1.57) e
 * as repassa ao Ollama local com o modelo e a temperatura da condição (D8). O resto do
 * corpo (prompt, max_tokens, response_format) segue como a v1.0.0 mandou, e nenhum campo
 * de raciocínio é acrescentado: o Ollama liga o raciocínio do qwen3 por padrão, como
 * aconteceria com a v1.0.0 sem adaptação. O código da v1.0.0 não muda.
 *
 * Portão por run: fora de um run ativo (begin/end), qualquer chamada é recusada na hora
 * e fica registrada à parte. Um job da v1.0.0 que sobreviveu ao run anterior não chega ao
 * Ollama nem soma tokens no run errado.
 */
export async function installProviderAdapter(context, condition, config) {
  let activeRunId = null;
  const calls = [];
  const strayCalls = [];
  const pending = new Map();

  await context.route('https://openrouter.ai/api/v1/**', async (route) => {
    const request = route.request();
    if (!request.url().endsWith('/chat/completions')) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"message":"rota não usada no estudo"}}' });
      return;
    }

    if (!activeRunId) {
      strayCalls.push({ at: new Date().toISOString(), url: request.url() });
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"message":"Adaptador: chamada fora de um run do estudo"}}' });
      return;
    }

    let body;
    try {
      body = JSON.parse(request.postData() || '{}');
    } catch (error) {
      await route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"message":"corpo inválido"}}' });
      return;
    }

    const originalModel = body.model;
    body.model = condition.model;
    if (Number.isFinite(condition.temperature)) {
      body.temperature = condition.temperature;
    }

    const runId = activeRunId;
    const startedAt = Date.now();
    const call = { runId, originalModel, model: body.model, temperature: body.temperature, maxTokens: body.max_tokens || null, reasoning: 'original' };
    const controller = new AbortController();

    const handled = (async () => {
      try {
        const response = await postJson(`${config.ollama.baseUrl}/v1/chat/completions`, body, {
          timeoutMs: config.timeouts.llmCallMs,
          signal: controller.signal
        });
        call.latencyMs = Date.now() - startedAt;
        call.httpStatus = response.status;
        try {
          const data = JSON.parse(response.text);
          const message = data.choices?.[0]?.message || {};
          call.tokensIn = data.usage?.prompt_tokens ?? null;
          call.tokensOut = data.usage?.completion_tokens ?? null;
          call.finishReason = data.choices?.[0]?.finish_reason || null;
          call.contentChars = typeof message.content === 'string' ? message.content.length : 0;
          call.reasoningChars = typeof message.reasoning === 'string' ? message.reasoning.length : 0;
        } catch (error) {
          call.parseError = error.message;
        }
        calls.push(call);
        await route.fulfill({ status: response.status, contentType: 'application/json', body: response.text }).catch(() => {});
      } catch (error) {
        call.latencyMs = Date.now() - startedAt;
        call.networkError = controller.signal.aborted ? 'abortada no fim do run' : error.message;
        calls.push(call);
        await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { message: `Adaptador: ${call.networkError}` } }) }).catch(() => {});
      }
    })();

    pending.set(controller, handled);
    try {
      await handled;
    } finally {
      pending.delete(controller);
    }
  });

  return {
    begin(runId) {
      activeRunId = runId;
      calls.length = 0;
    },
    /**
     * Fecha o portão, aborta o que ficou pendurado e espera essas chamadas serem
     * registradas antes de devolver as do run.
     */
    async end() {
      activeRunId = null;
      const aborted = pending.size;
      pending.forEach((handled, controller) => controller.abort());
      await Promise.allSettled([...pending.values()]);
      return { calls: calls.splice(0, calls.length), aborted };
    },
    takeStrayCalls: () => strayCalls.splice(0, strayCalls.length)
  };
}

async function getJob(serviceWorker, tabId) {
  // A v1.0.0 ignora o argumento (job global); a v1.1.0 usa o job da aba
  return serviceWorker.evaluate(async (id) => optimizer.getAnalysisJob(id), tabId);
}

/**
 * Driver do painel real (decisão D7): abre o popup.html numa aba, com chrome.tabs.query
 * "ativo" apontando para a aba do snapshot, e clica Analisar → Aplicar como um usuário.
 * O resultado da análise é decidido pelo job do service worker (runId novo, mesma aba),
 * não pela interface, que pode estar mostrando o estado de um run anterior.
 *
 * onReady abre o portão do adaptador só depois que o job anterior parou e foi zerado: a
 * v1.0.0 só confere o runId entre as etapas, então um laço de imagens de uma tentativa
 * anterior continua chamando o LLM. Com o portão fechado essas chamadas falham na hora e
 * o job antigo termina sozinho, sem somar tokens no run novo.
 */
export async function runPanelDriver(context, extensionId, serviceWorker, page, config, onReady = () => {}) {
  const tab = await findTabByUrl(serviceWorker, page.url());
  if (!tab) {
    return { status: 'falha', errors: [{ stage: 'harness', message: 'Aba do snapshot não encontrada pelo service worker.' }] };
  }

  // Job anterior ainda rodando (a v1.0.0 guarda um só) termina antes de zerar
  const waitStartedAt = Date.now();
  let staleJobRunning = false;
  while ((staleJobRunning = (await getJob(serviceWorker, tab.id))?.status === 'running') && Date.now() - waitStartedAt < 60000) {
    await page.waitForTimeout(500);
  }
  await serviceWorker.evaluate(async (id) => optimizer.resetAnalysisJob(id), tab.id);
  const previousRunId = (await getJob(serviceWorker, tab.id))?.runId || null;
  const staleJob = { waitMs: Date.now() - waitStartedAt, stillRunningAtReset: staleJobRunning };
  onReady();

  const panel = await context.newPage();
  try {
    await panel.addInitScript((target) => {
      const originalQuery = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (queryInfo, callback) => {
        const result = queryInfo && queryInfo.active ? Promise.resolve([target]) : originalQuery(queryInfo);
        if (typeof callback === 'function') {
          result.then(callback);
          return undefined;
        }
        return result;
      };
    }, tab);

    await panel.goto(`chrome-extension://${extensionId}/popup.html`);
    await panel.waitForSelector('#analyze-btn:not([disabled])', { state: 'visible', timeout: 20000 });
    await panel.click('#analyze-btn');

    const deadline = Date.now() + config.timeouts.panelMs;
    let job = null;
    while (Date.now() < deadline) {
      job = await getJob(serviceWorker, tab.id);
      if (job?.runId && job.runId !== previousRunId && job.targetTabId === tab.id && ['completed', 'error'].includes(job.status)) {
        break;
      }
      await panel.waitForTimeout(1000);
    }

    if (!job || job.runId === previousRunId || !['completed', 'error'].includes(job.status)) {
      return { status: 'falha', tabId: tab.id, staleJob, job, errors: [{ stage: 'tempo', message: `A análise não terminou em ${config.timeouts.panelMs} ms.` }] };
    }
    if (job.status === 'error') {
      return { status: 'falha', tabId: tab.id, staleJob, job, errors: [{ stage: 'analise', message: job.error || 'erro sem mensagem' }] };
    }

    // O painel consulta o job a cada 1 s e então mostra os resultados com o botão Aplicar
    await panel.waitForFunction(() => {
      const results = document.getElementById('results-section');
      return results && getComputedStyle(results).display !== 'none';
    }, null, { timeout: 15000 });
    await panel.click('#apply-optimizations-btn');
    await panel.waitForFunction(() => /\b(success|error)\b/.test(document.getElementById('report-status').className), null, { timeout: config.timeouts.panelMs });
    const report = await panel.evaluate(() => ({
      status: document.getElementById('report-status').className,
      summary: document.getElementById('report-summary').innerText
    }));

    const success = /\bsuccess\b/.test(report.status);
    return {
      status: success ? 'ok' : 'falha',
      tabId: tab.id, staleJob,
      appliedChanges: Number(report.summary.match(/(\d+) alterações/)?.[1] ?? 0),
      report,
      job,
      errors: success ? [] : [{ stage: 'aplicacao', message: report.summary }]
    };
  } catch (error) {
    return { status: 'falha', tabId: tab.id, staleJob, errors: [{ stage: 'painel', message: error.message.split('\n')[0] }] };
  } finally {
    await panel.close().catch(() => {});
  }
}
