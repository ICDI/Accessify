import fs from 'node:fs';
import path from 'node:path';
import { readCsv } from './csv.js';
import { sha256File } from './hash.js';

export const SNAPSHOT_INDEX_COLUMNS = [
  'slug', 'url', 'final_url', 'dir', 'status_http', 'capturado_em', 'status',
  'html_sha256', 'har_sha256', 'html_bytes', 'har_bytes', 'har_entradas', 'har_descartadas',
  'frames_congelados', 'frames_sem_url', 'shadow_roots', 'cssom_sincronizados', 'folhas_adotadas',
  'compat_mode', 'doctype', 'meta_refresh', 'espera_ms', 'ultima_mutacao_ms', 'marcas_carregamento',
  'replay_ok', 'replay_abortados', 'suspeita_desafio', 'navegador', 'user_agent', 'observacoes'
];

// Política do replay: nenhum JavaScript da página (nem handlers inline, nem iframes). A
// extensão, o axe e o IBM rodam pelo CDP ou no mundo isolado e não são afetados.
const REPLAY_CSP = "script-src 'none'; object-src 'none'";

export const stripHash = (url) => {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch (error) {
    return url;
  }
};

/**
 * Serializa o documento do frame onde roda (página ou iframe), para o snapshot congelado.
 * Roda dentro do navegador (frame.evaluate): precisa ser autocontida.
 */
export function serializeDocumentInPage() {
  const shadowRoots = [];
  const collectShadowRoots = (root) => {
    root.querySelectorAll('*').forEach((element) => {
      if (element.shadowRoot) {
        shadowRoots.push(element.shadowRoot);
        collectShadowRoots(element.shadowRoot);
      }
    });
  };
  collectShadowRoots(document);

  // Estado de formulário definido por script não vai para o HTML: vira atributo
  document.querySelectorAll('input').forEach((input) => {
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.toggleAttribute('checked', input.checked);
    } else if (input.type !== 'password' && input.type !== 'file') {
      input.setAttribute('value', input.value);
    }
  });
  document.querySelectorAll('textarea').forEach((textarea) => { textarea.textContent = textarea.value; });
  document.querySelectorAll('option').forEach((option) => option.toggleAttribute('selected', option.selected));

  // Regras inseridas pelo CSSOM (insertRule, CSS-in-JS) e folhas adotadas não aparecem
  // no HTML: viram <style> com o texto efetivo
  let cssomSynced = 0;
  let adopted = 0;
  const cssText = (sheet) => Array.from(sheet.cssRules || []).map((rule) => rule.cssText).join('\n');
  [document, ...shadowRoots].forEach((root) => {
    root.querySelectorAll('style').forEach((style) => {
      try {
        if (!style.sheet) {
          return;
        }
        const effective = cssText(style.sheet);
        if (effective.replace(/\s+/g, '') !== (style.textContent || '').replace(/\s+/g, '')) {
          style.textContent = effective;
          cssomSynced++;
        }
      } catch (error) {
        // folha inacessível: fica como está
      }
    });
    (root.adoptedStyleSheets || []).forEach((sheet) => {
      try {
        const style = document.createElement('style');
        style.setAttribute('data-snapshot-adopted', '');
        style.textContent = cssText(sheet);
        (root === document ? document.head || document.documentElement : root).appendChild(style);
        adopted++;
      } catch (error) {
        // folha inacessível: fica de fora
      }
    });
  });

  const doctype = document.doctype ? new XMLSerializer().serializeToString(document.doctype) : '';
  const htmlAttributes = Array.from(document.documentElement.attributes)
    .map((attribute) => ` ${attribute.name}="${attribute.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join('');
  const serialize = (rootElement, roots) => (typeof rootElement.getHTML === 'function'
    ? rootElement.getHTML({ serializableShadowRoots: true, shadowRoots: roots })
    : rootElement.innerHTML);
  const firstPass = `${doctype}<html${htmlAttributes}>${serialize(document.documentElement, shadowRoots)}</html>`;

  // Remove os scripts num documento reparseado (inclusive dentro de shadow roots
  // declarativos e templates), sem tocar na página ao vivo. Documentos com Trusted Types
  // obrigatório (ex.: embeds do YouTube) recusam o reparse: aí vale o clone do DOM, que
  // perde só o shadow DOM daquele documento.
  let parsed;
  let trustedTypesFallback = false;
  try {
    parsed = typeof Document.parseHTMLUnsafe === 'function'
      ? Document.parseHTMLUnsafe(firstPass)
      : new DOMParser().parseFromString(firstPass, 'text/html');
  } catch (error) {
    trustedTypesFallback = true;
    parsed = document.implementation.createHTMLDocument('');
    parsed.replaceChild(document.documentElement.cloneNode(true), parsed.documentElement);
  }
  const parsedRoots = [];
  const collectParsed = (root) => {
    root.querySelectorAll('*').forEach((element) => {
      if (element.shadowRoot) {
        parsedRoots.push(element.shadowRoot);
        collectParsed(element.shadowRoot);
      }
    });
  };
  collectParsed(parsed);
  const removeScripts = (root) => {
    root.querySelectorAll('script').forEach((script) => script.remove());
    root.querySelectorAll('template').forEach((template) => removeScripts(template.content));
  };
  [parsed, ...parsedRoots].forEach(removeScripts);

  const head = parsed.head || parsed.documentElement.insertBefore(parsed.createElement('head'), parsed.documentElement.firstChild);
  if (!head.querySelector('base')) {
    const base = parsed.createElement('base');
    base.setAttribute('href', location.href);
    head.insertBefore(base, head.firstChild);
  }

  const refresh = Array.from(parsed.querySelectorAll('meta[http-equiv]'))
    .find((meta) => meta.getAttribute('http-equiv').toLowerCase() === 'refresh');
  const parsedAttributes = Array.from(parsed.documentElement.attributes)
    .map((attribute) => ` ${attribute.name}="${attribute.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join('');

  const infiniteAnimations = (document.getAnimations ? document.getAnimations() : [])
    .filter((animation) => animation.effect?.getTiming?.().iterations === Infinity).length;

  const body = trustedTypesFallback ? parsed.documentElement.innerHTML : serialize(parsed.documentElement, parsedRoots);
  return {
    html: `${doctype}${doctype ? '\n' : ''}<html${parsedAttributes}>${body}</html>`,
    trustedTypesFallback,
    doctype,
    compatMode: document.compatMode,
    metaRefresh: refresh ? refresh.getAttribute('content') || '' : '',
    shadowRoots: shadowRoots.length,
    cssomSynced,
    adopted,
    loadingMarkers: {
      ariaBusy: document.querySelectorAll('[aria-busy="true"]').length,
      infiniteAnimations,
      skeleton: document.querySelectorAll('[class*="skeleton"], [class*="shimmer"]').length
    }
  };
}

/**
 * Tira do HAR as entradas que o replay não consegue responder (requisição abortada na
 * captura, status <= 0) e as duplicadas por método + URL (fica a primeira completa).
 * Sem isso, uma entrada abortada fica pendurada no replay e a página nunca termina de
 * carregar.
 */
export function cleanHar(harFile) {
  const har = JSON.parse(fs.readFileSync(harFile, 'utf8'));
  const seen = new Set();
  const before = har.log.entries.length;
  har.log.entries = har.log.entries.filter((entry) => {
    if (!entry.response || entry.response.status <= 0 || entry.response._failureText) {
      return false;
    }
    const key = `${entry.request.method} ${entry.request.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  fs.writeFileSync(harFile, JSON.stringify(har));
  return { entries: har.log.entries.length, dropped: before - har.log.entries.length };
}

/**
 * Snapshot em uso para cada URL: a captura 'ok' mais recente do índice (append-only).
 */
export function latestSnapshots(snapshotsDir) {
  const latest = new Map();
  readCsv(path.join(snapshotsDir, 'index.csv')).forEach((row) => {
    if (row.status === 'ok' || !latest.has(row.url)) {
      latest.set(row.url, row);
    }
  });
  return latest;
}

const verifiedSnapshots = new Map();

/**
 * Confere uma vez por lote que page.html e page.har são os do índice.
 */
export function verifySnapshot(snapshot, config) {
  const key = `${snapshot.dir}|${snapshot.html_sha256}|${snapshot.har_sha256}`;
  if (!verifiedSnapshots.has(key)) {
    const dir = path.join(config.dirs.snapshots, snapshot.dir);
    const ok = fs.existsSync(path.join(dir, 'page.html'))
      && fs.existsSync(path.join(dir, 'page.har'))
      && sha256File(path.join(dir, 'page.html')) === snapshot.html_sha256
      && sha256File(path.join(dir, 'page.har')) === snapshot.har_sha256;
    verifiedSnapshots.set(key, ok);
  }
  return verifiedSnapshots.get(key);
}

/**
 * Espera a página assentar: fontes e dois frames de renderização, com teto.
 */
export async function settle(page, timeoutMs) {
  await page.evaluate(async (limit) => {
    const withTimeout = (promise) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, limit))]);
    if (document.fonts?.ready) {
      await withTimeout(document.fonts.ready);
    }
    await withTimeout(new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }, Math.min(timeoutMs, 3000));
}

/**
 * Abre o snapshot congelado numa aba nova (decisão D4). O documento principal e os
 * iframes congelados vêm do disco com uma CSP que proíbe qualquer script da página; os
 * subrecursos vêm do HAR da captura (o que não estiver lá é abortado e contado); iframes
 * que não foram congelados são bloqueados. Só a primeira navegação do frame principal é
 * atendida (um meta refresh não troca a página no meio do run). As rotas são da página:
 * o service worker da extensão continua falando com o Ollama.
 */
export async function openSnapshot(context, snapshot, config) {
  // absDir: pasta da captura em andamento (replay de verificação do capture.js)
  const dir = snapshot.absDir || path.join(config.dirs.snapshots, snapshot.dir);
  const html = fs.readFileSync(path.join(dir, 'page.html'));
  const framesFile = path.join(dir, 'frames.json');
  const frameMap = fs.existsSync(framesFile) ? JSON.parse(fs.readFileSync(framesFile, 'utf8')) : {};
  const mainUrl = stripHash(snapshot.final_url);
  const counters = { mainServed: 0, blockedNavigations: 0, blockedFrames: 0, frozenFramesServed: 0 };
  const aborted = { main: [], frames: [] };

  const page = await context.newPage();
  try {
    page.on('requestfailed', (request) => {
      if (stripHash(request.url()) !== mainUrl) {
        const entry = { url: request.url(), type: request.resourceType(), error: request.failure()?.errorText || null };
        (request.frame() === page.mainFrame() ? aborted.main : aborted.frames).push(entry);
      }
    });

    await page.routeFromHAR(path.join(dir, 'page.har'), { notFound: 'abort' });
    // Iframes não congelados não carregam (o JS de terceiros deles não é determinístico)
    await page.route('**/*', (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() !== page.mainFrame() && !frameMap[stripHash(request.url())]) {
        counters.blockedFrames++;
        return route.abort('blockedbyclient');
      }
      return route.fallback();
    });
    // Registrada por último, tem prioridade: documento principal e iframes congelados
    await page.route((url) => stripHash(url.href) === mainUrl || !!frameMap[stripHash(url.href)], (route) => {
      const request = route.request();
      if (!request.isNavigationRequest()) {
        return route.fallback();
      }
      if (request.frame() === page.mainFrame()) {
        if (counters.mainServed > 0) {
          counters.blockedNavigations++;
          return route.abort('aborted');
        }
        counters.mainServed++;
        return route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': REPLAY_CSP }, body: html });
      }
      const file = frameMap[stripHash(request.url())];
      if (file) {
        counters.frozenFramesServed++;
        return route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': REPLAY_CSP },
          body: fs.readFileSync(path.join(dir, 'frames', file))
        });
      }
      return route.fallback();
    });

    await page.goto(snapshot.final_url, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigationMs });
    const loadTimedOut = await page.waitForLoadState('load', { timeout: config.timeouts.settleMs }).then(() => false, () => true);
    await settle(page, config.timeouts.settleMs);

    if (counters.mainServed !== 1) {
      throw new Error('O documento principal não veio do snapshot congelado.');
    }
    const compatMode = await page.evaluate(() => document.compatMode);

    return {
      page,
      aborted,
      counters,
      loadTimedOut,
      compatModeMismatch: snapshot.compat_mode && compatMode !== snapshot.compat_mode ? `${snapshot.compat_mode} → ${compatMode}` : null
    };
  } catch (error) {
    await page.close().catch(() => {});
    throw error;
  }
}

/**
 * Requisições abortadas no replay que poderiam mudar o que o axe vê. Scripts ficam de
 * fora (a CSP do replay não os executaria de qualquer jeito, e os <link rel="preload">
 * deles continuam no DOM), e navegações de iframe também (são os iframes não congelados,
 * contados em counters.blockedFrames).
 */
export function countRenderingAborts(aborted) {
  return [...aborted.main, ...aborted.frames].filter((entry) => entry.type !== 'script' && entry.type !== 'document').length;
}

/**
 * Volta a página ao topo antes de medir: o caminho de visão da v1.1.0 rola até as
 * imagens, e cabeçalhos fixos e imagens lazy mudariam o que o axe vê.
 */
export async function resetScroll(page, timeoutMs) {
  const before = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, timeoutMs);
  return before;
}
