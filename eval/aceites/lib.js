// Utilitários dos aceites da Fase 5 (docs/ESTADO_ATUAL.md). Cada aceite é um script
// independente que imprime OK/FALHA por verificação, grava um JSON de evidência e sai com
// código 1 se alguma verificação falhar.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { EVAL_DIR, loadConfig } from '../src/lib/config.js';
import { prepareExtension } from '../src/lib/extensions.js';

export const REPO_DIR = path.resolve(EVAL_DIR, '..');
// Porta fechada: a extensão segue o caminho sem LLM (a heurística e as correções
// determinísticas continuam; as chamadas ao LLM falham na hora)
export const NO_LLM_BASE_URL = 'http://127.0.0.1:9/v1';
export const OLLAMA_URL = 'http://127.0.0.1:11434';

export function git(args, options = {}) {
  const safeDir = REPO_DIR.replace(/\\/g, '/');
  return execFileSync('git', ['-c', `safe.directory=${safeDir}`, '-C', REPO_DIR, ...args], { maxBuffer: 256 * 1024 * 1024, ...options });
}

export const today = () => new Date().toISOString().slice(0, 10);

/**
 * Registro das verificações de um aceite. finish() grava o JSON em --saida (padrão
 * docs/evidencias/aceites/<data>/) e devolve o código de saída.
 */
export function createReport(name, args) {
  const report = { aceite: name, iniciadoEm: new Date().toISOString(), args, checks: [] };
  const outDir = typeof args.saida === 'string' ? path.resolve(args.saida) : path.join(REPO_DIR, 'docs', 'evidencias', 'aceites', today());
  const check = (label, ok, detail = '') => {
    report.checks.push({ label, ok: !!ok, detail });
    console.log(`${ok ? 'OK   ' : 'FALHA'} ${label}${detail ? ` — ${detail}` : ''}`);
    return !!ok;
  };
  const finish = () => {
    report.terminadoEm = new Date().toISOString();
    report.ok = report.checks.length > 0 && report.checks.every((item) => item.ok);
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${name}.json`);
    fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.ok ? 'aceite ok' : 'aceite com falhas'}: ${file}`);
    return report.ok ? 0 : 1;
  };
  // Um erro fora dos try de cada script (preparação, await de topo) não pode sumir com a
  // evidência: vira uma verificação com falha e o JSON é gravado antes de sair
  process.on('uncaughtException', (error) => {
    check('aceite rodou até o fim', false, String(error?.message || error).split('\n')[0]);
    finish();
    process.exit(1);
  });
  return { report, outDir, check, finish };
}

// Pastas temporárias dos aceites (cópias de extensão e perfis do Chromium): apagadas na
// saída do processo, como o harness faz com as dele
const temporaryDirs = new Set();
const removeTemporary = (dir) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    // pasta presa: fica no diretório temporário
  }
  temporaryDirs.delete(dir);
};
process.on('exit', () => temporaryDirs.forEach(removeTemporary));

/**
 * Cópia descartável do build da branch atual (a mesma que o harness carrega).
 */
export function buildCopy(label) {
  const extension = prepareExtension(REPO_DIR, label);
  temporaryDirs.add(extension.dir);
  return extension;
}

/**
 * Cópia descartável de uma tag, arquivo por arquivo pelo git (sem tar), para carregar
 * como extensão. A pasta de trabalho e o índice não mudam.
 */
export function refCopy(ref, label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `accessify-${label}-`));
  temporaryDirs.add(dir);
  const files = git(['ls-tree', '-r', '--name-only', ref], { encoding: 'utf8' }).split('\n').filter(Boolean);
  files.forEach((file) => {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, git(['show', `${ref}:${file}`]));
  });
  return { dir, ref, gitCommit: git(['rev-list', '-n', '1', ref], { encoding: 'utf8' }).trim() };
}

export async function launchExtension(extensionDir, label) {
  const config = loadConfig();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `.pw-profile-aceite-${label}-`));
  temporaryDirs.add(profileDir);
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: config.headless,
    viewport: config.viewport,
    locale: config.locale,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`]
  });
  // close() fecha o contexto e apaga o perfil, como o dispose() do harness: o evento
  // 'close' do contexto chega antes de o Chromium soltar os arquivos do perfil
  const close = async () => {
    await context.close().catch(() => {});
    removeTemporary(profileDir);
  };
  try {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 20000 });
    }
    const webErrors = [];
    context.on('weberror', (error) => webErrors.push(error.error().message));
    return { context, serviceWorker, extensionId: new URL(serviceWorker.url()).host, webErrors, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function setLocalProvider(serviceWorker, baseUrl, model) {
  await serviceWorker.evaluate(async (settings) => {
    await chrome.storage.sync.set({ provider: 'local', localBaseUrl: settings.baseUrl, localModel: settings.model, autoOptimize: false });
  }, { baseUrl, model });
}

// PNG 64×64 metade vermelho, metade azul: imagem sem contexto textual nenhum
function makePng() {
  const width = 64;
  const height = 64;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      raw.set(x < width / 2 ? [220, 20, 20] : [20, 40, 220], y * (width * 3 + 1) + 1 + x * 3);
    }
  }
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
  const crc = (buffer) => {
    let c = 0xffffffff;
    for (const byte of buffer) {
      c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc(typed));
    return Buffer.concat([length, typed, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const FIXTURES = {
  '/test-page.html': () => ({ type: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(REPO_DIR, 'test-page.html')) }),
  // Uma imagem sem alt e sem contexto: o único caso em que a v1.1.0 local chama o LLM
  '/fixture-llm.html': () => ({
    type: 'text/html; charset=utf-8',
    body: '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fixture com imagem sem contexto</title></head>'
      + '<body><main><h1>Fixture</h1><div><img src="/IMG_2034.png" width="320" height="240"></div></main></body></html>'
  }),
  '/IMG_2034.png': () => ({ type: 'image/png', body: makePng() })
};

/**
 * Servidor HTTP local só com a test-page e a fixture (a extensão não roda em file://).
 */
export function serveFixtures() {
  const server = http.createServer((request, response) => {
    const fixture = FIXTURES[new URL(request.url, 'http://local').pathname];
    if (!fixture) {
      response.writeHead(404);
      response.end('não encontrado');
      return;
    }
    const { type, body } = fixture();
    response.writeHead(200, { 'Content-Type': type });
    response.end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    server,
    url: (pathname) => `http://127.0.0.1:${server.address().port}${pathname}`,
    close: () => new Promise((done) => server.close(done))
  })));
}

export async function openTarget(context, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load' });
  // Content script em document_end: um respiro para ele registrar os listeners
  await page.waitForTimeout(800);
  return page;
}

export async function findTab(serviceWorker, url) {
  return serviceWorker.evaluate(async (target) => {
    const tabs = (await chrome.tabs.query({})).filter((tab) => tab.url === target);
    return tabs.sort((a, b) => b.id - a.id)[0] || null;
  }, url);
}

/**
 * DOM final para comparação: IDs aleatórios do Accessify normalizados, o nó do gancho
 * (#accessify-result) fora e a query string da URL de teste removida.
 */
export async function finalDom(page) {
  const html = await page.evaluate(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('#accessify-result').forEach((node) => node.remove());
    return clone.outerHTML;
  });
  const ids = new Map();
  return html
    // Cada ID aleatório vira um número pela ordem de aparição: o acaso some, mas um
    // <label for> ou aria-describedby ligado ao campo errado continua diferente
    .replace(/accessify-(field|error)-[a-z0-9]{1,8}/g, (match, kind) => {
      if (!ids.has(match)) {
        ids.set(match, `accessify-${kind}-${ids.size + 1}`);
      }
      return ids.get(match);
    })
    .replace(/(test-page|fixture-llm)\.html\?[^"'\s<]*/g, '$1.html');
}

export async function ollamaAvailable(model) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    return (data.models || []).some((item) => item.name === model);
  } catch (error) {
    return false;
  }
}

/**
 * Roda um script do harness (src/run.js, src/capture.js) como processo filho, com a
 * saída repassada, e devolve o código de saída.
 */
export function runHarnessScript(script, args) {
  try {
    execFileSync(process.execPath, [path.join(EVAL_DIR, 'src', script), ...args], { cwd: EVAL_DIR, stdio: 'inherit' });
    return 0;
  } catch (error) {
    return error.status ?? 1;
  }
}

export async function waitHookReady(page, attempts = 10) {
  return page.evaluate(async (tries) => {
    for (let attempt = 0; attempt < tries; attempt++) {
      const ready = await new Promise((resolve) => {
        const onReady = () => resolve(true);
        document.addEventListener('accessify:ready', onReady, { once: true });
        document.dispatchEvent(new CustomEvent('accessify:ping'));
        setTimeout(() => {
          document.removeEventListener('accessify:ready', onReady);
          resolve(false);
        }, 200);
      });
      if (ready) {
        return true;
      }
    }
    return false;
  }, attempts);
}
