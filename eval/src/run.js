// Laço principal do estudo: URL × condição × execução, com uma linha por run em
// results/runs.csv e o JSON bruto de cada tentativa em results/raw/. Nunca interrompe o
// lote por causa de uma URL: falha é dado.
// Uso: node src/run.js [--smoke] [--conditions baseline,v1.1.0] [--estrato smoke]
//                      [--limit 3] [--execucoes 3] [--url https://...]
import fs from 'node:fs';
import path from 'node:path';
import { runHookDriver } from './drivers/hook.js';
import { installProviderAdapter, runPanelDriver } from './drivers/panel.js';
import { newViolations, runAxe } from './lib/axe.js';
import { configureExtensionStorage, launchCondition } from './lib/browser.js';
import { loadConfig, loadUrls, parseArgs } from './lib/config.js';
import { appendCsvRow } from './lib/csv.js';
import { countGenericLabels, diffGenericLabels, serializeDom } from './lib/dom-metrics.js';
import { sha256, slugForUrl } from './lib/hash.js';
import { ollamaInfo, packageVersions, writeSession } from './lib/session.js';
import { countRenderingAborts, latestSnapshots, openSnapshot, resetScroll, verifySnapshot } from './lib/snapshot.js';

export const RUN_COLUMNS = [
  'run_id', 'sessao', 'url', 'estrato', 'data_coleta', 'condicao', 'versao_plugin', 'modelo', 'model_digest',
  'execucao', 'tentativas', 'status', 'snapshot_sha256', 'raw_sha256', 'har_abortados',
  'axe_violations_critical', 'axe_violations_serious', 'axe_violations_moderate',
  'axe_violations_minor', 'axe_incomplete', 'novos_erros_axe', 'novos_erros_axe_regra',
  'rotulos_genericos', 'tokens_in', 'tokens_out', 'latencia_ms', 'observacoes'
];

const args = parseArgs();
const config = loadConfig();
const runsFile = path.join(config.dirs.results, 'runs.csv');
const pendingRunsFile = path.join(config.dirs.results, 'runs.pendentes.csv');
fs.mkdirSync(config.dirs.raw, { recursive: true });

// Um CSV com outro cabeçalho é de outra versão do harness: para antes de gastar o lote
if (fs.existsSync(runsFile) && fs.readFileSync(runsFile, 'utf8').split(/\r?\n/, 1)[0] !== RUN_COLUMNS.join(',')) {
  console.error('results/runs.csv tem outro cabeçalho: arquive o arquivo antigo antes de rodar.');
  process.exit(1);
}

const requested = args.conditions
  ? String(args.conditions).split(',')
  : (args.smoke ? config.smoke.conditions : config.conditions.map((condition) => condition.id));
// A baseline roda primeiro: é dela que sai o novos_erros_axe das outras condições
const conditionIds = [...requested].sort((a, b) => (a === 'baseline' ? -1 : b === 'baseline' ? 1 : 0));
const conditions = conditionIds.map((id) => {
  const condition = config.conditions.find((candidate) => candidate.id === id);
  if (!condition) {
    throw new Error(`Condição desconhecida: ${id}`);
  }
  return condition;
});

let urls = loadUrls();
const estrato = args.estrato || (args.smoke ? config.smoke.estrato : null);
if (estrato) {
  urls = urls.filter((entry) => entry.estrato === estrato);
}
if (args.url) {
  urls = urls.filter((entry) => entry.url === args.url);
}
if (args.limit) {
  urls = urls.slice(0, Number(args.limit));
}
const executions = Number(args.execucoes || 1);
const snapshots = latestSnapshots(config.dirs.snapshots);
const modelSlug = (condition) => (condition.model ? condition.model.replace(/[^a-z0-9]+/gi, '-') : 'sem-modelo');

const startedAt = new Date().toISOString();
const sessionId = startedAt.replace(/[-:.]/g, '').replace('T', '-').slice(0, 15);
const versions = packageVersions();
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
  contexts: {},
  harnessErrors: []
};
// Gravada já no início e de novo a cada condição: um lote interrompido não fica sem sessão
let sessionFile = writeSession(config.dirs.sessions, session);
const saveSession = () => { sessionFile = writeSession(config.dirs.sessions, session); };

function writeRawFile(name, data) {
  const text = JSON.stringify(data, null, 2);
  const file = path.join(config.dirs.raw, name);
  const temp = `${file}.tmp`;
  const fd = fs.openSync(temp, 'w');
  try {
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, file);
  return sha256(text);
}

// Baseline por hash do snapshot: só vale a do mesmo snapshot e do mesmo axe (versão e tags)
const baselines = new Map();
const baselineKey = (snapshot) => `${snapshot.html_sha256}|${snapshot.har_sha256}`;
function findBaseline(snapshot) {
  const key = baselineKey(snapshot);
  if (baselines.has(key)) {
    return baselines.get(key);
  }
  const prefix = `${config.study}_baseline_sem-modelo_${snapshot.slug}_`;
  const candidates = fs.readdirSync(config.dirs.raw).filter((name) => name.startsWith(prefix) && name.endsWith('.json')).sort().reverse();
  for (const name of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(config.dirs.raw, name), 'utf8'));
      const sameSnapshot = raw.snapshot?.html_sha256 === snapshot.html_sha256 && raw.snapshot?.har_sha256 === snapshot.har_sha256;
      const sameAxe = raw.axe?.post?.engine?.version === versions.axeCore && JSON.stringify(raw.axe?.tags) === JSON.stringify(config.axe.tags);
      if (raw.status === 'ok' && sameSnapshot && sameAxe) {
        baselines.set(key, raw.axe.post);
        return raw.axe.post;
      }
    } catch (error) {
      // bruto ilegível: ignora este candidato
    }
  }
  return null;
}

function llmFailures(calls, aborted) {
  return aborted > 0 || calls.some((call) => call.error || call.networkError || call.parseError || (call.httpStatus && call.httpStatus >= 400));
}

async function runOnce(launched, condition, entry, snapshot, execution, adapter, holder) {
  const runId = `${config.study}_${condition.id}_${modelSlug(condition)}_${snapshot.slug}_run${execution}`;
  const raw = {
    runId,
    session: sessionId,
    condition,
    url: entry.url,
    estrato: entry.estrato,
    execution,
    snapshot: { dir: snapshot.dir, html_sha256: snapshot.html_sha256, har_sha256: snapshot.har_sha256, capturado_em: snapshot.capturado_em },
    startedAt: new Date().toISOString()
  };

  const opened = await openSnapshot(launched.context, snapshot, config);
  const { page } = opened;
  holder.page = page;

  try {
    const labelsBefore = await countGenericLabels(page);
    let driver = { status: 'ok', errors: [] };
    let llmCalls = [];
    let abortedCalls = 0;

    if (condition.driver === 'hook') {
      driver = await runHookDriver(page, condition, config, runId);
      llmCalls = driver.runLog?.llmCalls || [];
    } else if (condition.driver === 'panel-v1') {
      try {
        driver = await runPanelDriver(launched.context, launched.extensionId, launched.serviceWorker, page, config, () => adapter.begin(runId));
      } finally {
        const ended = await adapter.end();
        llmCalls = ended.calls;
        abortedCalls = ended.aborted;
        driver.llmCalls = llmCalls;
        driver.abortedLlmCalls = abortedCalls;
      }
    }
    raw.driver = driver;

    const scrollBeforeMeasure = await resetScroll(page, config.timeouts.settleMs);
    const post = await runAxe(page, config.axe.tags);
    const labelsAfter = await countGenericLabels(page);
    raw.genericLabels = diffGenericLabels(labelsBefore, labelsAfter);
    raw.axe = { tags: config.axe.tags, post };
    raw.domPost = await serializeDom(page);
    raw.replay = {
      abortedMain: opened.aborted.main,
      abortedFrames: opened.aborted.frames,
      counters: opened.counters,
      loadTimedOut: opened.loadTimedOut,
      compatModeMismatch: opened.compatModeMismatch,
      scrollBeforeMeasure
    };

    const baseline = condition.id === 'baseline' ? post : findBaseline(snapshot);
    raw.axe.newViolations = baseline && condition.id !== 'baseline' ? newViolations(baseline, post) : null;

    let status = driver.status === 'ok' ? 'ok' : (driver.status === 'parcial' ? 'parcial' : 'falha');
    // Mesmo critério de 'parcial' do gancho da v1.1.0: aplicou, mas alguma chamada falhou
    if (condition.driver === 'panel-v1' && status === 'ok' && llmFailures(llmCalls, abortedCalls)) {
      status = 'parcial';
    }
    raw.status = status;

    const ranPlugin = condition.driver !== 'none';
    const totals = llmCalls.reduce((sum, call) => ({
      tokensIn: sum.tokensIn + (call.tokensIn || 0),
      tokensOut: sum.tokensOut + (call.tokensOut || 0),
      latencyMs: sum.latencyMs + (call.latencyMs || 0)
    }), { tokensIn: 0, tokensOut: 0, latencyMs: 0 });

    const notes = [
      ...(driver.errors || []).map((error) => `${error.stage}: ${error.message}`),
      condition.id !== 'baseline' && !baseline ? 'sem baseline válido (mesmo snapshot e mesmo axe) para novos_erros_axe' : null,
      driver.staleJob?.stillRunningAtReset ? 'job anterior da v1.0.0 ainda rodando ao zerar (60 s)' : null,
      opened.loadTimedOut ? 'load do snapshot não terminou no prazo' : null,
      opened.compatModeMismatch ? `compatMode no replay: ${opened.compatModeMismatch}` : null,
      opened.counters.blockedNavigations ? `navegações bloqueadas no replay: ${opened.counters.blockedNavigations}` : null
    ].filter(Boolean);

    if (condition.id === 'baseline' && status === 'ok') {
      baselines.set(baselineKey(snapshot), post);
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
        axe_incomplete: post.incomplete,
        novos_erros_axe: raw.axe.newViolations ? raw.axe.newViolations.byTarget : '',
        novos_erros_axe_regra: raw.axe.newViolations ? Object.values(raw.axe.newViolations.byRule).reduce((sum, n) => sum + n, 0) : '',
        rotulos_genericos: raw.genericLabels.total,
        tokens_in: ranPlugin ? totals.tokensIn : '',
        tokens_out: ranPlugin ? totals.tokensOut : '',
        latencia_ms: ranPlugin ? totals.latencyMs : '',
        observacoes: notes.join(' | ')
      }
    };
  } finally {
    await page.close().catch(() => {});
    holder.page = null;
  }
}

/**
 * Uma tentativa com prazo total: se algo travar (renderer, evaluate sem fim), fecha a
 * página, o que derruba as chamadas pendentes, e registra a falha do harness.
 */
async function attemptWithWatchdog(launched, condition, entry, snapshot, execution, adapter) {
  const holder = { page: null };
  let timer;
  const watchdog = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      holder.page?.close().catch(() => {});
      reject(new Error(`harness: watchdog de ${config.timeouts.runWatchdogMs} ms`));
    }, config.timeouts.runWatchdogMs);
  });
  try {
    return await Promise.race([runOnce(launched, condition, entry, snapshot, execution, adapter, holder), watchdog]);
  } finally {
    clearTimeout(timer);
  }
}

function failureResult(condition, entry, snapshot, execution, message) {
  const slug = snapshot?.slug || slugForUrl(entry.url);
  const runId = `${config.study}_${condition.id}_${modelSlug(condition)}_${slug}_run${execution}`;
  return {
    raw: { runId, session: sessionId, condition, url: entry.url, execution, status: 'falha', error: message, snapshot: snapshot ? { dir: snapshot.dir, html_sha256: snapshot.html_sha256 } : null },
    row: { run_id: runId, status: 'falha', observacoes: message }
  };
}

function writeRun(condition, entry, snapshot, execution, launched, result, attempts, rawSha) {
  const row = {
    sessao: sessionId,
    url: entry.url,
    estrato: entry.estrato,
    data_coleta: snapshot?.capturado_em || '',
    condicao: condition.id,
    versao_plugin: launched?.extension ? (launched.extension.gitDescribe || launched.extension.version) : '',
    modelo: condition.model || '',
    model_digest: condition.model ? (session.ollama.digests?.[condition.model] || '') : '',
    execucao: execution,
    tentativas: attempts.length,
    snapshot_sha256: snapshot?.html_sha256 || '',
    raw_sha256: rawSha,
    ...result.row,
    observacoes: [
      result.row.observacoes,
      ...attempts.slice(0, -1).map((attempt, index) => `tentativa ${index + 1}: ${attempt.reason}`)
    ].filter(Boolean).join(' | ')
  };

  for (let tryNumber = 1; tryNumber <= 3; tryNumber++) {
    try {
      appendCsvRow(runsFile, RUN_COLUMNS, row);
      return;
    } catch (error) {
      if (tryNumber === 3) {
        session.harnessErrors.push({ at: new Date().toISOString(), runId: row.run_id, message: `CSV: ${error.message}` });
        appendCsvRow(pendingRunsFile, RUN_COLUMNS, row);
      }
    }
  }
}

async function openCondition(condition) {
  const launched = await launchCondition(condition, config);
  try {
    await configureExtensionStorage(launched.serviceWorker, condition, config);
    const adapter = condition.driver === 'panel-v1' ? await installProviderAdapter(launched.context, condition, config) : null;
    return { launched, adapter };
  } catch (error) {
    await launched.context.close().catch(() => {});
    throw error;
  }
}

for (const condition of conditions) {
  console.log(`\n== condição ${condition.id}`);
  let opened;
  try {
    opened = await openCondition(condition);
  } catch (error) {
    console.error(`  não foi possível abrir o navegador da condição: ${error.message}`);
    session.contexts[condition.id] = { error: error.message };
    saveSession();
    continue;
  }
  let { launched, adapter } = opened;
  const contextInfo = { browser: launched.browser, extension: launched.extension, relaunches: 0, ollamaContext: null };
  session.contexts[condition.id] = contextInfo;
  saveSession();

  const eligible = urls.filter((entry) => !condition.estratos || condition.estratos.includes(entry.estrato));
  for (const entry of eligible) {
    const snapshot = snapshots.get(entry.url);
    for (let execution = 1; execution <= executions; execution++) {
      const attempts = [];
      let result;
      let rawSha = '';

      if (!snapshot || snapshot.status !== 'ok') {
        result = failureResult(condition, entry, snapshot, execution, snapshot ? `snapshot com falha: ${snapshot.observacoes}` : 'sem snapshot capturado');
      } else if (!verifySnapshot(snapshot, config)) {
        result = failureResult(condition, entry, snapshot, execution, 'snapshot no disco diferente do índice (sha256)');
      }

      if (result) {
        rawSha = writeRawFile(`${result.raw.runId}__${sessionId}__a1.json`, result.raw);
        attempts.push({ reason: result.row.observacoes });
      } else {
        for (let attempt = 1; attempt <= 1 + config.retries; attempt++) {
          if (launched.state.closed) {
            // O navegador da condição caiu: relança, e a queda não conta como falha do plugin
            contextInfo.relaunches += 1;
            session.harnessErrors.push({ at: new Date().toISOString(), condition: condition.id, message: 'contexto caiu; relançado' });
            ({ launched, adapter } = await openCondition(condition));
          }
          try {
            result = await attemptWithWatchdog(launched, condition, entry, snapshot, execution, adapter);
          } catch (error) {
            result = failureResult(condition, entry, snapshot, execution, error.message.split('\n')[0]);
          }
          result.raw.attempt = attempt;
          rawSha = writeRawFile(`${result.raw.runId}__${sessionId}__a${attempt}.json`, result.raw);
          attempts.push({ reason: result.row.observacoes || result.row.status });
          if (result.row.status !== 'falha') {
            break;
          }
        }
      }

      // Contexto efetivo do modelo (D8), lido depois do primeiro run que chamou o LLM
      if (condition.model && !contextInfo.ollamaContext && Number(result.row.tokens_in) > 0) {
        const loaded = (await ollamaInfo(config.ollama.baseUrl)).loaded;
        const model = Array.isArray(loaded) ? loaded.find((item) => item.name === condition.model) : null;
        contextInfo.ollamaContext = model?.context_length ?? null;
        if (contextInfo.ollamaContext && contextInfo.ollamaContext !== config.ollama.expectedContextLength) {
          result.row.observacoes = [result.row.observacoes, `contexto do Ollama ${contextInfo.ollamaContext} (esperado ${config.ollama.expectedContextLength})`].filter(Boolean).join(' | ');
        }
      }

      writeRun(condition, entry, snapshot, execution, launched, result, attempts, rawSha);
      console.log(`  ${result.row.status.padEnd(7)} ${entry.url} (execução ${execution}${attempts.length > 1 ? `, ${attempts.length} tentativas` : ''})${result.row.observacoes ? ` — ${result.row.observacoes.slice(0, 160)}` : ''}`);
    }
  }

  if (adapter) {
    contextInfo.strayLlmCalls = adapter.takeStrayCalls();
  }
  await launched.context.close().catch(() => {});
  saveSession();
}

session.finishedAt = new Date().toISOString();
session.ollamaAfter = await ollamaInfo(config.ollama.baseUrl);
saveSession();
console.log(`\nsessão: ${sessionFile}`);
