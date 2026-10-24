// Aceite 3: smoke do harness, 3 URLs × {baseline, v1.0.0, v1.1.0} → 9 linhas, JSON bruto
// válido e ligado à linha pelo sha256, axe e IBM preenchidos (ou erro do avaliador
// justificado), o Ollama de fato no ar (cada condição com plugin chamou o LLM) e registro
// de sessão com as versões e o contexto do modelo (D8).
// Uso: node aceites/3-smoke-harness.js [--capturar] [--snapshots pasta] [--saida pasta]
//      node aceites/3-smoke-harness.js --validar pasta-de-resultados [--sessao id]
// Com --validar, só contam as linhas do estrato smoke da sessão mais recente (ou de
// --sessao): o runs.csv do lote é append-only e junta sessões e estratos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, loadUrls, parseArgs } from '../src/lib/config.js';
import { readCsv } from '../src/lib/csv.js';
import { sha256File } from '../src/lib/hash.js';
import { createReport, runHarnessScript } from './lib.js';

const args = parseArgs();
const config = loadConfig();
const { report, check, finish } = createReport('3-smoke-harness', args);
const isNumber = (value) => value !== '' && value !== undefined && Number.isFinite(Number(value));

let results;
if ('validar' in args && (typeof args.validar !== 'string' || !args.validar.trim())) {
  console.error('--validar precisa da pasta de resultados (ex.: --validar results).');
  process.exit(1);
}
if (typeof args.validar === 'string') {
  results = path.resolve(args.validar);
} else {
  results = fs.mkdtempSync(path.join(os.tmpdir(), 'accessify-aceite-smoke-'));
  const snapshotArgs = [];
  if (args.capturar) {
    const snapshots = typeof args.snapshots === 'string' ? path.resolve(args.snapshots) : path.join(results, 'snapshots');
    snapshotArgs.push('--snapshots', snapshots);
    check('captura do estrato smoke', runHarnessScript('capture.js', ['--estrato', config.smoke.estrato, '--snapshots', snapshots]) === 0);
  } else if (typeof args.snapshots === 'string') {
    snapshotArgs.push('--snapshots', path.resolve(args.snapshots));
  }
  check('run.js --smoke terminou (código 0)', runHarnessScript('run.js', ['--smoke', '--resultados', results, ...snapshotArgs]) === 0);
}
report.results = results;

const allRows = fs.existsSync(path.join(results, 'runs.csv')) ? readCsv(path.join(results, 'runs.csv')) : [];
// Só a execução 1: uma sessão com --execucoes 3 tem três linhas por URL × condição
const smokeRows = allRows.filter((row) => row.estrato.split('+').includes(config.smoke.estrato) && config.smoke.conditions.includes(row.condicao) && row.execucao === '1');
const sessionId = typeof args.sessao === 'string' ? args.sessao : smokeRows.map((row) => row.sessao).sort().at(-1);
const rows = smokeRows.filter((row) => row.sessao === sessionId);
report.sessao = sessionId || null;
const smokeUrls = loadUrls().filter((entry) => entry.estratos.includes(config.smoke.estrato));
const expected = smokeUrls.length * config.smoke.conditions.length;
report.rows = rows.map((row) => ({ condicao: row.condicao, url: row.url, status: row.status, tentativas: row.tentativas, observacoes: row.observacoes }));
check(`${expected} linhas (${smokeUrls.length} URLs × ${config.smoke.conditions.join(', ')})`, rows.length === expected, String(rows.length));
check('todas as combinações URL × condição presentes', config.smoke.conditions.every((condition) => smokeUrls.every((entry) => rows.some((row) => row.condicao === condition && row.url === entry.url))));

const problems = { status: [], raw: [], axe: [], ibm: [], novos: [], tokens: [] };
rows.forEach((row) => {
  const label = `${row.condicao} ${row.url}`;
  if (!['ok', 'parcial', 'falha'].includes(row.status) || (row.status !== 'ok' && !row.observacoes)) {
    problems.status.push(label);
  }
  const rawFile = path.join(results, 'raw', `${row.run_id}__${row.sessao}__a${row.tentativas}.json`);
  try {
    JSON.parse(fs.readFileSync(rawFile, 'utf8'));
    if (sha256File(rawFile) !== row.raw_sha256) {
      problems.raw.push(`${label}: sha256`);
    }
  } catch (error) {
    problems.raw.push(`${label}: ${error.code || 'JSON inválido'}`);
  }
  if (!['axe_violations_critical', 'axe_violations_serious', 'axe_violations_moderate', 'axe_violations_minor', 'axe_elementos', 'axe_incomplete'].every((column) => isNumber(row[column]))) {
    problems.axe.push(label);
  }
  const ibmFilled = row.ibm_status === 'ok' && ['ibm_violations', 'ibm_potential_violations', 'ibm_recommendations', 'ibm_potential_recommendations', 'ibm_manual'].every((column) => isNumber(row[column]));
  if (!ibmFilled && !(row.ibm_status === 'erro' && /ibm:/.test(row.observacoes))) {
    problems.ibm.push(label);
  }
  // novos_erros_ibm vazio só vale com o motivo documentado (a baseline do IBM falhou)
  const ibmNewOk = isNumber(row.novos_erros_ibm) || row.ibm_status !== 'ok' || /sem baseline do IBM/.test(row.observacoes);
  if (row.condicao !== 'baseline' && !(isNumber(row.novos_erros_axe) && ibmNewOk)) {
    problems.novos.push(label);
  }
  if (row.condicao !== 'baseline' && !['tokens_in', 'tokens_out', 'latencia_ms'].every((column) => isNumber(row[column]))) {
    problems.tokens.push(label);
  }
});
check('status válido e falhas com motivo em observacoes', problems.status.length === 0, problems.status.join(' | '));
check('JSON bruto de cada linha existe, é válido e bate com raw_sha256', rows.length > 0 && problems.raw.length === 0, problems.raw.join(' | '));
check('axe preenchido em todas as linhas', rows.length > 0 && problems.axe.length === 0, problems.axe.join(' | '));
check('IBM preenchido (ou erro do avaliador justificado)', rows.length > 0 && problems.ibm.length === 0, problems.ibm.join(' | '));
// Um erro do IBM é aceito como exceção, não como regra: o IBM tem de ter rodado em toda
// baseline e em ao menos uma linha de cada condição
const ibmErrors = rows.filter((row) => row.ibm_status !== 'ok');
const baselineWithoutIbm = rows.filter((row) => row.condicao === 'baseline' && row.ibm_status !== 'ok');
const conditionsWithoutIbm = config.smoke.conditions.filter((id) => !rows.some((row) => row.condicao === id && row.ibm_status === 'ok'));
check('IBM rodou em toda baseline e em ao menos uma linha de cada condição', rows.length > 0 && baselineWithoutIbm.length === 0 && conditionsWithoutIbm.length === 0,
  `${ibmErrors.length} linha(s) com erro do IBM${conditionsWithoutIbm.length ? `; sem IBM: ${conditionsWithoutIbm.join(', ')}` : ''}`);
check('novos_erros_axe e novos_erros_ibm nas condições com plugin', problems.novos.length === 0, problems.novos.join(' | '));
check('tokens e latência nas condições com plugin', problems.tokens.length === 0, problems.tokens.join(' | '));

// Com o Ollama fora do ar, toda linha com plugin vira falha com motivo e passaria nas
// verificações acima: cada condição com plugin precisa ter chamado o LLM ao menos uma vez,
// e ao menos um run com plugin precisa ter aplicado
const pluginConditions = config.smoke.conditions.filter((id) => id !== 'baseline');
const silent = pluginConditions.filter((id) => !rows.some((row) => row.condicao === id && Number(row.tokens_in) > 0));
check('cada condição com plugin chamou o LLM (tokens_in > 0 em ao menos uma linha)', rows.length > 0 && silent.length === 0, silent.join(', '));
check('ao menos um run com plugin aplicou (ok ou parcial)', rows.some((row) => row.condicao !== 'baseline' && ['ok', 'parcial'].includes(row.status)));
report.statusPorCondicao = Object.fromEntries(config.smoke.conditions.map((id) => [id, rows.filter((row) => row.condicao === id).map((row) => row.status)]));

const sessionFile = sessionId ? path.join(results, 'sessions', `${sessionId}.json`) : null;
const session = sessionFile && fs.existsSync(sessionFile) ? JSON.parse(fs.readFileSync(sessionFile, 'utf8')) : null;
report.session = session && {
  sessionId: session.sessionId,
  versions: session.versions,
  ollama: session.ollama?.version,
  contexts: Object.fromEntries(Object.entries(session.contexts || {}).map(([id, info]) => [id, {
    browser: info.browser?.product, extension: info.extension?.gitDescribe, ollama: info.ollama, relaunches: info.relaunches, strayLlmCalls: info.strayLlmCalls?.length ?? 0
  }])),
  warnings: session.warnings,
  harnessErrors: session.harnessErrors,
  aborted: session.aborted || null
};
check('registro de sessão com versões (Playwright, axe, IBM, Ollama) e fim do lote', typeof session?.versions?.playwright === 'string' && typeof session?.versions?.axeCore === 'string'
  && typeof session?.versions?.ibmEngine === 'string' && typeof session?.ollama?.version === 'string' && !!session?.finishedAt && !session?.aborted);
check('procedência das extensões na sessão', pluginConditions.every((id) => !!session?.contexts?.[id]?.extension?.copySha256));
const wrongContext = pluginConditions.filter((id) => session?.contexts?.[id]?.ollama?.contextLength !== config.ollama.expectedContextLength);
check(`contexto do Ollama = ${config.ollama.expectedContextLength} na carga de cada condição (D8)`, !!session && wrongContext.length === 0,
  wrongContext.map((id) => `${id}: ${session?.contexts?.[id]?.ollama?.contextLength ?? session?.contexts?.[id]?.ollama?.error ?? 'sem registro'}`).join(', '));

process.exit(finish());
