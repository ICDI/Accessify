// Aceite 4: determinismo das correções determinísticas. O texto gerado pelo LLM não entra
// no critério (temperature 0 com seed não garante saída idêntica no Ollama).
//  a) sem LLM: o build pelo painel, duas vezes na test-page → mesmo DOM final (IDs
//     aleatórios normalizados) e as mesmas deterministicFixes no runLog;
//  b) com LLM (pulado com --sem-llm): o harness roda a condição duas vezes no mesmo
//     snapshot (--execucoes 2) → as mesmas deterministicFixes nos dois runLogs.
// Uso: node aceites/4-determinismo.js [--sem-llm] [--condicao v1.1.0-fix] [--url https://...]
//                                     [--snapshots pasta] [--saida pasta]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runPanelDriver } from '../src/drivers/panel.js';
import { loadConfig, parseArgs } from '../src/lib/config.js';
import { readCsv } from '../src/lib/csv.js';
import { NO_LLM_BASE_URL, buildCopy, createReport, finalDom, launchExtension, openTarget, runHarnessScript, serveFixtures, setLocalProvider } from './lib.js';

const args = parseArgs();
const config = loadConfig(args);
const { report, check, finish } = createReport('4-determinismo', args);
const fixesKey = (runLog) => JSON.stringify((runLog?.deterministicFixes || []).map(({ type, round, applied }) => [type, round, applied]));

// a) sem LLM, pelo painel
const fixtures = await serveFixtures();
const extension = buildCopy('aceite-determinismo');
const launched = await launchExtension(extension.dir, 'determinismo');
try {
  await setLocalProvider(launched.serviceWorker, NO_LLM_BASE_URL, 'qwen3:8b');
  const runs = [];
  for (const attempt of [1, 2]) {
    const page = await openTarget(launched.context, fixtures.url(`/test-page.html?run=${attempt}`));
    const panel = await runPanelDriver(launched.context, launched.extensionId, launched.serviceWorker, page, config);
    const runLog = await launched.serviceWorker.evaluate(async (tabId) => optimizer.getRunLog(tabId), panel.tabId);
    runs.push({ status: panel.status, appliedChanges: panel.appliedChanges, dom: await finalDom(page), runLog });
    await page.close();
  }
  report.semLlm = runs.map(({ status, appliedChanges, runLog }) => ({ status, appliedChanges, deterministicFixes: runLog?.deterministicFixes }));
  check('a) os dois runs aplicaram', runs.every((run) => run.status === 'ok'), runs.map((run) => `${run.status}/${run.appliedChanges}`).join(' x '));
  check('a) mesmo DOM final nos dois runs (sem LLM)', runs[0].dom === runs[1].dom, `${runs[0].dom.length} x ${runs[1].dom.length} caracteres`);
  check('a) mesmas deterministicFixes nos dois runs', (runs[0].runLog?.deterministicFixes || []).length > 0 && fixesKey(runs[0].runLog) === fixesKey(runs[1].runLog), fixesKey(runs[0].runLog));
} catch (error) {
  check('a) rodou até o fim', false, error.message.split('\n')[0]);
} finally {
  await launched.close();
  await fixtures.close();
}

// b) com LLM, pelo harness
if (!args['sem-llm']) {
  const condition = typeof args.condicao === 'string' ? args.condicao : 'v1.1.0-fix';
  // As deterministicFixes vêm do runLog (C10), que só a v1.1.0 pelo gancho devolve
  const definition = config.conditions.find((item) => item.id === condition);
  if (!definition || definition.driver !== 'hook') {
    check(`b) condição ${condition} é da v1.1.0 pelo gancho (tem runLog)`, false, definition ? `driver ${definition.driver}` : 'condição desconhecida');
    process.exit(finish());
  }
  const url = typeof args.url === 'string' ? args.url : 'https://www.w3.org/WAI/demos/bad/before/home.html';
  const results = fs.mkdtempSync(path.join(os.tmpdir(), 'accessify-aceite-determinismo-'));
  const harnessArgs = ['--conditions', condition, '--url', url, '--execucoes', '2', '--resultados', results];
  if (typeof args.snapshots === 'string') {
    harnessArgs.push('--snapshots', path.resolve(args.snapshots));
  }
  const exit = runHarnessScript('run.js', harnessArgs);
  const rows = fs.existsSync(path.join(results, 'runs.csv')) ? readCsv(path.join(results, 'runs.csv')) : [];
  const raws = rows.map((row) => {
    const file = path.join(results, 'raw', `${row.run_id}__${row.sessao}__a${row.tentativas}.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  });
  const runLogs = raws.map((raw) => raw?.driver?.runLog || null);
  report.comLlm = { condition, url, results, exit, rows: rows.map((row) => ({ execucao: row.execucao, status: row.status, observacoes: row.observacoes })), deterministicFixes: runLogs.map((runLog) => runLog?.deterministicFixes) };
  check(`b) harness rodou ${condition} duas vezes`, exit === 0 && rows.length === 2, `código ${exit}, ${rows.length} linhas`);
  check('b) os dois runs aplicaram (ok ou parcial)', rows.length === 2 && rows.every((row) => ['ok', 'parcial'].includes(row.status)), rows.map((row) => `${row.status}${row.observacoes ? ` (${row.observacoes.slice(0, 80)})` : ''}`).join(' x '));
  check('b) mesmas deterministicFixes nos dois runs (com LLM)', runLogs.length === 2 && (runLogs[0]?.deterministicFixes || []).length > 0 && fixesKey(runLogs[0]) === fixesKey(runLogs[1]), runLogs.map(fixesKey).join(' x '));
}

process.exit(finish());
