import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHttpUrl } from './hash.js';

export const EVAL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Opções que recebem um caminho: sem valor, o parseArgs devolve true e o harness cairia
// nas pastas do lote sem avisar
const PATH_OPTIONS = ['snapshots', 'resultados', 'urls'];

/**
 * Configuração do estudo. --snapshots e --resultados trocam as pastas (relativas à pasta
 * atual), para os testes rodarem sem tocar nos dados do lote.
 */
export function loadConfig(args = {}) {
  PATH_OPTIONS.forEach((option) => {
    if (option in args && typeof args[option] !== 'string') {
      throw new Error(`--${option} precisa de um caminho.`);
    }
  });
  const config = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, 'config.json'), 'utf8'));
  const resolve = (relative) => path.resolve(EVAL_DIR, relative);
  const snapshots = args.snapshots ? path.resolve(args.snapshots) : resolve(config.paths.snapshots);
  const results = args.resultados ? path.resolve(args.resultados) : resolve(config.paths.results);

  return {
    ...config,
    dirs: {
      accessifyV1: resolve(config.paths.accessifyV1),
      accessifyV11: resolve(config.paths.accessifyV11),
      snapshots,
      results,
      raw: path.join(results, 'raw'),
      sessions: path.join(results, 'sessions')
    }
  };
}

/**
 * Lê eval/urls.csv, ou outra lista com --urls (url,estrato). Linhas vazias e comentários
 * (#) são ignorados. URLs que não abrem (sem esquema, vazias) ficam na lista com
 * invalid: true, para virarem 'falha' com motivo em vez de derrubar o lote; URLs
 * repetidas (a mesma página em dois estratos) ficam só na primeira linha e vão em
 * `duplicates`.
 */
export function loadUrls(file) {
  const source = file ? path.resolve(file) : path.join(EVAL_DIR, 'urls.csv');
  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/);
  const [header, ...rows] = lines.filter((line) => line.trim() && !line.startsWith('#'));
  if (!header || header.trim() !== 'url,estrato') {
    throw new Error(`${source} precisa do cabeçalho "url,estrato" (encontrado: "${header}")`);
  }

  const seen = new Set();
  const duplicates = [];
  const entries = [];
  rows.forEach((line) => {
    const [url = '', estrato = ''] = line.split(',').map((value) => value.trim());
    if (seen.has(url)) {
      duplicates.push({ url, estrato });
      return;
    }
    seen.add(url);
    entries.push({ url, estrato, invalid: !isHttpUrl(url) });
  });
  entries.duplicates = duplicates;
  return entries;
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
