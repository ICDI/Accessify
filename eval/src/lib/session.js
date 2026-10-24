import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EVAL_DIR } from './config.js';
import { sha256, sha256Dir } from './hash.js';
import { getJson, postJson } from './http.js';
import { withIoRetries } from './io.js';

/**
 * Estado do Ollama: versão, digest e detalhes de cada modelo e os modelos carregados
 * (com o contexto efetivo). Os campos com erro trazem { erro }.
 */
export async function ollamaInfo(baseUrl) {
  const [version, tags, ps] = await Promise.all([
    getJson(`${baseUrl}/api/version`),
    getJson(`${baseUrl}/api/tags`),
    getJson(`${baseUrl}/api/ps`)
  ]);

  const digests = Object.fromEntries((tags.models || []).map((model) => [model.name, model.digest]));
  return {
    version: typeof version.version === 'string' ? version.version : null,
    error: version.erro || tags.erro || null,
    digests,
    models: tags.models || tags,
    loaded: ps.models || ps
  };
}

/**
 * Contexto efetivo do modelo carregado (/api/ps), ou null se ele não estiver carregado.
 */
export async function loadedContext(baseUrl, model) {
  const ps = await getJson(`${baseUrl}/api/ps`);
  const loaded = (ps.models || []).find((item) => item.name === model);
  return loaded ? (loaded.context_length ?? null) : null;
}

/**
 * Antes da primeira URL de uma condição com modelo: o Ollama responde, o modelo existe e
 * fica carregado (um prompt vazio só carrega). Assim o tempo de carga não entra no
 * latencia_ms do primeiro run nem empurra um run no limite para o timeout, e o contexto
 * efetivo (D8) é conferido antes de qualquer run.
 */
export async function prepareModel(baseUrl, model, { timeoutMs, keepAlive }) {
  const info = await ollamaInfo(baseUrl);
  if (!info.version) {
    return { ok: false, error: `Ollama indisponível em ${baseUrl}: ${info.error || 'sem versão'}` };
  }
  if (!info.digests[model]) {
    return { ok: false, error: `modelo ${model} não está no Ollama`, version: info.version };
  }
  const startedAt = Date.now();
  try {
    const response = await postJson(`${baseUrl}/api/generate`, { model, prompt: '', keep_alive: keepAlive, stream: false }, { timeoutMs });
    if (response.status !== 200) {
      return { ok: false, error: `carga do modelo ${model}: HTTP ${response.status}`, version: info.version };
    }
  } catch (error) {
    return { ok: false, error: `carga do modelo ${model}: ${error.message}`, version: info.version };
  }
  return {
    ok: true,
    version: info.version,
    digest: info.digests[model],
    warmupMs: Date.now() - startedAt,
    contextLength: await loadedContext(baseUrl, model)
  };
}

export function packageVersions() {
  // Lido do node_modules: alguns pacotes não exportam o package.json pelo require
  const version = (name) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'node_modules', name, 'package.json'), 'utf8')).version;
    } catch (error) {
      return null;
    }
  };

  return {
    node: process.version,
    playwright: version('playwright'),
    axeCore: version('axe-core'),
    axeCorePlaywright: version('@axe-core/playwright'),
    ibmEngine: version('accessibility-checker-engine')
  };
}

/**
 * Que código do harness produziu as medições: commit e describe do repositório, se
 * eval/src ou eval/config.json têm alteração não commitada, e um hash de eval/src +
 * config.json. O hash entra no ambiente de medição: uma baseline medida com outro código
 * de replay ou de medição não é reaproveitada.
 */
export function harnessVersion() {
  const git = (args) => {
    try {
      // safe.directory só neste comando (o repositório pode estar num disco sem dono, FAT32)
      const safeDir = path.resolve(EVAL_DIR, '..').split(path.sep).join('/');
      return execFileSync('git', ['-c', `safe.directory=${safeDir}`, '-C', EVAL_DIR, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (error) {
      return null;
    }
  };
  const status = git(['status', '--porcelain', '--', 'src', 'config.json']);
  const dirty = status === null ? null : status.length > 0;
  const describe = git(['describe', '--tags', '--always']);
  return {
    commit: git(['rev-parse', 'HEAD']),
    describe: describe ? `${describe}${dirty ? '-dirty' : ''}` : null,
    dirty,
    sha256: sha256(`${sha256Dir(path.join(EVAL_DIR, 'src'))}|${sha256(fs.readFileSync(path.join(EVAL_DIR, 'config.json')))}`)
  };
}

/**
 * Grava a sessão por inteiro num arquivo temporário e troca de nome: uma queda no meio
 * da escrita não deixa o único registro da sessão truncado. As duas etapas têm novas
 * tentativas para bloqueios passageiros do Windows.
 */
export function writeSession(sessionsDir, session) {
  fs.mkdirSync(sessionsDir, { recursive: true });
  const file = path.join(sessionsDir, `${session.sessionId}.json`);
  const temp = `${file}.tmp`;
  const text = JSON.stringify(session, null, 2);
  withIoRetries(() => fs.writeFileSync(temp, text));
  withIoRetries(() => fs.renameSync(temp, file));
  return file;
}
