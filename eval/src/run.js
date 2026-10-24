// Laço principal do estudo: URL × condição × execução, com uma linha por run em
// results/runs.csv e o JSON bruto de cada tentativa em results/raw/. Nunca interrompe o
// lote por causa de uma URL: falha é dado.
// Uso: node src/run.js [--smoke] [--conditions baseline,v1.1.0] [--estrato smoke]
//                      [--limit 3] [--execucoes 3] [--url https://...]
//                      [--urls lista.csv] [--snapshots pasta] [--resultados pasta]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runHookDriver } from './drivers/hook.js';
import { installProviderAdapter, runPanelDriver } from './drivers/panel.js';
import { newViolations, runAxe } from './lib/axe.js';
import { configureExtensionStorage, launchCondition } from './lib/browser.js';
import { loadConfig, loadUrls, parseArgs } from './lib/config.js';
import { appendCsvRow } from './lib/csv.js';
import { countGenericLabels, diffGenericLabels, serializeDom } from './lib/dom-metrics.js';
import { prepareExtension, removeExtensionCopy } from './lib/extensions.js';
import { sha256, slugForUrl } from './lib/hash.js';
import { IBM_KEY_FORMAT, newIbmViolations, runIbm } from './lib/ibm.js';
import { withIoRetries } from './lib/io.js';
import { harnessVersion, loadedContext, ollamaInfo, packageVersions, prepareModel, writeSession } from './lib/session.js';
import { countRenderingAborts, latestSnapshots, openSnapshot, recordScroll, resetScroll, verifySnapshot } from './lib/snapshot.js';

export const RUN_COLUMNS = [
  'run_id', 'sessao', 'url', 'estrato', 'data_coleta', 'condicao', 'versao_plugin', 'versao_harness', 'modelo', 'model_digest',
  'execucao', 'tentativas', 'status', 'snapshot_sha256', 'raw_sha256', 'har_abortados',
  'axe_violations_critical', 'axe_violations_serious', 'axe_violations_moderate',
  'axe_violations_minor', 'axe_elementos', 'axe_incomplete', 'novos_erros_axe', 'novos_erros_axe_regra',
  'ibm_violations', 'ibm_potential_violations', 'ibm_recommendations', 'ibm_potential_recommendations',
  'ibm_manual', 'novos_erros_ibm', 'novos_erros_ibm_regra', 'ibm_status',
  'rotulos_genericos', 'tokens_in', 'tokens_out', 'latencia_ms', 'observacoes'
];

// Falhas do próprio harness (navegador da condição caiu, replay não abriu, medição falhou
// depois do driver) não contam como tentativa do plugin, até este limite
const MAX_HARNESS_RETRIES = 2;

const args = parseArgs();
const config = loadConfig(args);
const executions = Number(args.execucoes || 1);
if (!Number.isInteger(executions) || executions < 1) {
  console.error('--execucoes precisa ser um inteiro maior que zero.');
  process.exit(1);
}
const runsFile = path.join(config.dirs.results, 'runs.csv');
const pendingRunsFile = path.join(config.dirs.results, 'runs.pendentes.csv');
fs.mkdirSync(config.dirs.raw, { recursive: true });

// Um CSV com outro cabeçalho é de outra versão do harness: para antes de gastar o lote
for (const file of [runsFile, pendingRunsFile]) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').split(/\r?\n/, 1)[0] !== RUN_COLUMNS.join(',')) {
    console.error(`${path.relative(process.cwd(), file)} tem outro cabeçalho: arquive o arquivo antigo antes de rodar.`);
    process.exit(1);
  }
}

const requested = args.conditions
  ? String(args.conditions).split(',').map((id) => id.trim()).filter(Boolean)
  : (args.smoke ? config.smoke.conditions : config.conditions.map((condition) => condition.id));
// A baseline roda primeiro: é dela que sai o novos_erros_axe das outras condições
const conditionIds = [...new Set(requested)].sort((a, b) => (a === 'baseline' ? -1 : b === 'baseline' ? 1 : 0));
const conditions = conditionIds.map((id) => {
  const condition = config.conditions.find((candidate) => candidate.id === id);
  if (!condition) {
    console.error(`Condição desconhecida: ${id}`);
    process.exit(1);
  }
  return condition;
});

const allUrls = loadUrls(args.urls);
if (allUrls.duplicates.length) {
  console.warn(`URLs em mais de uma linha de urls.csv (uma entrada só, com todos os estratos): ${[...new Set(allUrls.duplicates.map((entry) => entry.url))].join(', ')}`);
}
let urls = allUrls;
const estrato = args.estrato || (args.smoke ? config.smoke.estrato : null);
if (estrato) {
  urls = urls.filter((entry) => entry.estratos.includes(estrato));
}
if (args.url) {
  urls = urls.filter((entry) => entry.url === args.url);
}
if (args.limit) {
  urls = urls.slice(0, Number(args.limit));
}
const snapshots = latestSnapshots(config.dirs.snapshots);
const modelSlug = (condition) => (condition.model ? condition.model.replace(/[^a-z0-9]+/gi, '-') : 'sem-modelo');

const startedAt = new Date().toISOString();
// Milissegundos + sufixo aleatório: duas sessões no mesmo segundo não dividem nomes de arquivo
const sessionId = `${startedAt.replace(/[-:]/g, '').replace('T', '-').replace('.', '').slice(0, 18)}-${crypto.randomBytes(2).toString('hex')}`;
const versions = { ...packageVersions(), harness: harnessVersion() };
const session = {
  sessionId,
  startedAt,
  study: config.study,
  args,
  conditions: conditionIds,
  urls: urls.length,
  executions,
  versions,
  ollama: await ollamaInfo(config.ollama.baseUrl),
  expectedContextLength: config.ollama.expectedContextLength,
  extensions: {},
  contexts: {},
  warnings: allUrls.duplicates.map((entry) => `URL em mais de uma linha de urls.csv (estrato ${entry.estrato || 'vazio'}), mesclada numa entrada: ${entry.url}`),
  harnessErrors: []
};
let sessionFile = null;
// Gravada já no início, a cada condição e a cada erro do harness: um lote interrompido
// não fica sem sessão
function saveSession() {
  try {
    sessionFile = writeSession(config.dirs.sessions, session);
  } catch (error) {
    console.error(`  sessão não gravada: ${error.message}`);
  }
}
function harnessError(entry) {
  session.harnessErrors.push({ at: new Date().toISOString(), ...entry });
  saveSession();
}
saveSession();

/**
 * Grava o JSON bruto de uma tentativa (fsync + rename). Nunca sobrescreve um bruto que já
 * existe: o raw_sha256 de uma linha anterior ficaria órfão. Devolve o sha256 do texto, ou
 * '' com o erro, que vai para observacoes e para os erros do harness.
 */
function saveRaw(raw, attempt) {
  let file = path.join(config.dirs.raw, `${raw.runId}__${sessionId}__a${attempt}.json`);
  try {
    const text = JSON.stringify(raw, null, 2);
    if (fs.existsSync(file)) {
      harnessError({ runId: raw.runId, message: `JSON bruto já existia: ${path.basename(file)}` });
      file = file.replace(/\.json$/, `__${crypto.randomBytes(3).toString('hex')}.json`);
    }
    const temp = `${file}.tmp`;
    withIoRetries(() => {
      const fd = fs.openSync(temp, 'w');
      try {
        fs.writeSync(fd, text);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    });
    withIoRetries(() => fs.renameSync(temp, file));
    return { sha: sha256(text) };
  } catch (error) {
    harnessError({ runId: raw.runId, message: `JSON bruto não gravado: ${error.message}` });
    return { sha: '', error: `harness: JSON bruto não gravado (${error.code || error.message})` };
  }
}

// Baseline por hash do snapshot: só vale a do mesmo snapshot (HTML, HAR e pasta) e do mesmo
// ambiente de medição (Chromium, viewport, locale e o hash do código do harness, que inclui
// o replay e a medição). Cada avaliador tem a sua: a do axe exige a mesma versão e tags do
// axe; a do IBM, a mesma versão do motor, conjunto de regras e formato dos resultados (pode
// vir de outro run da baseline do mesmo snapshot). Entre sessões, vale a mais recente pelo
// início do run; na sessão, a da própria sessão.
const baselines = new Map();
const baselineKey = (snapshot) => [snapshot.html_sha256, snapshot.har_sha256, snapshot.pasta_sha256 || ''].join('|');
const measurementEnvironment = (launched) => ({ browser: launched.browser.product, viewport: config.viewport, locale: config.locale, harness: versions.harness.sha256 });
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const runRef = (raw) => ({ runId: raw.runId, session: raw.session, attempt: raw.attempt ?? null });

function baselineCandidates(snapshot, environment) {
  const prefix = `${config.study}_baseline_sem-modelo_${snapshot.slug}_`;
  return fs.readdirSync(config.dirs.raw)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(config.dirs.raw, name), 'utf8'));
      } catch (error) {
        return null;
      }
    })
    .filter((raw) => raw && raw.status === 'ok'
      && raw.snapshot?.html_sha256 === snapshot.html_sha256
      && raw.snapshot?.har_sha256 === snapshot.har_sha256
      && (raw.snapshot?.pasta_sha256 || '') === (snapshot.pasta_sha256 || '')
      && sameJson(raw.environment, environment))
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
}

const usableAxe = (raw) => raw.axe?.post?.engine?.version === versions.axeCore && sameJson(raw.axe?.tags, config.axe.tags);
const usableIbm = (ibm) => !!ibm && ibm.engine?.version === versions.ibmEngine && ibm.ruleset === config.ibm.ruleset
  && ibm.keyFormat === IBM_KEY_FORMAT && ibm.numExecuted > 0 && Array.isArray(ibm.violations) && !!ibm.rules;

function findBaseline(snapshot, environment) {
  const key = baselineKey(snapshot);
  const entry = baselines.get(key) || { axe: null, ibm: null, searched: false };
  baselines.set(key, entry);
  // A baseline desta sessão sem IBM utilizável (o IBM deu erro) ainda procura o IBM nos
  // brutos de outras sessões; cada snapshot é procurado uma vez
  if (!entry.searched && (!entry.axe || !entry.ibm)) {
    const candidates = baselineCandidates(snapshot, environment);
    if (!entry.axe) {
      const best = candidates.find(usableAxe);
      entry.axe = best ? { post: best.axe.post, from: runRef(best) } : null;
    }
    if (!entry.ibm) {
      const best = candidates.find((raw) => usableIbm(raw.ibm?.post));
      entry.ibm = best ? { post: best.ibm.post, from: runRef(best) } : null;
    }
    entry.searched = true;
  }
  return entry.axe || entry.ibm ? entry : null;
}

function rememberBaseline(snapshot, raw, post, ibm) {
  const key = baselineKey(snapshot);
  const entry = baselines.get(key) || { axe: null, ibm: null, searched: false };
  if (!entry.axe?.thisSession) {
    entry.axe = { post, from: runRef(raw), thisSession: true };
  }
  // Uma execução da baseline com IBM válido substitui outra em que o IBM deu erro
  if (usableIbm(ibm) && !entry.ibm?.thisSession) {
    entry.ibm = { post: ibm, from: runRef(raw), thisSession: true };
  }
  baselines.set(key, entry);
}

function llmFailures(calls, aborted) {
  return aborted > 0 || calls.some((call) => call.error || call.networkError || call.parseError || (call.httpStatus && call.httpStatus >= 400));
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: sem resposta em ${ms} ms`)), ms);
    })
  ]);
}

const sumValues = (object) => Object.values(object).reduce((sum, n) => sum + n, 0);
const firstLine = (error) => String(error?.message || error).split('\n')[0];

// Erro do próprio harness (replay que não abre, medição que falha depois do driver): sobe
// marcado, para a tentativa não contar como do plugin
function harnessFailure(stage, error) {
  const failure = new Error(`harness: ${stage}: ${firstLine(error)}`);
  failure.harness = true;
  return failure;
}

async function runOnce(state, condition, entry, snapshot, execution, attempt, holder) {
  const { launched, adapter } = state;
  const runId = `${config.study}_${condition.id}_${modelSlug(condition)}_${snapshot.slug}_run${execution}`;
  const raw = {
    runId,
    session: sessionId,
    attempt,
    condition,
    url: entry.url,
    estrato: entry.estrato,
    execution,
    snapshot: { dir: snapshot.dir, html_sha256: snapshot.html_sha256, har_sha256: snapshot.har_sha256, pasta_sha256: snapshot.pasta_sha256 || null, capturado_em: snapshot.capturado_em },
    environment: measurementEnvironment(launched),
    startedAt: new Date().toISOString()
  };

  let opened;
  try {
    opened = await openSnapshot(launched.context, snapshot, config);
  } catch (error) {
    throw harnessFailure('replay', error);
  }
  const { page } = opened;
  holder.pages.add(page);

  try {
    if (holder.cancelled) {
      throw new Error('run cancelado pelo watchdog');
    }
    const labelsBefore = await countGenericLabels(page);
    const scrollRecorded = await recordScroll(page);
    let driver = { status: 'ok', errors: [] };
    let llmCalls = [];
    let abortedCalls = 0;
    let usageKnown = true;

    if (condition.driver === 'hook') {
      driver = await runHookDriver(page, condition, config, runId, launched.serviceWorker);
      llmCalls = driver.usage === 'runLog' || driver.usage === 'desconhecido' ? (driver.runLog?.llmCalls || []) : [];
      usageKnown = driver.usage !== 'desconhecido';
    } else if (condition.driver === 'panel-v1') {
      // Portão por tentativa: as tentativas de uma URL dividem o runId, e o end() de uma
      // tentativa abandonada pelo watchdog não pode fechar o portão da seguinte
      const gateId = `${runId}#${crypto.randomBytes(4).toString('hex')}`;
      try {
        driver = await runPanelDriver(launched.context, launched.extensionId, launched.serviceWorker, page, config, {
          onReady: () => adapter.begin(gateId),
          onPanel: (panel) => holder.pages.add(panel)
        });
      } finally {
        const ended = await adapter.end(gateId);
        llmCalls = ended.calls;
        abortedCalls = ended.aborted;
        driver.llmCalls = llmCalls;
        driver.abortedLlmCalls = abortedCalls;
      }
    }
    raw.driver = driver;

    const ranPlugin = condition.driver !== 'none';
    const totals = llmCalls.reduce((sum, call) => ({
      tokensIn: sum.tokensIn + (call.tokensIn || 0),
      tokensOut: sum.tokensOut + (call.tokensOut || 0),
      latencyMs: sum.latencyMs + (call.latencyMs || 0)
    }), { tokensIn: 0, tokensOut: 0, latencyMs: 0 });
    const usage = (value) => (ranPlugin && usageKnown ? value : '');

    // Medição: um erro aqui é do harness, mas o resultado do driver (e o uso do LLM) fica
    // no JSON bruto e na linha
    let post;
    let scroll;
    try {
      scroll = await resetScroll(page, config.timeouts.settleMs);
      post = await withTimeout(runAxe(page, config.axe.tags), config.timeouts.evaluatorMs, 'axe');
      const labelsAfter = await countGenericLabels(page);
      raw.genericLabels = diffGenericLabels(labelsBefore, labelsAfter);
      raw.axe = { tags: config.axe.tags, post };
      raw.domPost = await serializeDom(page);
    } catch (error) {
      if (holder.cancelled) {
        throw error;
      }
      const failure = harnessFailure('medição', error);
      raw.status = 'falha';
      raw.error = failure.message;
      return {
        raw,
        harnessFailure: true,
        row: {
          run_id: runId,
          status: 'falha',
          tokens_in: usage(totals.tokensIn),
          tokens_out: usage(totals.tokensOut),
          latencia_ms: usage(totals.latencyMs),
          observacoes: [failure.message, ...(driver.errors || []).map((item) => `${item.stage}: ${item.message}`)].join(' | ')
        }
      };
    }
    // IBM por último (decisão D6): o motor fica no escopo global da página. Um erro ou
    // estouro de prazo do avaliador não muda o status do run; vai para ibm_status e
    // observacoes
    let ibm = null;
    try {
      ibm = await withTimeout(runIbm(page, config.ibm.ruleset), config.timeouts.evaluatorMs, 'ibm');
      raw.ibm = { ruleset: config.ibm.ruleset, post: ibm };
    } catch (error) {
      raw.ibm = { ruleset: config.ibm.ruleset, error: firstLine(error) };
    }
    raw.replay = {
      abortedMain: opened.aborted.main,
      abortedFrames: opened.aborted.frames,
      counters: opened.counters,
      loadTimedOut: opened.loadTimedOut,
      compatModeMismatch: opened.compatModeMismatch,
      animations: opened.animations,
      scrollRestoredFromCapture: opened.scrollRestored,
      scrollBeforeMeasure: { ...scroll, elementsRecorded: scrollRecorded }
    };

    const baseline = condition.id === 'baseline' ? null : findBaseline(snapshot, raw.environment);
    raw.axe.newViolations = baseline?.axe ? newViolations(baseline.axe.post, post) : null;
    raw.axe.baselineFrom = baseline?.axe?.from || null;
    try {
      raw.ibm.newViolations = baseline?.ibm && ibm ? newIbmViolations(baseline.ibm.post, ibm) : null;
    } catch (error) {
      raw.ibm.newViolations = null;
      raw.ibm.compareError = firstLine(error);
    }
    raw.ibm.baselineFrom = baseline?.ibm?.from || null;

    let status = driver.status === 'ok' ? 'ok' : (driver.status === 'parcial' ? 'parcial' : 'falha');
    // Mesmo critério de 'parcial' do gancho da v1.1.0: aplicou, mas alguma chamada falhou
    if (condition.driver === 'panel-v1' && status === 'ok' && llmFailures(llmCalls, abortedCalls)) {
      status = 'parcial';
    }
    raw.status = status;

    // D8: contexto efetivo do modelo conferido depois de cada run com modelo
    const contextLength = condition.model ? await loadedContext(config.ollama.baseUrl, condition.model) : null;
    raw.ollamaContext = contextLength;

    const notes = [
      ...(driver.errors || []).map((error) => `${error.stage}: ${error.message}`),
      condition.id !== 'baseline' && !baseline?.axe ? 'sem baseline válido (mesmo snapshot, mesmo axe, mesmo ambiente e código do harness) para novos_erros_axe' : null,
      condition.id !== 'baseline' && ibm && !baseline?.ibm ? 'sem baseline do IBM (mesmo snapshot e ambiente, mesma versão do motor, conjunto de regras e formato) para novos_erros_ibm' : null,
      raw.ibm.error ? `ibm: ${raw.ibm.error}` : null,
      raw.ibm.compareError ? `ibm: comparação com a baseline falhou (${raw.ibm.compareError})` : null,
      ibm?.ruleExceptions?.length ? `ibm: ${ibm.ruleExceptions.length} exceção(ões) de regra no motor (resultados daquela regra perdidos)` : null,
      ranPlugin && !usageKnown ? 'tokens e latência desconhecidos: o run da extensão não terminou (runLog parcial ou ausente)' : null,
      driver.lateResult ? `resultado tardio da extensão: ${driver.lateResult.status}` : null,
      driver.measurementUnsettled ? 'medição com o run da extensão possivelmente ainda aplicando (sem resposta tardia)' : null,
      driver.staleJob?.stillRunningAtReset ? 'job anterior da v1.0.0 ainda rodando ao zerar (60 s)' : null,
      condition.model && contextLength === null ? 'contexto do Ollama não conferido: modelo não estava carregado depois do run' : null,
      contextLength !== null && contextLength !== config.ollama.expectedContextLength ? `contexto do Ollama ${contextLength} (esperado ${config.ollama.expectedContextLength})` : null,
      opened.loadTimedOut ? 'load do snapshot não terminou no prazo' : null,
      opened.compatModeMismatch ? `compatMode no replay: ${opened.compatModeMismatch}` : null,
      opened.counters.blockedNavigations ? `navegações bloqueadas no replay: ${opened.counters.blockedNavigations}` : null
    ].filter(Boolean);

    if (condition.id === 'baseline' && status === 'ok' && !holder.cancelled) {
      rememberBaseline(snapshot, raw, post, ibm);
    }

    return {
      raw,
      row: {
        run_id: runId,
        status,
        har_abortados: countRenderingAborts(opened.aborted),
        axe_violations_critical: post.byImpact.critical,
        axe_violations_serious: post.byImpact.serious,
        axe_violations_moderate: post.byImpact.moderate,
        axe_violations_minor: post.byImpact.minor,
        axe_elementos: post.elements,
        axe_incomplete: post.incomplete,
        novos_erros_axe: raw.axe.newViolations ? raw.axe.newViolations.byTarget : '',
        novos_erros_axe_regra: raw.axe.newViolations ? sumValues(raw.axe.newViolations.byRule) : '',
        ibm_violations: ibm ? ibm.byLevel.violation : '',
        ibm_potential_violations: ibm ? ibm.byLevel.potentialviolation : '',
        ibm_recommendations: ibm ? ibm.byLevel.recommendation : '',
        ibm_potential_recommendations: ibm ? ibm.byLevel.potentialrecommendation : '',
        ibm_manual: ibm ? ibm.byLevel.manual : '',
        novos_erros_ibm: raw.ibm.newViolations ? raw.ibm.newViolations.byTarget : '',
        novos_erros_ibm_regra: raw.ibm.newViolations ? sumValues(raw.ibm.newViolations.byRule) : '',
        ibm_status: ibm ? 'ok' : 'erro',
        rotulos_genericos: raw.genericLabels.total,
        tokens_in: usage(totals.tokensIn),
        tokens_out: usage(totals.tokensOut),
        latencia_ms: usage(totals.latencyMs),
        observacoes: notes.join(' | ')
      }
    };
  } finally {
    await page.close().catch(() => {});
    holder.pages.delete(page);
  }
}

function failureResult(condition, entry, snapshot, execution, message) {
  const slug = snapshot?.slug || slugForUrl(entry.url);
  const runId = `${config.study}_${condition.id}_${modelSlug(condition)}_${slug}_run${execution}`;
  return {
    raw: { runId, session: sessionId, condition, url: entry.url, estrato: entry.estrato, execution, status: 'falha', error: message, startedAt: new Date().toISOString(), snapshot: snapshot ? { dir: snapshot.dir, html_sha256: snapshot.html_sha256 } : null },
    row: { run_id: runId, status: 'falha', observacoes: message }
  };
}

/**
 * Uma tentativa com prazo total. Promise.race só para de esperar: o watchdog também
 * fecha as abas do run (snapshot e painel) e marca o run como cancelado, para o que
 * continuar rodando não gravar baseline nem mexer no adaptador do run seguinte. Depois de
 * um watchdog o contexto da condição é fechado e relançado (o service worker ou o
 * renderer podem ter ficado presos).
 */
async function attemptWithWatchdog(state, condition, entry, snapshot, execution, attempt) {
  const holder = { pages: new Set(), cancelled: false };
  let timer;
  const watchdog = new Promise((resolve) => {
    timer = setTimeout(() => {
      holder.cancelled = true;
      holder.pages.forEach((page) => page.close().catch(() => {}));
      resolve(null);
    }, config.timeouts.runWatchdogMs);
  });
  try {
    const result = await Promise.race([runOnce(state, condition, entry, snapshot, execution, attempt, holder), watchdog]);
    if (result) {
      return { result, harnessFailure: !!result.harnessFailure };
    }
    return { result: failureResult(condition, entry, snapshot, execution, `harness: watchdog de ${config.timeouts.runWatchdogMs} ms`), watchdog: true };
  } catch (error) {
    if (state.launched.state.closed) {
      return { result: failureResult(condition, entry, snapshot, execution, `harness: navegador da condição caiu (${firstLine(error)})`), harnessFailure: true, crashed: true };
    }
    return { result: failureResult(condition, entry, snapshot, execution, firstLine(error)), harnessFailure: !!error.harness };
  } finally {
    clearTimeout(timer);
  }
}

const provenance = (extension) => (extension ? {
  label: extension.label,
  sourceDir: extension.sourceDir,
  version: extension.version,
  gitCommit: extension.gitCommit,
  gitDescribe: extension.gitDescribe,
  gitDirty: extension.gitDirty,
  copySha256: extension.copySha256
} : null);

function writeRun(condition, entry, snapshot, execution, conditionState, result, attempts, raw) {
  const extension = extensions.get(condition.extension);
  const row = {
    sessao: sessionId,
    url: entry.url,
    estrato: entry.estrato,
    data_coleta: snapshot?.capturado_em || '',
    condicao: condition.id,
    versao_plugin: extension ? (extension.gitDescribe || extension.version) : '',
    versao_harness: versions.harness.describe || versions.harness.sha256.slice(0, 12),
    modelo: condition.model || '',
    model_digest: condition.model ? (conditionState.ollama?.digest || session.ollama.digests?.[condition.model] || '') : '',
    execucao: execution,
    tentativas: attempts.length,
    snapshot_sha256: snapshot?.html_sha256 || '',
    raw_sha256: raw.sha,
    ...result.row,
    observacoes: [
      result.row.observacoes,
      raw.error,
      ...conditionState.notes,
      ...attempts.slice(0, -1).map((attempt, index) => `tentativa ${index + 1}: ${attempt.reason}`)
    ].filter(Boolean).join(' | ')
  };

  try {
    withIoRetries(() => appendCsvRow(runsFile, RUN_COLUMNS, row));
  } catch (error) {
    harnessError({ runId: row.run_id, message: `CSV: ${error.message}` });
    try {
      withIoRetries(() => appendCsvRow(pendingRunsFile, RUN_COLUMNS, row));
    } catch (pendingError) {
      console.error(`  linha não gravada em nenhum CSV (${row.run_id}): ${pendingError.message}`);
      harnessError({ runId: row.run_id, message: `CSV pendente: ${pendingError.message}`, row });
    }
  }
  return row;
}

async function closeCondition(conditionState, contextInfo) {
  if (conditionState.adapter) {
    contextInfo.strayLlmCalls.push(...conditionState.adapter.takeStrayCalls());
  }
  if (conditionState.launched) {
    await conditionState.launched.dispose();
  }
  conditionState.launched = null;
  conditionState.adapter = null;
}

/**
 * Abre (ou relança) o navegador da condição. Uma falha não sai do laço: vira erro do
 * harness, e depois de config.launchRetries falhas seguidas a condição para de tentar.
 */
async function openCondition(condition, conditionState, contextInfo) {
  await closeCondition(conditionState, contextInfo);
  try {
    const launched = await launchCondition(condition, config, extensions.get(condition.extension) || null);
    try {
      await configureExtensionStorage(launched.serviceWorker, condition, config);
      conditionState.adapter = condition.driver === 'panel-v1' ? await installProviderAdapter(launched.context, condition, config) : null;
    } catch (error) {
      await launched.dispose();
      throw error;
    }
    conditionState.launched = launched;
    conditionState.launchFailures = 0;
    contextInfo.browser = contextInfo.browser || launched.browser;
    contextInfo.launches.push({ at: launched.launchedAt, browser: launched.browser.product, copySha256: launched.extension?.copySha256 || null });
    contextInfo.relaunches = contextInfo.launches.length - 1;
    saveSession();
    return null;
  } catch (error) {
    conditionState.launchFailures += 1;
    const message = firstLine(error);
    harnessError({ condition: condition.id, message: `navegador da condição não abriu: ${message}` });
    if (conditionState.launchFailures >= config.launchRetries) {
      conditionState.broken = `harness: navegador da condição não abriu ${conditionState.launchFailures} vezes seguidas (${message})`;
    }
    return `harness: navegador da condição não abriu (${message})`;
  }
}

async function runEntry(condition, conditionState, contextInfo, entry, execution) {
  const snapshot = snapshots.get(entry.url);
  const attempts = [];
  let result = null;
  let raw = { sha: '' };

  const precheck = entry.invalid ? `URL inválida: "${entry.url}"`
    : !snapshot ? 'sem snapshot capturado'
      : snapshot.status !== 'ok' ? `snapshot ${snapshot.status === 'suspeito' ? 'suspeito' : 'com falha'}: ${snapshot.observacoes}`
        : !verifySnapshot(snapshot, config) ? 'snapshot no disco diferente do índice (sha256)'
          : conditionState.broken;
  if (precheck) {
    result = failureResult(condition, entry, snapshot, execution, precheck);
    result.raw.attempt = 1;
    raw = saveRaw(result.raw, 1);
    attempts.push({ reason: precheck });
    return { result, attempts, raw, snapshot };
  }

  let pluginTries = 0;
  let harnessRetries = 0;
  for (let attempt = 1; pluginTries < 1 + config.retries; attempt++) {
    if (!conditionState.launched || conditionState.launched.state.closed) {
      const launchError = await openCondition(condition, conditionState, contextInfo);
      if (launchError) {
        result = failureResult(condition, entry, snapshot, execution, launchError);
        result.raw.attempt = attempt;
        raw = saveRaw(result.raw, attempt);
        attempts.push({ reason: launchError });
        break;
      }
    }

    const outcome = await attemptWithWatchdog(conditionState, condition, entry, snapshot, execution, attempt);
    result = outcome.result;
    result.raw.attempt = attempt;
    raw = saveRaw(result.raw, attempt);
    attempts.push({ reason: result.row.observacoes || result.row.status });
    if (result.row.status !== 'falha') {
      break;
    }
    if (outcome.harnessFailure && harnessRetries < MAX_HARNESS_RETRIES) {
      // Falha do harness (navegador caiu, replay ou medição): nova tentativa que não conta
      // como do plugin
      harnessRetries++;
      harnessError({ condition: condition.id, runId: result.raw.runId, message: `${result.row.observacoes}; nova tentativa sem contar a do plugin` });
      continue;
    }
    pluginTries++;
    if (outcome.watchdog) {
      harnessError({ condition: condition.id, runId: result.raw.runId, message: 'watchdog do run; contexto relançado' });
      await closeCondition(conditionState, contextInfo);
    }
  }
  return { result, attempts, raw, snapshot };
}

// Cada extensão é copiada uma vez por sessão: todas as condições e relançamentos usam a
// mesma cópia, mesmo que a pasta de trabalho mude durante o lote
const extensions = new Map();
for (const key of new Set(conditions.map((condition) => condition.extension).filter(Boolean))) {
  try {
    const extension = prepareExtension(config.dirs[key], key);
    extensions.set(key, extension);
    session.extensions[key] = provenance(extension);
  } catch (error) {
    session.extensions[key] = { error: error.message };
    harnessError({ message: `extensão ${key} não preparada: ${error.message}` });
  }
}
saveSession();

// Condição em andamento, para o encerramento fechar o navegador dela mesmo depois de um
// erro inesperado (um contexto aberto prenderia o processo do Node)
let current = null;
try {
  for (const condition of conditions) {
    console.log(`\n== condição ${condition.id}`);
    const contextInfo = { extension: provenance(extensions.get(condition.extension)), browser: null, launches: [], relaunches: 0, ollama: null, strayLlmCalls: [] };
    session.contexts[condition.id] = contextInfo;
    const conditionState = { launched: null, adapter: null, launchFailures: 0, broken: null, notes: [], ollama: null };
    current = { conditionState, contextInfo };

    const eligible = urls.filter((entry) => !condition.estratos || condition.estratos.some((item) => entry.estratos.includes(item)));
    if (!eligible.length) {
      const warning = `condição ${condition.id} sem nenhuma URL elegível${condition.estratos ? ` (estratos ${condition.estratos.join(', ')})` : ''}`;
      console.warn(`  ${warning}`);
      session.warnings.push(warning);
      saveSession();
      continue;
    }

    if (condition.extension && !extensions.has(condition.extension)) {
      conditionState.broken = `harness: ${session.extensions[condition.extension]?.error || 'extensão não preparada'}`;
    } else if (condition.model) {
      // Ollama no ar, modelo existe e carregado antes da primeira URL; contexto (D8) conferido
      const prepared = await prepareModel(config.ollama.baseUrl, condition.model, { timeoutMs: config.timeouts.warmupMs, keepAlive: config.ollama.keepAlive });
      contextInfo.ollama = prepared;
      conditionState.ollama = prepared;
      if (!prepared.ok) {
        conditionState.broken = `harness: ${prepared.error}`;
        harnessError({ condition: condition.id, message: prepared.error });
      } else if (prepared.contextLength !== config.ollama.expectedContextLength) {
        const note = `contexto do Ollama na carga ${prepared.contextLength ?? 'desconhecido'} (esperado ${config.ollama.expectedContextLength})`;
        conditionState.notes.push(note);
        harnessError({ condition: condition.id, message: note });
      }
    }
    saveSession();

    // Execuções intercaladas: a 2ª de uma URL não vem logo depois da 1ª (cache de prompt
    // do Ollama quente e variância subestimada)
    for (let execution = 1; execution <= executions; execution++) {
      for (const entry of eligible) {
        const { result, attempts, raw, snapshot } = await runEntry(condition, conditionState, contextInfo, entry, execution);
        const row = writeRun(condition, entry, snapshot, execution, conditionState, result, attempts, raw);
        console.log(`  ${row.status.padEnd(7)} ${entry.url} (execução ${execution}${attempts.length > 1 ? `, ${attempts.length} tentativas` : ''})${row.observacoes ? ` — ${row.observacoes.slice(0, 160)}` : ''}`);
      }
    }

    await closeCondition(conditionState, contextInfo);
    current = null;
    saveSession();
  }
} catch (error) {
  // Erro inesperado do próprio harness: a sessão registra antes de o processo sair
  session.aborted = { at: new Date().toISOString(), message: error.message, stack: error.stack };
  process.exitCode = 1;
  console.error(error);
} finally {
  if (current) {
    await closeCondition(current.conditionState, current.contextInfo).catch((error) => session.warnings.push(`navegador não fechado: ${error.message}`));
  }
  extensions.forEach((extension) => {
    const problem = removeExtensionCopy(extension);
    if (problem) {
      session.warnings.push(`cópia da extensão ${extension.label} não apagada: ${problem}`);
    }
  });
  session.finishedAt = new Date().toISOString();
  session.ollamaAfter = await ollamaInfo(config.ollama.baseUrl);
  saveSession();
  console.log(`\nsessão: ${sessionFile}`);
}
