import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256Dir } from './hash.js';

// Só o que a extensão carrega: o harness (eval/), docs e o git ficam de fora
const EXTENSION_ENTRY = /^(manifest\.json|[a-z0-9-]+\.(js|html)|icons)$/i;

function git(dir, args) {
  try {
    // safe.directory só neste comando: o worktree da v1.0.0 pode estar num disco que não
    // registra dono (FAT32) e o git recusaria ler; a configuração global não muda
    const safeDir = path.resolve(dir).replace(/\\/g, '/');
    return execFileSync('git', ['-c', `safe.directory=${safeDir}`, '-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Copia uma extensão para uma pasta temporária e devolve o caminho da cópia com o
 * registro de procedência. Com --load-extension o Chrome pode apagar arquivos da pasta
 * de origem, então nunca se carrega a pasta original (../accessify-v1 é só leitura).
 */
export function prepareExtension(sourceDir, label) {
  if (!fs.existsSync(path.join(sourceDir, 'manifest.json'))) {
    throw new Error(`Extensão não encontrada em ${sourceDir}`);
  }

  const copy = fs.mkdtempSync(path.join(os.tmpdir(), `accessify-${label}-`));
  for (const entry of fs.readdirSync(sourceDir)) {
    if (EXTENSION_ENTRY.test(entry)) {
      fs.cpSync(path.join(sourceDir, entry), path.join(copy, entry), { recursive: true });
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(copy, 'manifest.json'), 'utf8'));
  // Só os arquivos que a extensão carrega: o harness (eval/) e os docs não contam. O
  // describe também não usa --dirty, que olharia o repositório inteiro (um index.csv ou
  // runs.csv alterado marcaria uma extensão intacta como -dirty)
  const copied = fs.readdirSync(copy);
  const status = git(sourceDir, ['status', '--porcelain', '--', ...copied]);
  const gitDirty = status === null ? null : status.length > 0;
  const describe = git(sourceDir, ['describe', '--tags', '--always']);

  return {
    label,
    sourceDir,
    dir: copy,
    version: manifest.version,
    gitCommit: git(sourceDir, ['rev-parse', 'HEAD']),
    gitDescribe: describe ? `${describe}${gitDirty ? '-dirty' : ''}` : null,
    gitDirty,
    copySha256: sha256Dir(copy)
  };
}

/**
 * Apaga a cópia da extensão. Nunca lança: devolve o erro, se houver, para a sessão.
 */
export function removeExtensionCopy(extension) {
  if (!extension?.dir) {
    return null;
  }
  try {
    fs.rmSync(extension.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    return null;
  } catch (error) {
    return error.message;
  }
}
