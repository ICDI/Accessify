import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EVAL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadConfig() {
  const config = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'config.json'), 'utf8'));
  const resolve = (relative) => path.resolve(EVAL_DIR, relative);

  return {
    ...config,
    dirs: {
      accessifyV1: resolve(config.paths.accessifyV1),
      accessifyV11: resolve(config.paths.accessifyV11),
      snapshots: resolve(config.paths.snapshots),
      results: resolve(config.paths.results),
      raw: resolve(path.join(config.paths.results, 'raw')),
      sessions: resolve(path.join(config.paths.results, 'sessions'))
    }
  };
}

/**
 * Lê eval/urls.csv (url,estrato). Linhas vazias e comentários (#) são ignorados.
 */
export function loadUrls() {
  const lines = fs.readFileSync(path.join(EVAL_DIR, 'urls.csv'), 'utf8').split(/\r?\n/);
  const [header, ...rows] = lines.filter((line) => line.trim() && !line.startsWith('#'));
  if (header.trim() !== 'url,estrato') {
    throw new Error(`urls.csv precisa do cabeçalho "url,estrato" (encontrado: "${header}")`);
  }

  return rows.map((line) => {
    const [url, estrato = ''] = line.split(',').map((value) => value.trim());
    return { url, estrato };
  });
}

/**
 * Argumentos simples de linha de comando: --chave valor ou --flag.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) {
      continue;
    }
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}
