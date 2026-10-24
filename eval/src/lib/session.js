import fs from 'node:fs';
import path from 'node:path';
import { EVAL_DIR } from './config.js';

async function getJson(url) {
  try {
    const response = await fetch(url);
    return response.ok ? response.json() : { erro: `HTTP ${response.status}` };
  } catch (error) {
    return { erro: error.message };
  }
}

/**
 * Estado do Ollama no início do lote: versão, digest e detalhes de cada modelo e os
 * modelos carregados (com o contexto efetivo).
 */
export async function ollamaInfo(baseUrl) {
  const [version, tags, ps] = await Promise.all([
    getJson(`${baseUrl}/api/version`),
    getJson(`${baseUrl}/api/tags`),
    getJson(`${baseUrl}/api/ps`)
  ]);

  const digests = Object.fromEntries((tags.models || []).map((model) => [model.name, model.digest]));
  return { version: version.version || version, digests, models: tags.models || tags, loaded: ps.models || ps };
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
    axeCorePlaywright: version('@axe-core/playwright')
  };
}

export function writeSession(sessionsDir, session) {
  fs.mkdirSync(sessionsDir, { recursive: true });
  const file = path.join(sessionsDir, `${session.startedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(session, null, 2));
  return file;
}
