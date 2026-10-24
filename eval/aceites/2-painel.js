// Aceite 2: smoke da interface na test-page com o build (painel real: popup.html numa aba,
// Analisar → Aplicar), sem LLM. Confere o relatório do painel, o runLog do C10 e que o
// gancho de automação fica desligado sem o opt-in (o uso manual não muda).
// Com --llm, roda também a fixture com imagem sem contexto no Ollama.
// Uso: node aceites/2-painel.js [--llm] [--modelo qwen3:8b] [--saida pasta]
import { runPanelDriver } from '../src/drivers/panel.js';
import { loadConfig, parseArgs } from '../src/lib/config.js';
import { NO_LLM_BASE_URL, OLLAMA_URL, buildCopy, createReport, launchExtension, ollamaAvailable, openTarget, serveFixtures, setLocalProvider, waitHookReady } from './lib.js';

const args = parseArgs();
const config = loadConfig();
const model = typeof args.modelo === 'string' ? args.modelo : 'qwen3:8b';
const { report, check, finish } = createReport('2-painel', args);

const RUN_LOG_FIELDS = ['runId', 'version', 'url', 'tabId', 'timestamp', 'provider', 'model', 'modelId', 'temperature', 'issuesFound',
  'deterministicFixes', 'aiFixes', 'fixRuleIssueTypes', 'rounds', 'roundsRun', 'altTexts', 'llmCalls', 'genericLabels',
  'remainingIssues', 'remainingByType', 'apply', 'applies', 'totals', 'errors'];

const fixtures = await serveFixtures();
const extension = buildCopy('aceite-painel');
report.extension = { gitDescribe: extension.gitDescribe, copySha256: extension.copySha256 };
const { context, serviceWorker, extensionId, webErrors, close } = await launchExtension(extension.dir, 'painel');

try {
  await setLocalProvider(serviceWorker, NO_LLM_BASE_URL, model);
  const url = fixtures.url('/test-page.html');
  const page = await openTarget(context, url);

  const panel = await runPanelDriver(context, extensionId, serviceWorker, page, config);
  report.panel = { status: panel.status, appliedChanges: panel.appliedChanges, report: panel.report, errors: panel.errors };
  check('painel: Analisar → Aplicar com sucesso, sem LLM', panel.status === 'ok', panel.report?.summary?.replace(/\n/g, ' | ') || JSON.stringify(panel.errors));
  check('painel: alterações aplicadas', panel.appliedChanges > 0, String(panel.appliedChanges));

  const runLog = await serviceWorker.evaluate(async (tabId) => optimizer.getRunLog(tabId), panel.tabId);
  report.runLog = runLog;
  const missing = RUN_LOG_FIELDS.filter((field) => !runLog || !(field in runLog));
  check('runLog (C10) com todos os campos', missing.length === 0, missing.join(', ') || 'completo');
  check('runLog sem erro de gravação', !!runLog && !runLog.storageError, runLog?.storageError || '');
  const sum = (items) => (items || []).reduce((total, item) => total + item.applied, 0);
  const deterministic = sum(runLog?.deterministicFixes);
  const ai = sum(runLog?.aiFixes);
  check('soma determinística + IA = appliedCount', deterministic + ai === runLog?.apply?.appliedCount, `${deterministic} + ${ai} vs ${runLog?.apply?.appliedCount}`);
  check('appliedCount do runLog = alterações do painel', runLog?.apply?.appliedCount === panel.appliedChanges, `${runLog?.apply?.appliedCount} vs ${panel.appliedChanges}`);
  check('sem erros de JavaScript nas páginas da extensão', webErrors.length === 0, webErrors.slice(0, 3).join(' | '));

  // O gancho desligado sem o opt-in, na mesma aba em que o content script acabou de
  // aplicar as correções (então ele está carregado); controle positivo: com o opt-in, uma
  // aba nova responde ao ping
  check('gancho desligado sem o opt-in (automationHookEnabled), com o content script carregado', panel.status === 'ok' && (await waitHookReady(page)) === false);
  await page.close();
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ automationHookEnabled: true }));
  const optInPage = await openTarget(context, `${url}?opt-in`);
  check('controle: com o opt-in, o gancho responde', (await waitHookReady(optInPage)) === true);
  await optInPage.close();
  await serviceWorker.evaluate(async () => chrome.storage.local.remove('automationHookEnabled'));

  if (args.llm) {
    if (!(await ollamaAvailable(model))) {
      check(`Ollama em ${OLLAMA_URL} com ${model}`, false, 'Ollama fora do ar ou modelo ausente');
    } else {
      await setLocalProvider(serviceWorker, `${OLLAMA_URL}/v1`, model);
      const llmPage = await openTarget(context, fixtures.url('/fixture-llm.html'));
      const llmPanel = await runPanelDriver(context, extensionId, serviceWorker, llmPage, config);
      const llmLog = await serviceWorker.evaluate(async (tabId) => optimizer.getRunLog(tabId), llmPanel.tabId);
      report.llm = { status: llmPanel.status, report: llmPanel.report, errors: llmPanel.errors, llmCalls: llmLog?.llmCalls, altTexts: llmLog?.altTexts };
      check('painel com Ollama: aplicou', llmPanel.status === 'ok', llmPanel.report?.summary?.replace(/\n/g, ' | ') || JSON.stringify(llmPanel.errors));
      check('chamadas ao LLM no runLog com tokens', (llmLog?.llmCalls || []).some((call) => Number.isFinite(call.tokensIn) && Number.isFinite(call.tokensOut)),
        JSON.stringify((llmLog?.llmCalls || []).map((call) => [call.finishReason, call.tokensIn, call.tokensOut, call.latencyMs])));
      await llmPage.close();
    }
  }
} catch (error) {
  check('aceite rodou até o fim', false, error.message.split('\n')[0]);
} finally {
  await close();
  await fixtures.close();
}

process.exit(finish());
