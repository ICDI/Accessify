import { findTabByUrl } from '../lib/browser.js';

/**
 * Driver da v1.1.0: o gancho de automação (C11). A página dispara 'accessify:run' com a
 * configuração da condição e o resultado aparece em #accessify-result. O nó é lido e
 * removido antes de qualquer medição (é o único que o C11 acrescenta ao DOM).
 */
async function waitHookReady(page) {
  return page.evaluate(async () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const ready = await new Promise((resolve) => {
        const onReady = () => resolve(true);
        document.addEventListener('accessify:ready', onReady, { once: true });
        document.dispatchEvent(new CustomEvent('accessify:ping'));
        setTimeout(() => {
          document.removeEventListener('accessify:ready', onReady);
          resolve(false);
        }, 200);
      });
      if (ready) {
        return true;
      }
    }
    return false;
  });
}

const LATE_KEY = 'accessify-eval-late-result';

/**
 * Prazos (D8): a extensão encerra o run em timeoutMs e, se o service worker não
 * responder, o content script grava uma falha própria em timeoutMs + 60 s. O harness
 * espera timeoutMs + hookGraceMs (mais que esses 60 s), então sempre lê um resultado.
 * Quando o resultado é a falha do content script, o run da extensão pode ainda estar
 * aplicando: o driver espera o 'accessify:late-result' (hookLateMs) antes de devolver,
 * para nada mexer na página durante a medição, e marca a medição como não assentada se ele
 * não chegar. Sem runLog no resultado, o driver busca o do service worker pela aba.
 */
export async function runHookDriver(page, condition, config, runId, serviceWorker = null) {
  if (!(await waitHookReady(page))) {
    return { status: 'falha', errors: [{ stage: 'harness', message: 'O listener do gancho não respondeu em 10 s.' }] };
  }

  const hookConfig = {
    provider: 'local',
    model: condition.model,
    temperature: condition.temperature,
    reasoning: condition.reasoning || 'original',
    vision: condition.vision === true,
    apply: true,
    runId,
    timeoutMs: config.timeouts.hookMs
  };

  await page.evaluate(({ detail, key }) => {
    // Escuta o resultado tardio desde o disparo: ele pode chegar antes de o driver
    // perceber que a primeira resposta foi a falha do content script
    document.addEventListener('accessify:late-result', (event) => { window[Symbol.for(key)] = event.detail; }, { once: true });
    document.dispatchEvent(new CustomEvent('accessify:run', { detail }));
  }, { detail: JSON.stringify(hookConfig), key: LATE_KEY });

  let result;
  let noAnswer = false;
  try {
    await page.waitForSelector('#accessify-result', { state: 'attached', timeout: config.timeouts.hookMs + config.timeouts.hookGraceMs });
    result = await page.evaluate(() => {
      const node = document.getElementById('accessify-result');
      const parsed = JSON.parse(node.textContent);
      node.remove();
      return parsed;
    });
    // A falha que o content script grava quando o service worker não respondeu
    noAnswer = !result.runLog && (result.errors || []).some((error) => error.stage === 'tempo' && /Sem resposta da extensão/.test(error.message));
  } catch (error) {
    noAnswer = true;
    result = { status: 'falha', runId, errors: [{ stage: 'harness', message: `Sem #accessify-result em ${config.timeouts.hookMs + config.timeouts.hookGraceMs} ms.` }] };
  }

  if (noAnswer) {
    // Falha do content script (o service worker não respondeu): espera a resposta tardia
    const late = await page.waitForFunction((key) => window[Symbol.for(key)] || null, LATE_KEY, { timeout: config.timeouts.hookLateMs, polling: 500 })
      .then((handle) => handle.jsonValue())
      .catch(() => null);
    if (late) {
      const parsed = JSON.parse(late);
      result.lateResult = { status: parsed.status, appliedChanges: parsed.appliedChanges, errors: parsed.errors };
      result.runLog = parsed.runLog || null;
    } else {
      result.measurementUnsettled = true;
    }
    // O próprio content script remove o nó quando um run novo começa; aqui não haverá
    await page.evaluate(() => document.getElementById('accessify-result')?.remove()).catch(() => {});
  }

  if (!result.runLog && serviceWorker) {
    const tab = await findTabByUrl(serviceWorker, page.url()).catch(() => null);
    const runLog = tab ? await serviceWorker.evaluate(async (tabId) => optimizer.getRunLog(tabId), tab.id).catch(() => null) : null;
    if (runLog?.automation?.runId === runId) {
      result.runLog = runLog;
      result.runLogSource = 'service-worker';
    }
  }
  return result;
}
