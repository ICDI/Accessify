// Captura os snapshots congelados (decisão D4): para cada URL, o DOM renderizado sem
// scripts (com shadow DOM, CSSOM e estado de formulário), os iframes congelados do mesmo
// jeito e um HAR dos subrecursos, com uma linha no eval/snapshots/index.csv. Cada captura
// vai para uma pasta própria e só entra no índice como 'ok' depois de um replay offline
// que reproduz a página (comparação de tela e de texto com a captura).
// Uso: node src/capture.js [--estrato smoke] [--limit 3] [--url https://...]
//                          [--urls lista.csv] [--snapshots pasta]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadConfig, loadUrls, parseArgs } from './lib/config.js';
import { appendCsvRow } from './lib/csv.js';
import { sha256, sha256Dir, sha256File, slugForUrl } from './lib/hash.js';
import { withIoRetries } from './lib/io.js';
import {
  SNAPSHOT_EVIDENCE, SNAPSHOT_INDEX_COLUMNS, cleanHar, countRenderingAborts, freezeAnimations, openSnapshot, screenshotDiff,
  serializeDocumentInPage, settle, stripHash, textDifference
} from './lib/snapshot.js';

const args = parseArgs();
const config = loadConfig(args);
const indexFile = path.join(config.dirs.snapshots, 'index.csv');
// EVAL_DEBUG=1 mostra no stderr quanto cada etapa da captura levou
const debug = process.env.EVAL_DEBUG ? (url, label, since) => console.error(`  [${Math.round((Date.now() - since) / 1000)} s] ${label} — ${url}`) : () => {};
// Desafio anti-bot: um título de desafio conhecido, ou o padrão numa página quase sem texto,
// vira 'suspeito' (forte); o padrão numa página com conteúdo ("protegido por reCAPTCHA"
// perto de um formulário) só fica registrado (fraca)
const CHALLENGE_TITLE = /just a moment|attention required|verify you are human|are you a robot|verifique se você é humano/i;
const CHALLENGE_PATTERN = /just a moment|attention required|you have been blocked|access denied|verify you are human|are you a robot|captcha|verifique se você é humano|acesso negado/i;
const CHALLENGE_SHORT_TEXT = 1000;

let urls = loadUrls(args.urls);
if (urls.duplicates.length) {
  console.warn(`URLs em mais de uma linha (uma captura só): ${urls.duplicates.map((entry) => entry.url).join(', ')}`);
}
if (args.estrato) {
  urls = urls.filter((entry) => entry.estratos.includes(args.estrato));
}
if (args.url) {
  urls = urls.filter((entry) => entry.url === args.url);
}
if (args.limit) {
  urls = urls.slice(0, Number(args.limit));
}

/**
 * Requisições em voo desde antes da navegação (websocket e eventsource não contam:
 * ficam abertos para sempre).
 */
function trackNetwork(context) {
  const inflight = new Set();
  let lastChange = Date.now();
  const ignored = (request) => ['websocket', 'eventsource'].includes(request.resourceType());
  const onRequest = (request) => { if (!ignored(request)) { inflight.add(request); lastChange = Date.now(); } };
  const onDone = (request) => { inflight.delete(request); lastChange = Date.now(); };
  context.on('request', onRequest);
  context.on('requestfinished', onDone);
  context.on('requestfailed', onDone);
  return { isQuiet: (quietMs) => inflight.size === 0 && Date.now() - lastChange >= quietMs };
}

async function waitForQuiet(page, network, { quietMs, capMs }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < capMs && !network.isQuiet(quietMs)) {
    await page.waitForTimeout(100);
  }
}

/**
 * Espera o DOM parar de mudar (sem mutações por quietMs), com teto. Devolve quanto tempo
 * esperou e há quanto tempo foi a última mutação.
 */
async function waitForDomQuiet(page, quietMs, capMs) {
  return page.evaluate(({ quiet, cap }) => new Promise((resolve) => {
    const startedAt = performance.now();
    let lastMutation = startedAt;
    const observer = new MutationObserver(() => { lastMutation = performance.now(); });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    const timer = setInterval(() => {
      const now = performance.now();
      if (now - lastMutation >= quiet || now - startedAt >= cap) {
        clearInterval(timer);
        observer.disconnect();
        resolve({ waitedMs: Math.round(now - startedAt), lastMutationAgoMs: Math.round(now - lastMutation) });
      }
    }, 100);
  }), { quiet: quietMs, cap: capMs });
}

function baseRow(entry, browserVersion, userAgent) {
  const capturedAt = new Date().toISOString();
  const slug = slugForUrl(entry.url);
  return {
    slug,
    url: entry.url,
    dir: path.join(slug, capturedAt.replace(/[:.]/g, '-')).replace(/\\/g, '/'),
    capturado_em: capturedAt,
    navegador: browserVersion,
    user_agent: userAgent
  };
}

/**
 * Por que um replay não reproduz a captura. Vazio = reproduz.
 */
function replayProblems(row, replay) {
  const problems = [];
  if (replay.loadTimedOut) {
    problems.push('o load do replay não terminou');
  }
  if (replay.compatModeMismatch) {
    problems.push(`compatMode no replay: ${replay.compatModeMismatch}`);
  }
  if (row.replay_diff_pixels > config.replay.maxDiffPixels) {
    problems.push(`tela do replay difere da captura em ${(row.replay_diff_pixels * 100).toFixed(1)}% dos pixels`);
  }
  if (row.replay_diff_texto > config.replay.maxDiffTexto) {
    problems.push(`texto do replay difere da captura em ${(row.replay_diff_texto * 100).toFixed(1)}%`);
  }
  if (row.suspeita_desafio === 'forte') {
    problems.push('a página capturada parece um desafio anti-bot');
  }
  return problems;
}

/**
 * Captura uma URL e devolve a linha do índice (quem grava é o laço, uma vez por URL).
 * holder.context aponta para o contexto aberto, para o watchdog poder fechá-lo; depois de
 * holder.cancelled, nada mais é copiado para a pasta de snapshots.
 */
async function captureOne(browser, entry, userAgent, holder) {
  const row = baseRow(entry, browser.version(), userAgent);
  const finalDir = path.join(config.dirs.snapshots, row.dir);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `accessify-captura-${row.slug}-`));
  const notes = [];
  let liveText = '';
  const since = Date.now();

  try {
    const context = await browser.newContext({
      viewport: config.viewport,
      locale: config.locale,
      userAgent,
      recordHar: { path: path.join(workDir, 'page.har'), content: 'attach', mode: 'full' }
    });
    holder.context = context;
    try {
      const network = trackNetwork(context);
      const page = await context.newPage();
      const loadStartedAt = Date.now();
      const response = await page.goto(entry.url, { waitUntil: 'load', timeout: config.timeouts.navigationMs });
      row.status_http = response?.status() ?? '';
      row.final_url = stripHash(page.url());

      await waitForQuiet(page, network, { quietMs: config.timeouts.quietMs, capMs: config.timeouts.settleMs });
      const minimum = config.timeouts.minAfterLoadMs - (Date.now() - loadStartedAt);
      if (minimum > 0) {
        await page.waitForTimeout(minimum);
      }
      const dom = await waitForDomQuiet(page, config.timeouts.domQuietMs, config.timeouts.domQuietCapMs);
      await settle(page, config.timeouts.settleMs);
      row.espera_ms = Date.now() - loadStartedAt;
      row.ultima_mutacao_ms = dom.lastMutationAgoMs;
      debug(entry.url, 'página assentou', since);

      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      if (CHALLENGE_TITLE.test(title) || (CHALLENGE_PATTERN.test(`${title} ${bodyText}`) && bodyText.trim().length < CHALLENGE_SHORT_TEXT)) {
        row.suspeita_desafio = 'forte';
      } else if (CHALLENGE_PATTERN.test(`${title} ${bodyText.slice(0, 2000)}`)) {
        row.suspeita_desafio = 'fraca';
      }

      // As animações ficam no mesmo estado que o replay vai usar (finitas no fim, infinitas
      // no início), para a comparação de tela não acusar só a fase de uma animação. Depois,
      // o documento principal e a tela logo em seguida: um carrossel que gira entre as duas
      // coisas deixaria a tela da captura diferente do DOM congelado
      await freezeAnimations(page);
      await settle(page, config.timeouts.settleMs);
      const serialized = await page.evaluate(serializeDocumentInPage);
      await page.screenshot({ path: path.join(workDir, 'page.png'), fullPage: false });
      fs.writeFileSync(path.join(workDir, 'page.html'), serialized.html);
      liveText = serialized.bodyText;
      debug(entry.url, 'documento principal serializado', since);
      Object.assign(row, {
        compat_mode: serialized.compatMode,
        doctype: serialized.doctype ? 'sim' : 'nenhum',
        meta_refresh: serialized.metaRefresh,
        shadow_roots: serialized.shadowRoots,
        shadow_roots_perdidos: serialized.shadowRootsLost,
        cssom_sincronizados: serialized.cssomSynced,
        folhas_adotadas: serialized.adopted,
        noscript_esvaziados: serialized.noscriptEmptied,
        elementos_rolados: serialized.scrolledElements,
        charset: serialized.charset,
        urls_reescritas: serialized.urlsRewritten,
        marcas_carregamento: JSON.stringify(serialized.loadingMarkers)
      });
      if (serialized.trustedTypesFallback) {
        notes.push(`Trusted Types: documento principal clonado, ${serialized.shadowRootsLost} shadow roots perdidos`);
      }

      // Iframes congelados com a mesma rotina do documento principal. Cada um fica sob a
      // URL final do frame e sob o src do <iframe>: o replay pede o src, que difere da
      // URL final quando o embed redireciona ou troca a própria URL
      const frames = {};
      let framesWithoutUrl = 0;
      let framesLost = 0;
      fs.mkdirSync(path.join(workDir, 'frames'));
      for (const frame of page.frames()) {
        if (frame === page.mainFrame()) {
          continue;
        }
        const frameUrl = stripHash(frame.url());
        if (!/^https?:/.test(frameUrl)) {
          framesWithoutUrl++;
          continue;
        }
        try {
          const frameSerialized = await frame.evaluate(serializeDocumentInPage);
          const file = `${sha256(frameUrl).slice(0, 16)}.html`;
          fs.writeFileSync(path.join(workDir, 'frames', file), frameSerialized.html);
          frames[frameUrl] = file;
          const element = await frame.frameElement().catch(() => null);
          const src = element ? await element.evaluate((iframe) => iframe.src).catch(() => '') : '';
          if (/^https?:/.test(src) && stripHash(src) !== frameUrl) {
            frames[stripHash(src)] = file;
          }
          if (frameSerialized.trustedTypesFallback) {
            framesLost += frameSerialized.shadowRootsLost;
            notes.push(`Trusted Types: iframe clonado (${frameUrl}), ${frameSerialized.shadowRootsLost} shadow roots perdidos`);
          }
        } catch (error) {
          notes.push(`iframe não congelado (${frameUrl}): ${error.message.split('\n')[0]}`);
        }
      }
      fs.writeFileSync(path.join(workDir, 'frames.json'), JSON.stringify(frames, null, 2));
      debug(entry.url, `iframes congelados (${Object.keys(frames).length})`, since);
      row.frames_congelados = new Set(Object.values(frames)).size;
      row.frames_sem_url = framesWithoutUrl;
      row.shadow_roots_perdidos += framesLost;

      if (!response || !response.ok()) {
        throw new Error(`HTTP ${row.status_http}`);
      }
    } finally {
      // O HAR só é gravado quando o contexto fecha
      await context.close().catch(() => {});
    }

    if (holder.cancelled) {
      throw new Error('captura cancelada pelo watchdog');
    }
    debug(entry.url, 'HAR exportado', since);
    const har = cleanHar(path.join(workDir, 'page.har'), { documentCharset: row.charset });
    row.har_entradas = har.entries;
    row.har_descartadas = har.dropped;
    row.har_sem_corpo = har.withoutBody;
    row.har_css_charset = har.cssCharsetAdded;

    // Replay offline de verificação, igual ao do run (sem extensão)
    const replayContext = await browser.newContext({ viewport: config.viewport, locale: config.locale });
    holder.context = replayContext;
    let problems = [];
    try {
      const replay = await openSnapshot(replayContext, { ...row, absDir: workDir }, config);
      debug(entry.url, 'replay aberto', since);
      await replay.page.screenshot({ path: path.join(workDir, 'replay.png'), fullPage: false });
      row.replay_ok = replay.loadTimedOut ? 'load-sem-terminar' : 'sim';
      row.replay_abortados = countRenderingAborts(replay.aborted);
      row.frames_servidos = replay.counters.frozenFramesServed;
      row.frames_bloqueados = replay.counters.blockedFrames;
      row.replay_diff_pixels = Number((await screenshotDiff(replayContext, fs.readFileSync(path.join(workDir, 'page.png')), fs.readFileSync(path.join(workDir, 'replay.png')))).toFixed(4));
      row.replay_diff_texto = Number(textDifference(liveText, replay.bodyText).toFixed(4));
      problems = replayProblems(row, replay);
      // Iframe congelado que o replay não pediu (lazy fora da tela, por exemplo): só registro
      if (row.frames_servidos < row.frames_congelados) {
        notes.push(`${row.frames_congelados - row.frames_servidos} iframe(s) congelado(s) não pedido(s) no replay`);
      }
      debug(entry.url, 'replay comparado', since);
    } finally {
      await replayContext.close().catch(() => {});
    }

    if (holder.cancelled) {
      throw new Error('captura cancelada pelo watchdog');
    }
    fs.mkdirSync(path.dirname(finalDir), { recursive: true });
    fs.cpSync(workDir, finalDir, { recursive: true });
    row.html_sha256 = sha256File(path.join(finalDir, 'page.html'));
    row.har_sha256 = sha256File(path.join(finalDir, 'page.har'));
    row.pasta_sha256 = sha256Dir(finalDir, SNAPSHOT_EVIDENCE);
    row.html_bytes = fs.statSync(path.join(finalDir, 'page.html')).size;
    row.har_bytes = fs.statSync(path.join(finalDir, 'page.har')).size;
    // 'suspeito' fica no índice com a pasta, para revisão: o run não usa e diz por quê
    row.status = problems.length ? 'suspeito' : 'ok';
    notes.push(...problems);
  } catch (error) {
    row.status = 'falha';
    notes.push(error.message.split('\n')[0]);
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      // pasta temporária presa: fica no diretório temporário, a captura vale
    }
  }

  row.observacoes = notes.join(' | ');
  return row;
}

/**
 * Uma captura com prazo total: um frame preso num laço de JavaScript ou um evaluate sem
 * fim não pode parar a lista. O watchdog fecha o contexto aberto e a URL vira 'falha'.
 */
async function captureWithWatchdog(browser, entry, userAgent) {
  const holder = { context: null, cancelled: false };
  let timer;
  const watchdog = new Promise((resolve) => {
    timer = setTimeout(() => {
      holder.cancelled = true;
      holder.context?.close().catch(() => {});
      resolve(null);
    }, config.timeouts.captureMs);
  });
  try {
    const row = await Promise.race([captureOne(browser, entry, userAgent, holder), watchdog]);
    return row || { ...baseRow(entry, browser.version(), userAgent), status: 'falha', observacoes: `captura sem resposta em ${config.timeouts.captureMs} ms` };
  } finally {
    clearTimeout(timer);
  }
}

async function launchBrowser() {
  const browser = await chromium.launch({ channel: 'chromium', headless: config.headless });
  // User agent de Chrome comum: sites podem servir outra coisa a "HeadlessChrome"
  const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version().split('.')[0]}.0.0.0 Safari/537.36`;
  return { browser, userAgent };
}

let launched = null;
try {
  for (const entry of urls) {
    let row;
    if (entry.invalid) {
      row = { ...baseRow(entry, '', ''), status: 'falha', observacoes: `URL inválida: "${entry.url}"` };
    } else {
      try {
        // Navegador que caiu na URL anterior é relançado; se não abrir, a URL vira 'falha'
        if (!launched || !launched.browser.isConnected()) {
          launched = await launchBrowser();
        }
        row = await captureWithWatchdog(launched.browser, entry, launched.userAgent);
      } catch (error) {
        row = { ...baseRow(entry, '', ''), status: 'falha', observacoes: `navegador: ${error.message.split('\n')[0]}` };
      }
    }
    try {
      withIoRetries(() => appendCsvRow(indexFile, SNAPSHOT_INDEX_COLUMNS, row));
    } catch (error) {
      // Sem a linha no índice o run não usa a captura; a próxima URL segue
      console.error(`  índice não gravado para ${entry.url} (${row.dir}): ${error.message}`);
      process.exitCode = 1;
    }
    console.log(`${row.status.padEnd(8)} ${entry.url}${row.observacoes ? ` — ${row.observacoes}` : ''}`);
  }
} finally {
  await launched?.browser.close().catch(() => {});
}
