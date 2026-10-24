import fs from 'node:fs';
import path from 'node:path';
import { readCsv } from './csv.js';
import { sha256Dir, sha256File } from './hash.js';

export const SNAPSHOT_INDEX_COLUMNS = [
  'slug', 'url', 'final_url', 'dir', 'status_http', 'capturado_em', 'status',
  'html_sha256', 'har_sha256', 'pasta_sha256', 'html_bytes', 'har_bytes', 'har_entradas', 'har_descartadas', 'har_sem_corpo',
  'frames_congelados', 'frames_sem_url', 'frames_servidos', 'frames_bloqueados', 'shadow_roots', 'shadow_roots_perdidos',
  'cssom_sincronizados', 'folhas_adotadas', 'noscript_esvaziados', 'charset', 'urls_reescritas',
  'compat_mode', 'doctype', 'meta_refresh', 'espera_ms', 'ultima_mutacao_ms', 'marcas_carregamento',
  'replay_ok', 'replay_abortados', 'replay_diff_pixels', 'replay_diff_texto', 'suspeita_desafio',
  'navegador', 'user_agent', 'observacoes'
];

// Política do replay: nenhum JavaScript da página (nem handlers inline, nem iframes). A
// extensão, o axe e o IBM rodam pelo CDP ou no mundo isolado e não são afetados.
const REPLAY_CSP = "script-src 'none'; object-src 'none'";

// Arquivos da pasta do snapshot que são só evidência visual e ficam fora do pasta_sha256
export const SNAPSHOT_EVIDENCE = (relative) => /\.png$/i.test(relative);

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
 * Roda dentro do navegador (frame.evaluate): precisa ser autocontida. Mexe no documento
 * ao vivo (estado de formulário, CSSOM, <noscript>), que é descartado depois da captura.
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
  const roots = [document, ...shadowRoots];

  // <noscript>: com scripts ligados (a captura) o conteúdo nunca aparece e é serializado
  // como texto cru. O reparse abaixo roda com scripts desligados e transformaria esse texto
  // em elementos: no <head>, eles fecham o head e vão para o <body> visível do replay
  // (a W3C BAD ganhava uma faixa vermelha que a página real não mostra). O replay também
  // roda com scripts ligados (a CSP não os desliga), então esvaziar não muda nada visível.
  let noscriptEmptied = 0;
  roots.forEach((root) => root.querySelectorAll('noscript').forEach((noscript) => {
    if (noscript.firstChild) {
      noscript.replaceChildren();
      noscriptEmptied++;
    }
  }));

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

  // O replay é servido em UTF-8. Numa página em outra codificação, a query de uma URL com
  // acento seria codificada de outro jeito e não bateria com o HAR: essas URLs viram a
  // forma absoluta já codificada que o navegador usou na captura.
  const charset = document.characterSet;
  let urlsRewritten = 0;
  if (!/^utf-8$/i.test(charset)) {
    roots.forEach((root) => root.querySelectorAll('[src], [href], [poster], [data], [action]').forEach((element) => {
      ['src', 'href', 'poster', 'data', 'action'].forEach((name) => {
        const value = element.getAttribute(name);
        // eslint-disable-next-line no-control-regex
        if (value && /[^\x00-\x7f]/.test(value) && typeof element[name] === 'string' && element[name]) {
          element.setAttribute(name, element[name]);
          urlsRewritten++;
        }
      });
    }));
  }

  // Regras inseridas pelo CSSOM (insertRule, CSS-in-JS) e folhas adotadas não aparecem
  // no HTML: viram <style> com o texto efetivo. A comparação é entre o CSSOM ao vivo e o
  // CSSOM que o próprio texto do <style> produz: a serialização do Chrome normaliza
  // (ponto e vírgula, comentários, cores em rgb), então comparar com o texto cru
  // reescreveria quase todo <style> sem necessidade.
  let cssomSynced = 0;
  let adopted = 0;
  const ruleTexts = (sheet) => Array.from(sheet.cssRules || [])
    .filter((rule) => !(typeof CSSImportRule !== 'undefined' && rule instanceof CSSImportRule))
    .map((rule) => rule.cssText);
  const cssText = (sheet) => Array.from(sheet.cssRules || []).map((rule) => rule.cssText).join('\n');
  roots.forEach((root) => {
    root.querySelectorAll('style').forEach((style) => {
      try {
        if (!style.sheet) {
          return;
        }
        const fromText = new CSSStyleSheet();
        // replaceSync ignora @import; as duas listas comparam sem eles
        fromText.replaceSync(style.textContent || '');
        if (ruleTexts(style.sheet).join('\n') !== ruleTexts(fromText).join('\n')) {
          style.textContent = cssText(style.sheet);
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
  const serialize = (rootElement, rootsToSerialize) => (typeof rootElement.getHTML === 'function'
    ? rootElement.getHTML({ serializableShadowRoots: true, shadowRoots: rootsToSerialize })
    : rootElement.innerHTML);
  const firstPass = `${doctype}<html${htmlAttributes}>${serialize(document.documentElement, shadowRoots)}</html>`;

  // Remove os scripts num documento reparseado (inclusive dentro de shadow roots
  // declarativos e templates), sem tocar na página ao vivo. Documentos com Trusted Types
  // obrigatório (ex.: embeds do YouTube) recusam o reparse com string: primeiro tenta uma
  // política própria; se a CSP da página também proibir políticas novas, vale o clone do
  // DOM, que perde o shadow DOM daquele documento (registrado em shadowRootsLost).
  const reparse = (markup) => (typeof Document.parseHTMLUnsafe === 'function'
    ? Document.parseHTMLUnsafe(markup)
    : new DOMParser().parseFromString(markup, 'text/html'));
  let parsed;
  let trustedTypesFallback = false;
  try {
    parsed = reparse(firstPass);
  } catch (error) {
    try {
      const policy = window.trustedTypes.createPolicy(`accessify-snapshot-${Date.now()}`, { createHTML: (markup) => markup });
      parsed = reparse(policy.createHTML(firstPass));
    } catch (policyError) {
      trustedTypesFallback = true;
      parsed = document.implementation.createHTMLDocument('');
      parsed.replaceChild(document.documentElement.cloneNode(true), parsed.documentElement);
    }
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
    charset,
    urlsRewritten,
    noscriptEmptied,
    metaRefresh: refresh ? refresh.getAttribute('content') || '' : '',
    shadowRoots: shadowRoots.length,
    shadowRootsLost: trustedTypesFallback ? shadowRoots.length : 0,
    cssomSynced,
    adopted,
    bodyTextLength: (document.body?.innerText || '').length,
    loadingMarkers: {
      ariaBusy: document.querySelectorAll('[aria-busy="true"]').length,
      infiniteAnimations,
      skeleton: document.querySelectorAll('[class*="skeleton"], [class*="shimmer"]').length
    }
  };
}

/**
 * Tira do HAR as entradas que o replay não consegue responder: requisição abortada na
 * captura (status <= 0 ou _failureText), resposta 2xx/4xx/5xx sem corpo gravado (o corpo
 * não foi lido, ou ainda chegava quando o HAR foi exportado; o replay serviria um 200
 * vazio, sem contar como abortado) e as duplicadas por método + URL (fica a primeira).
 * Sem isso, uma entrada abortada fica pendurada no replay e a página nunca termina de
 * carregar, e uma sem corpo vira folha de estilo ou imagem vazia sem aviso.
 */
export function cleanHar(harFile) {
  const har = JSON.parse(fs.readFileSync(harFile, 'utf8'));
  const seen = new Set();
  const before = har.log.entries.length;
  let withoutBody = 0;
  har.log.entries = har.log.entries.filter((entry) => {
    const response = entry.response;
    if (!response || response.status <= 0 || response._failureText) {
      return false;
    }
    const content = response.content || {};
    const bodyless = [204, 205, 304].includes(response.status) || (response.status >= 300 && response.status < 400);
    if (!bodyless && content.size === -1 && !content._file && content.text === undefined) {
      withoutBody++;
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
  return { entries: har.log.entries.length, dropped: before - har.log.entries.length, withoutBody };
}

/**
 * Snapshot em uso para cada URL: a captura 'ok' mais recente do índice (append-only). Sem
 * nenhuma 'ok', vale a última linha (falha ou suspeito), para o run dizer o motivo.
 */
export function latestSnapshots(snapshotsDir) {
  const latest = new Map();
  readCsv(path.join(snapshotsDir, 'index.csv')).forEach((row) => {
    if (row.status === 'ok' || latest.get(row.url)?.status !== 'ok') {
      latest.set(row.url, row);
    }
  });
  return latest;
}

const verifiedSnapshots = new Map();

/**
 * Confere uma vez por lote que a pasta do snapshot é a do índice: page.html, page.har e,
 * quando o índice tem, a pasta inteira (iframes congelados e arquivos de recurso do HAR),
 * fora as capturas de tela.
 */
export function verifySnapshot(snapshot, config) {
  const key = `${snapshot.dir}|${snapshot.html_sha256}|${snapshot.har_sha256}|${snapshot.pasta_sha256 || ''}`;
  if (!verifiedSnapshots.has(key)) {
    const dir = path.join(config.dirs.snapshots, snapshot.dir);
    let ok = false;
    try {
      ok = sha256File(path.join(dir, 'page.html')) === snapshot.html_sha256
        && sha256File(path.join(dir, 'page.har')) === snapshot.har_sha256
        && (!snapshot.pasta_sha256 || sha256Dir(dir, SNAPSHOT_EVIDENCE) === snapshot.pasta_sha256);
    } catch (error) {
      ok = false;
    }
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
 * Deixa o estado das animações igual em todas as condições: no replay as animações CSS
 * recomeçam do zero, e a baseline mede segundos depois do load enquanto as condições com
 * plugin medem minutos depois. As finitas (entrada, transições) vão para o estado final,
 * que é o que a captura viu depois de esperar o DOM assentar; as infinitas (spinners,
 * carrosséis em CSS) param no início. Em todos os frames.
 */
export async function freezeAnimations(page) {
  const total = { finished: 0, paused: 0, framesSkipped: 0 };
  for (const frame of page.frames()) {
    // Um iframe cuja navegação foi bloqueada pode nunca ganhar contexto de execução, e o
    // evaluate esperaria para sempre: cada frame tem 3 s
    let timer;
    const skip = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), 3000);
    });
    try {
      const result = await Promise.race([skip, frame.evaluate(() => {
        let finished = 0;
        let paused = 0;
        (document.getAnimations ? document.getAnimations() : []).forEach((animation) => {
          try {
            const timing = animation.effect?.getComputedTiming?.();
            if (!timing || timing.endTime === Infinity || timing.iterations === Infinity) {
              animation.pause();
              animation.currentTime = 0;
              paused++;
            } else {
              animation.finish();
              finished++;
            }
          } catch (error) {
            // animação que não aceita o comando: segue como está
          }
        });
        return { finished, paused };
      })]);
      if (result) {
        total.finished += result.finished;
        total.paused += result.paused;
      } else {
        total.framesSkipped++;
      }
    } catch (error) {
      // frame sem acesso (outra origem bloqueada) ou já fechado
      total.framesSkipped++;
    } finally {
      clearTimeout(timer);
    }
  }
  return total;
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

    // As rotas registradas por último são consultadas primeiro
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
    // Documento principal e iframes congelados (pela URL final do frame ou pelo src)
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
    const animations = await freezeAnimations(page);

    if (counters.mainServed !== 1) {
      throw new Error('O documento principal não veio do snapshot congelado.');
    }
    const state = await page.evaluate(() => ({ compatMode: document.compatMode, bodyTextLength: (document.body?.innerText || '').length }));

    return {
      page,
      aborted,
      counters,
      loadTimedOut,
      animations,
      bodyTextLength: state.bodyTextLength,
      compatModeMismatch: snapshot.compat_mode && state.compatMode !== snapshot.compat_mode ? `${snapshot.compat_mode} → ${state.compatMode}` : null
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

const SCROLL_KEY = 'accessify-eval-scroll';

/**
 * Guarda a posição de rolagem de cada elemento rolável antes do driver (inclusive dentro
 * de shadow roots), para resetScroll devolver o mesmo estado depois.
 */
export async function recordScroll(page) {
  return page.evaluate((key) => {
    const saved = new Map();
    const walk = (root) => root.querySelectorAll('*').forEach((element) => {
      if (element.scrollTop || element.scrollLeft) {
        saved.set(element, [element.scrollTop, element.scrollLeft]);
      }
      if (element.shadowRoot) {
        walk(element.shadowRoot);
      }
    });
    walk(document);
    window[Symbol.for(key)] = saved;
    return saved.size;
  }, SCROLL_KEY);
}

/**
 * Volta a rolagem ao estado de antes do driver e congela as animações de novo antes de
 * medir: o caminho de visão da v1.1.0 chama scrollIntoView, que rola a janela e todo
 * contêiner rolável acima da imagem (inclusive o viewport de um carrossel com overflow
 * hidden), e cabeçalhos fixos, imagens lazy e slides mudariam o que o axe vê.
 */
export async function resetScroll(page, timeoutMs) {
  const before = await page.evaluate((key) => {
    const saved = window[Symbol.for(key)] || new Map();
    let elementsRestored = 0;
    const walk = (root) => root.querySelectorAll('*').forEach((element) => {
      const [top, left] = saved.get(element) || [0, 0];
      if (element.scrollTop !== top || element.scrollLeft !== left) {
        element.scrollTop = top;
        element.scrollLeft = left;
        elementsRestored++;
      }
      if (element.shadowRoot) {
        walk(element.shadowRoot);
      }
    });
    const windowScroll = { x: window.scrollX, y: window.scrollY };
    walk(document);
    window.scrollTo(0, 0);
    return { ...windowScroll, elementsRestored };
  }, SCROLL_KEY);
  const animations = await freezeAnimations(page);
  await settle(page, timeoutMs);
  return { ...before, animations };
}

/**
 * Fração de pixels diferentes entre duas capturas de tela PNG do mesmo tamanho (1 se o
 * tamanho for outro). Decodifica no próprio navegador (sem dependência de PNG no Node).
 */
export async function screenshotDiff(context, pngA, pngB) {
  const page = await context.newPage();
  try {
    return await page.evaluate(async ([a, b]) => {
      const load = (src) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('PNG ilegível'));
        image.src = src;
      });
      const [first, second] = await Promise.all([load(a), load(b)]);
      if (first.naturalWidth !== second.naturalWidth || first.naturalHeight !== second.naturalHeight) {
        return 1;
      }
      const canvas = new OffscreenCanvas(first.naturalWidth, first.naturalHeight);
      const context2d = canvas.getContext('2d', { willReadFrequently: true });
      const pixels = (image) => {
        context2d.clearRect(0, 0, canvas.width, canvas.height);
        context2d.drawImage(image, 0, 0);
        return context2d.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const left = pixels(first);
      const right = pixels(second);
      let different = 0;
      for (let i = 0; i < left.length; i += 4) {
        if (Math.abs(left[i] - right[i]) + Math.abs(left[i + 1] - right[i + 1]) + Math.abs(left[i + 2] - right[i + 2]) > 48) {
          different++;
        }
      }
      return different / (left.length / 4);
    }, [`data:image/png;base64,${pngA.toString('base64')}`, `data:image/png;base64,${pngB.toString('base64')}`]);
  } finally {
    await page.close().catch(() => {});
  }
}
