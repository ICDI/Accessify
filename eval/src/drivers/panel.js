import { findTabByUrl } from '../lib/browser.js';
import { postJson } from '../lib/http.js';

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
 * Ollama nem soma tokens no run errado. Cada chamada fica presa ao runId em que entrou, e
 * end(runId) só fecha o portão e aborta as chamadas daquele run: um run abandonado pelo
 * watchdog que termine depois não mexe no run seguinte.
 */
export async function installProviderAdapter(context, condition, config) {
  let activeRunId = null;
  const callsByRun = new Map();
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
    const record = () => {
      if (!callsByRun.has(runId)) {
        callsByRun.set(runId, []);
      }
      callsByRun.get(runId).push(call);
    };
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
        record();
        await route.fulfill({ status: response.status, contentType: 'application/json', body: response.text }).catch(() => {});
      } catch (error) {
        call.latencyMs = Date.now() - startedAt;
        call.networkError = controller.signal.aborted ? 'abortada no fim do run' : error.message;
        record();
        await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { message: `Adaptador: ${call.networkError}` } }) }).catch(() => {});
      }
    })();

    pending.set(controller, { runId, handled });
    try {
      await handled;
    } finally {
      pending.delete(controller);
    }
  });

  return {
    begin(runId) {
      activeRunId = runId;
      callsByRun.set(runId, []);
    },
    /**
     * Fecha o portão (se ainda for deste run), aborta as chamadas deste run que ficaram
     * penduradas e espera elas serem registradas antes de devolver as do run.
     */
    async end(runId) {
      if (activeRunId === runId) {
        activeRunId = null;
      }
      const mine = [...pending.entries()].filter(([, entry]) => entry.runId === runId);
      mine.forEach(([controller]) => controller.abort());
      await Promise.allSettled(mine.map(([, entry]) => entry.handled));
      const calls = callsByRun.get(runId) || [];
      callsByRun.delete(runId);
      return { calls, aborted: mine.length };
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
 * o job antigo termina sozinho, sem somar tokens no run novo. onPanel recebe a aba do
 * painel, para o watchdog do run poder fechá-la.
 */
export async function runPanelDriver(context, extensionId, serviceWorker, page, config, { onReady = () => {}, onPanel = () => {} } = {}) {
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
  onPanel(panel);
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

    // O painel consulta o job a cada 1 s e então mostra os resultados com o botão Aplicar.
    // A aplicação é local (mensagens ao content script), sem LLM: tem prazo próprio
    await panel.waitForFunction(() => {
      const results = document.getElementById('results-section');
      return results && getComputedStyle(results).display !== 'none';
    }, null, { timeout: 15000 });
    await panel.click('#apply-optimizations-btn');
    await panel.waitForFunction(() => /\b(success|error)\b/.test(document.getElementById('report-status').className), null, { timeout: config.timeouts.applyMs });
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
