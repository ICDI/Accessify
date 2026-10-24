// Captura os snapshots congelados (decisão D4): para cada URL, o DOM renderizado sem
// scripts (com shadow DOM, CSSOM e estado de formulário), os iframes congelados do mesmo
// jeito e um HAR dos subrecursos, com uma linha no eval/snapshots/index.csv. Cada captura
// vai para uma pasta própria e só entra no índice como 'ok' depois de um replay offline.
// Uso: node src/capture.js [--estrato smoke] [--limit 3] [--url https://...]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadConfig, loadUrls, parseArgs } from './lib/config.js';
import { appendCsvRow } from './lib/csv.js';
import { sha256, sha256File, slugForUrl } from './lib/hash.js';
import { SNAPSHOT_INDEX_COLUMNS, cleanHar, countRenderingAborts, openSnapshot, serializeDocumentInPage, settle, stripHash } from './lib/snapshot.js';

const args = parseArgs();
const config = loadConfig();
const indexFile = path.join(config.dirs.snapshots, 'index.csv');
const CHALLENGE_PATTERN = /just a moment|attention required|you have been blocked|access denied|verify you are human|are you a robot|captcha|verifique se você é humano|acesso negado/i;

let urls = loadUrls();
if (args.estrato) {
  urls = urls.filter((entry) => entry.estrato === args.estrato);
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

async function captureOne(browser, entry, userAgent) {
  const slug = slugForUrl(entry.url);
  const capturedAt = new Date().toISOString();
  const relativeDir = path.join(slug, capturedAt.replace(/[:.]/g, '-'));
  const finalDir = path.join(config.dirs.snapshots, relativeDir);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `accessify-captura-${slug}-`));
  const row = { slug, url: entry.url, dir: relativeDir.replace(/\\/g, '/'), capturado_em: capturedAt, navegador: browser.version(), user_agent: userAgent };
  const notes = [];

  const context = await browser.newContext({
    viewport: config.viewport,
    locale: config.locale,
    userAgent,
    recordHar: { path: path.join(workDir, 'page.har'), content: 'attach', mode: 'full' }
  });

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

    const title = await page.title();
    const bodyText = await page.evaluate(() => (document.body?.innerText || '').slice(0, 2000));
    row.suspeita_desafio = CHALLENGE_PATTERN.test(`${title} ${bodyText}`) ? 'sim' : '';
    await page.screenshot({ path: path.join(workDir, 'page.png'), fullPage: false });

    // Iframes congelados com a mesma rotina do documento principal
    const frames = {};
    let framesWithoutUrl = 0;
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
        const serialized = await frame.evaluate(serializeDocumentInPage);
        const file = `${sha256(frameUrl).slice(0, 16)}.html`;
        fs.writeFileSync(path.join(workDir, 'frames', file), serialized.html);
        frames[frameUrl] = file;
      } catch (error) {
        notes.push(`iframe não congelado (${frameUrl}): ${error.message.split('\n')[0]}`);
      }
    }
    fs.writeFileSync(path.join(workDir, 'frames.json'), JSON.stringify(frames, null, 2));
    row.frames_congelados = Object.keys(frames).length;
    row.frames_sem_url = framesWithoutUrl;

    const serialized = await page.evaluate(serializeDocumentInPage);
    fs.writeFileSync(path.join(workDir, 'page.html'), serialized.html);
    Object.assign(row, {
      compat_mode: serialized.compatMode,
      doctype: serialized.doctype ? 'sim' : 'nenhum',
      meta_refresh: serialized.metaRefresh,
      shadow_roots: serialized.shadowRoots,
      cssom_sincronizados: serialized.cssomSynced,
      folhas_adotadas: serialized.adopted,
      marcas_carregamento: JSON.stringify(serialized.loadingMarkers)
    });

    if (!response || !response.ok()) {
      throw new Error(`HTTP ${row.status_http}`);
    }
  } catch (error) {
    row.status = 'falha';
    notes.push(error.message.split('\n')[0]);
  } finally {
    // O HAR só é gravado quando o contexto fecha
    await context.close().catch(() => {});
  }

  if (row.status !== 'falha') {
    try {
      const har = cleanHar(path.join(workDir, 'page.har'));
      row.har_entradas = har.entries;
      row.har_descartadas = har.dropped;

      // Replay offline de verificação, igual ao do run (sem extensão)
      const replayContext = await browser.newContext({ viewport: config.viewport, locale: config.locale });
      try {
        const replay = await openSnapshot(replayContext, { ...row, absDir: workDir }, config);
        await replay.page.screenshot({ path: path.join(workDir, 'replay.png'), fullPage: false });
        row.replay_ok = replay.loadTimedOut ? 'load-sem-terminar' : 'sim';
        row.replay_abortados = countRenderingAborts(replay.aborted);
        if (replay.compatModeMismatch) {
          notes.push(`compatMode no replay: ${replay.compatModeMismatch}`);
        }
      } finally {
        await replayContext.close().catch(() => {});
      }

      fs.mkdirSync(path.dirname(finalDir), { recursive: true });
      fs.cpSync(workDir, finalDir, { recursive: true });
      row.html_sha256 = sha256File(path.join(finalDir, 'page.html'));
      row.har_sha256 = sha256File(path.join(finalDir, 'page.har'));
      row.html_bytes = fs.statSync(path.join(finalDir, 'page.html')).size;
      row.har_bytes = fs.statSync(path.join(finalDir, 'page.har')).size;
      row.status = 'ok';
    } catch (error) {
      row.status = 'falha';
      notes.push(`replay de verificação: ${error.message.split('\n')[0]}`);
    }
  }

  fs.rmSync(workDir, { recursive: true, force: true });
  row.observacoes = notes.join(' | ');
  appendCsvRow(indexFile, SNAPSHOT_INDEX_COLUMNS, row);
  return row;
}

const browser = await chromium.launch({ channel: 'chromium', headless: config.headless });
// User agent de Chrome comum: sites podem servir outra coisa a "HeadlessChrome"
const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version().split('.')[0]}.0.0.0 Safari/537.36`;
try {
  for (const entry of urls) {
    try {
      const row = await captureOne(browser, entry, userAgent);
      console.log(`${row.status === 'ok' ? 'ok   ' : 'falha'} ${entry.url}${row.observacoes ? ` — ${row.observacoes}` : ''}`);
    } catch (error) {
      console.error(`falha ${entry.url} — ${error.message.split('\n')[0]}`);
    }
  }
} finally {
  await browser.close();
}
