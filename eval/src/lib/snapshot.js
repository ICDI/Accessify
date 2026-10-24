import fs from 'node:fs';
import path from 'node:path';
import { readCsv } from './csv.js';
import { sha256Dir, sha256File } from './hash.js';

export const SNAPSHOT_INDEX_COLUMNS = [
  'slug', 'url', 'final_url', 'dir', 'status_http', 'capturado_em', 'status',
  'html_sha256', 'har_sha256', 'pasta_sha256', 'html_bytes', 'har_bytes', 'har_entradas', 'har_descartadas', 'har_sem_corpo',
  'har_css_charset', 'frames_congelados', 'frames_sem_url', 'frames_servidos', 'frames_bloqueados', 'shadow_roots',
  'shadow_roots_perdidos', 'cssom_sincronizados', 'folhas_adotadas', 'noscript_esvaziados', 'elementos_rolados', 'charset', 'urls_reescritas',
  'compat_mode', 'doctype', 'meta_refresh', 'espera_ms', 'ultima_mutacao_ms', 'marcas_carregamento',
  'replay_ok', 'replay_abortados', 'replay_diff_pixels', 'replay_diff_texto', 'suspeita_desafio',
  'navegador', 'user_agent', 'observacoes'
];

// Política do replay: nenhum JavaScript da página (nem handlers inline, nem iframes). A
// extensão, o axe e o IBM rodam pelo CDP ou no mundo isolado e não são afetados.
const REPLAY_CSP = "script-src 'none'; object-src 'none'";

// As duas capturas de tela da pasta do snapshot são só evidência visual e ficam fora do
// pasta_sha256 (os .png do HAR, recursos da página, entram)
export const SNAPSHOT_EVIDENCE = (relative) => relative === 'page.png' || relative === 'replay.png';

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
  // Num frame com scripts desligados (iframe sandbox sem allow-scripts) o conteúdo foi
  // parseado como elementos e aparece: esse fica.
  let noscriptEmptied = 0;
  roots.forEach((root) => root.querySelectorAll('noscript').forEach((noscript) => {
    if (noscript.firstChild && Array.from(noscript.childNodes).every((node) => node.nodeType === Node.TEXT_NODE)) {
      noscript.replaceChildren();
      noscriptEmptied++;
    }
  }));

  // Rolagem de contêineres feita por script (carrossel na 3ª imagem, lista rolada) não vai
  // para o HTML: fica num atributo que o replay aplica e remove antes de qualquer medição.
  // A janela entra como atributo do <html>
  let scrolledElements = 0;
  roots.forEach((root) => root.querySelectorAll('*').forEach((element) => {
    if (element !== document.documentElement && element !== document.body && (element.scrollTop || element.scrollLeft)) {
      element.setAttribute('data-accessify-scroll', `${element.scrollTop},${element.scrollLeft}`);
      scrolledElements++;
    }
  }));
  if (window.scrollX || window.scrollY) {
    document.documentElement.setAttribute('data-accessify-window-scroll', `${window.scrollY},${window.scrollX}`);
  }

  // Estado de formulário definido por script não vai para o HTML: vira atributo
  // Só os tipos em que o valor digitado pode diferir do atributo. Em submit, reset,
  // button, image e hidden o .value é o próprio atributo ('' quando não há): gravar
  // value="" num <input type=submit> sem value apagaria o rótulo padrão do navegador
  // ("Enviar") e criaria uma violação crítica (input-button-name) que a página não tem
  const VALUE_FROM_ATTRIBUTE = ['submit', 'reset', 'button', 'image', 'hidden', 'password', 'file'];
  document.querySelectorAll('input').forEach((input) => {
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.toggleAttribute('checked', input.checked);
    } else if (!VALUE_FROM_ATTRIBUTE.includes(input.type)) {
      input.setAttribute('value', input.value);
    }
  });
  document.querySelectorAll('textarea').forEach((textarea) => { textarea.textContent = textarea.value; });
  document.querySelectorAll('option').forEach((option) => option.toggleAttribute('selected', option.selected));

  // O replay é servido em UTF-8. Numa página em outra codificação, a query de uma URL com
  // acento seria codificada de outro jeito e não bateria com o HAR: essas URLs viram a
  // forma absoluta já codificada que o navegador usou na captura (um <a> fora do DOM
  // resolve com a codificação do documento). Atributos, srcset, href de SVG e url() de
  // estilos. Nada muda no DOM ao vivo (trocar o src de um iframe o recarregaria): o valor
  // novo vai num atributo marcador, aplicado só na cópia reparseada.
  const charset = document.characterSet;
  let urlsRewritten = 0;
  const URL_MARK = 'data-accessify-url-';
  // eslint-disable-next-line no-control-regex
  const nonAscii = /[^\x00-\x7f]/;
  const legacyCharset = !/^utf-8$/i.test(charset);
  const resolver = document.createElement('a');
  const encodeUrl = (value) => {
    resolver.setAttribute('href', value.trim());
    return resolver.href;
  };
  const encodeCss = (css) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, url) => (nonAscii.test(url) ? `url("${encodeUrl(url)}")` : match));
  if (legacyCharset) {
    roots.forEach((root) => root.querySelectorAll('*').forEach((element) => {
      ['src', 'href', 'poster', 'data', 'action', 'xlink:href'].forEach((name) => {
        const value = element.getAttribute(name);
        if (value && nonAscii.test(value)) {
          element.setAttribute(`${URL_MARK}${name.replace(':', '-')}`, encodeUrl(value));
          urlsRewritten++;
        }
      });
      const srcset = element.getAttribute('srcset');
      if (srcset && nonAscii.test(srcset)) {
        element.setAttribute(`${URL_MARK}srcset`, srcset.split(',').map((candidate) => {
          const [url, ...descriptors] = candidate.trim().split(/\s+/);
          return [nonAscii.test(url) ? encodeUrl(url) : url, ...descriptors].join(' ');
        }).join(', '));
        urlsRewritten++;
      }
      const style = element.getAttribute('style');
      if (style && nonAscii.test(style)) {
        element.setAttribute(`${URL_MARK}style`, encodeCss(style));
        urlsRewritten++;
      }
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

  // url() com acento nos <style> (depois da sincronização do CSSOM, que pode ter trocado o
  // texto): o texto codificado também vai num marcador
  if (legacyCharset) {
    roots.forEach((root) => root.querySelectorAll('style').forEach((style) => {
      if (nonAscii.test(style.textContent || '')) {
        const encoded = encodeCss(style.textContent);
        if (encoded !== style.textContent) {
          style.setAttribute(`${URL_MARK}css`, encoded);
          urlsRewritten++;
        }
      }
    }));
  }

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

  // Marcadores de URL codificada viram o atributo (ou o texto do <style>) na cópia
  const applyUrlMarks = (root) => {
    root.querySelectorAll('*').forEach((element) => {
      Array.from(element.attributes).filter((attribute) => attribute.name.startsWith(URL_MARK)).forEach((attribute) => {
        const name = attribute.name.slice(URL_MARK.length);
        if (name === 'css') {
          element.textContent = attribute.value;
        } else if (name === 'xlink-href') {
          element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', attribute.value);
        } else {
          element.setAttribute(name, attribute.value);
        }
        element.removeAttribute(attribute.name);
      });
    });
    root.querySelectorAll('template').forEach((template) => applyUrlMarks(template.content));
  };
  [parsed, ...parsedRoots].forEach(applyUrlMarks);

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
    scrolledElements,
    metaRefresh: refresh ? refresh.getAttribute('content') || '' : '',
    shadowRoots: shadowRoots.length,
    shadowRootsLost: trustedTypesFallback ? shadowRoots.length : 0,
    cssomSynced,
    adopted,
    bodyText: document.body?.innerText || '',
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
 *
 * Numa página fora de UTF-8, um CSS sem charset declarado (nem no cabeçalho, nem com BOM
 * ou @charset no arquivo) herda a codificação do documento que o pediu; no replay o
 * documento é UTF-8, então o CSS ganha o charset que tinha de fato na captura
 * (documentCharset). O HAR não diz qual documento pediu cada CSS: um CSS sem declaração
 * pedido por um iframe em UTF-8 também ganha o charset da página.
 */
export function cleanHar(harFile, { documentCharset = null } = {}) {
  const har = JSON.parse(fs.readFileSync(harFile, 'utf8'));
  // Início do corpo de uma resposta do HAR (attach: arquivo ao lado do HAR; senão, texto)
  const bodyStart = (content) => {
    try {
      if (content?._file) {
        const fd = fs.openSync(path.join(path.dirname(harFile), content._file), 'r');
        try {
          const buffer = Buffer.alloc(64);
          const read = fs.readSync(fd, buffer, 0, 64, 0);
          return buffer.subarray(0, read);
        } finally {
          fs.closeSync(fd);
        }
      }
      if (typeof content?.text === 'string') {
        return Buffer.from(content.encoding === 'base64' ? Buffer.from(content.text, 'base64') : content.text).subarray(0, 64);
      }
    } catch (error) {
      // corpo ilegível: trata como sem declaração
    }
    return Buffer.alloc(0);
  };
  // Um CSS com BOM ou @charset já declara a codificação; o charset no cabeçalho passaria
  // por cima dela e decodificaria errado um CSS em UTF-8
  const declaresEncoding = (content) => {
    const start = bodyStart(content);
    const bom = (start[0] === 0xef && start[1] === 0xbb && start[2] === 0xbf) || (start[0] === 0xfe && start[1] === 0xff) || (start[0] === 0xff && start[1] === 0xfe);
    return bom || start.toString('latin1').startsWith('@charset "');
  };
  const seen = new Set();
  const before = har.log.entries.length;
  let withoutBody = 0;
  let cssCharsetAdded = 0;
  const legacyCharset = documentCharset && !/^utf-8$/i.test(documentCharset);
  har.log.entries.forEach((entry) => {
    const response = entry.response;
    const header = response?.headers?.find((item) => item.name.toLowerCase() === 'content-type');
    if (legacyCharset && header && /^text\/css\b/i.test(header.value) && !/charset=/i.test(header.value) && !declaresEncoding(response.content)) {
      header.value = `${header.value}; charset=${documentCharset}`;
      if (response.content?.mimeType) {
        response.content.mimeType = header.value;
      }
      cssCharsetAdded++;
    }
  });
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
  return { entries: har.log.entries.length, dropped: before - har.log.entries.length, withoutBody, cssCharsetAdded };
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
 * Roda fn em cada frame da página e devolve os resultados dos que responderam. Um iframe
 * cuja navegação foi bloqueada pode nunca ganhar contexto de execução, e o evaluate
 * esperaria para sempre: cada frame tem 3 s.
 */
async function inEachFrame(page, fn) {
  const results = [];
  let skipped = 0;
  for (const frame of page.frames()) {
    let timer;
    const skip = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), 3000);
    });
    try {
      const result = await Promise.race([skip, frame.evaluate(fn)]);
      if (result) {
        results.push(result);
      } else {
        skipped++;
      }
    } catch (error) {
      // frame sem acesso (outra origem bloqueada) ou já fechado
      skipped++;
    } finally {
      clearTimeout(timer);
    }
  }
  return { results, skipped };
}

/**
 * Deixa o estado das animações igual em todas as condições: no replay as animações CSS
 * recomeçam do zero, e a baseline mede segundos depois do load enquanto as condições com
 * plugin medem minutos depois. As finitas (entrada, transições) vão para o estado final,
 * que é o que a captura viu depois de esperar o DOM assentar; as infinitas (spinners,
 * carrosséis em CSS) param no início. Em todos os frames e dentro dos shadow roots (o
 * document.getAnimations() de cada documento não os inclui). A captura chama a mesma
 * função na página ao vivo antes da tela, para a comparação com o replay ver o mesmo
 * estado.
 */
export async function freezeAnimations(page) {
  const { results, skipped } = await inEachFrame(page, () => {
    const animations = new Set(document.getAnimations ? document.getAnimations() : []);
    const walk = (root) => root.querySelectorAll('*').forEach((element) => {
      if (element.shadowRoot) {
        (element.shadowRoot.getAnimations ? element.shadowRoot.getAnimations() : []).forEach((animation) => animations.add(animation));
        walk(element.shadowRoot);
      }
    });
    walk(document);
    let finished = 0;
    let paused = 0;
    animations.forEach((animation) => {
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
  });
  return {
    finished: results.reduce((sum, item) => sum + item.finished, 0),
    paused: results.reduce((sum, item) => sum + item.paused, 0),
    framesSkipped: skipped
  };
}

/**
 * Aplica a rolagem gravada na captura (atributos data-accessify-scroll e, no <html>,
 * data-accessify-window-scroll) e remove os atributos, em todos os frames, antes de
 * qualquer medição ou driver. As rolagens do harness são instantâneas: com
 * scroll-behavior: smooth (Bootstrap 5 no :root, carrosséis com scroll-snap), a posição
 * seria lida e medida no meio da animação, em momentos diferentes em cada condição.
 */
async function restoreCapturedScroll(page) {
  const { results } = await inEachFrame(page, () => {
    let restored = 0;
    const walk = (root) => root.querySelectorAll('*').forEach((element) => {
      const value = element.getAttribute('data-accessify-scroll');
      if (value !== null) {
        const [top, left] = value.split(',').map(Number);
        element.scrollTo({ top, left, behavior: 'instant' });
        element.removeAttribute('data-accessify-scroll');
        restored++;
      }
      if (element.shadowRoot) {
        walk(element.shadowRoot);
      }
    });
    walk(document);
    const windowScroll = document.documentElement.getAttribute('data-accessify-window-scroll');
    if (windowScroll !== null) {
      const [y, x] = windowScroll.split(',').map(Number);
      document.documentElement.removeAttribute('data-accessify-window-scroll');
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
    }
    return { restored };
  });
  return results.reduce((sum, item) => sum + item.restored, 0);
}

/**
 * Diferença entre o texto visível da captura e o do replay: fração das linhas (sem
 * espaços nas pontas) que não têm par na outra versão, contando repetições. 0 = mesmo
 * texto; um texto trocado do mesmo tamanho também conta.
 */
export function textDifference(a, b) {
  const lines = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const left = lines(a);
  const right = lines(b);
  const remaining = new Map();
  left.forEach((line) => remaining.set(line, (remaining.get(line) || 0) + 1));
  let common = 0;
  right.forEach((line) => {
    const count = remaining.get(line) || 0;
    if (count > 0) {
      remaining.set(line, count - 1);
      common++;
    }
  });
  const total = left.length + right.length;
  return total ? (total - 2 * common) / total : 0;
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
  // frozenFramesServed: arquivos congelados distintos que o replay serviu (dois iframes com
  // o mesmo src contam uma vez); frozenFrameRequests: pedidos atendidos
  const counters = { mainServed: 0, blockedNavigations: 0, blockedFrames: 0, frozenFramesServed: 0, frozenFrameRequests: 0 };
  const servedFrameFiles = new Set();
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
        counters.frozenFrameRequests++;
        servedFrameFiles.add(file);
        counters.frozenFramesServed = servedFrameFiles.size;
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
    const animations = await freezeAnimations(page);
    const scrollRestored = await restoreCapturedScroll(page);
    await settle(page, config.timeouts.settleMs);
    const state = await page.evaluate(() => ({ compatMode: document.compatMode, bodyText: document.body?.innerText || '' }));

    return {
      page,
      aborted,
      counters,
      loadTimedOut,
      animations,
      scrollRestored,
      bodyText: state.bodyText,
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
 * Antes de medir: cada contêiner rolável volta à posição de antes do driver, a janela vai
 * para o topo (todas as condições medem do topo) e as animações são congeladas de novo.
 * O caminho de visão da v1.1.0 chama scrollIntoView, que rola a janela e todo contêiner
 * rolável acima da imagem (inclusive o viewport de um carrossel com overflow hidden), e
 * cabeçalhos fixos, imagens lazy e slides mudariam o que o axe vê.
 */
export async function resetScroll(page, timeoutMs) {
  const before = await page.evaluate((key) => {
    const saved = window[Symbol.for(key)] || new Map();
    let elementsRestored = 0;
    const walk = (root) => root.querySelectorAll('*').forEach((element) => {
      const [top, left] = saved.get(element) || [0, 0];
      if (element.scrollTop !== top || element.scrollLeft !== left) {
        element.scrollTo({ top, left, behavior: 'instant' });
        elementsRestored++;
      }
      if (element.shadowRoot) {
        walk(element.shadowRoot);
      }
    });
    const windowScroll = { x: window.scrollX, y: window.scrollY };
    walk(document);
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
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
