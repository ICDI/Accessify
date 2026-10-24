// Aceite 1: node --check em cada JS (um arquivo por chamada: "node --check a.js b.js" só
// verifica o primeiro), manifest válido e sem permissões além das da tag v1.1.0, nenhuma
// chave de API versionada e nenhum innerHTML novo na extensão desde a v1.1.0.
// Uso: node aceites/1-sintaxe.js [--saida pasta]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../src/lib/config.js';
import { REPO_DIR, createReport, git } from './lib.js';

const args = parseArgs();
const { check, finish } = createReport('1-sintaxe', args);

function listJs(dir, recursive) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return recursive && entry.name !== 'node_modules' ? listJs(full, true) : [];
    }
    return /\.(js|mjs)$/.test(entry.name) ? [full] : [];
  });
}

const files = [
  ...listJs(REPO_DIR, false),
  ...listJs(path.join(REPO_DIR, 'eval', 'src'), true),
  ...listJs(path.join(REPO_DIR, 'eval', 'aceites'), true),
  ...listJs(path.join(REPO_DIR, 'eval', 'tools'), true)
];
const syntaxErrors = files.filter((file) => {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    return false;
  } catch (error) {
    console.error(String(error.stderr || error.message).split('\n').slice(0, 4).join('\n'));
    return true;
  }
});
check(`node --check em ${files.length} arquivos JS`, files.length > 0 && syntaxErrors.length === 0, syntaxErrors.map((file) => path.relative(REPO_DIR, file)).join(', '));

let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(path.join(REPO_DIR, 'manifest.json'), 'utf8'));
  check('manifest.json é JSON válido (MV3)', manifest.manifest_version === 3, `versão ${manifest.version}`);
} catch (error) {
  check('manifest.json é JSON válido (MV3)', false, error.message);
}

if (manifest) {
  const tagManifest = JSON.parse(git(['show', 'v1.1.0:manifest.json'], { encoding: 'utf8' }));
  const extra = (key) => (manifest[key] || []).filter((item) => !(tagManifest[key] || []).includes(item));
  const extraPermissions = [...extra('permissions'), ...extra('host_permissions'), ...extra('optional_permissions')];
  check('sem permissões além das da tag v1.1.0', extraPermissions.length === 0, extraPermissions.join(', '));
}

// Chaves de API: padrões dos provedores que a extensão usa (OpenRouter, OpenAI) em tudo
// o que está versionado
const KEY_PATTERN = /\b(sk-or-v1-[a-f0-9]{32,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{40,})\b/;
// -z: sem ele o git cita caminhos com acento ("docs/evid\303\252ncias/...") e o arquivo
// sumiria da verificação
const tracked = git(['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const withKeys = tracked.filter((file) => {
  const full = path.join(REPO_DIR, file);
  if (!fs.existsSync(full) || fs.statSync(full).size > 5 * 1024 * 1024) {
    return false;
  }
  return KEY_PATTERN.test(fs.readFileSync(full, 'latin1'));
});
check('nenhuma chave de API nos arquivos versionados', withKeys.length === 0, withKeys.join(', '));
check('.env fora do git', !tracked.some((file) => path.basename(file) === '.env'));

// innerHTML com conteúdo da página ou do LLM: nenhuma linha nova desde a v1.1.0 nos
// arquivos da extensão (o harness, que roda fora dela, não entra). Arquivos novos ainda
// fora do git também entram na cópia que o harness carrega: são lidos inteiros
const HTML_SINK = /\.innerHTML\s*[+]?=|insertAdjacentHTML|\.outerHTML\s*=|document\.write\(/;
const diff = git(['diff', 'v1.1.0', '--', '*.js', '*.html', ':!eval/**'], { encoding: 'utf8' });
const htmlSinks = diff.split('\n').filter((line) => /^\+(?!\+\+)/.test(line) && HTML_SINK.test(line)).map((line) => line.trim().slice(0, 120));
const untracked = git(['ls-files', '-z', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0')
  .filter((file) => /^[a-z0-9-]+\.(js|html)$/i.test(file));
untracked.forEach((file) => {
  fs.readFileSync(path.join(REPO_DIR, file), 'utf8').split('\n')
    .filter((line) => HTML_SINK.test(line))
    .forEach((line) => htmlSinks.push(`${file} (fora do git): ${line.trim().slice(0, 100)}`));
});
check('nenhum innerHTML/insertAdjacentHTML novo na extensão desde a v1.1.0', htmlSinks.length === 0, htmlSinks.join(' | '));
check('nenhum arquivo da extensão fora do git na raiz', untracked.length === 0, untracked.join(', '));

process.exit(finish());
