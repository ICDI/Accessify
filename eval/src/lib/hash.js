import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

export const sha256File = (file) => sha256(fs.readFileSync(file));

/**
 * Hash de uma pasta inteira: caminhos relativos ordenados + conteúdo de cada arquivo.
 * `exclude` recebe o caminho relativo (com /) e devolve true para deixar o arquivo de fora.
 */
export function sha256Dir(dir, exclude = () => false) {
  const hash = crypto.createHash('sha256');
  const walk = (current) => fs.readdirSync(current, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((entry) => {
      const full = path.join(current, entry.name);
      const relative = path.relative(dir, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(full);
      } else if (!exclude(relative)) {
        hash.update(relative);
        hash.update(fs.readFileSync(full));
      }
    });
  walk(dir);
  return hash.digest('hex');
}

/**
 * true para URLs http(s) que o navegador consegue abrir.
 */
export function isHttpUrl(url) {
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch (error) {
    return false;
  }
}

/**
 * Nome de pasta estável para uma URL: host + caminho saneado + 8 caracteres do hash.
 * Nunca lança: uma URL que não abre vira "url-invalida-<hash>", para a falha ter linha.
 */
export function slugForUrl(url) {
  const hash = sha256(String(url)).slice(0, 8);
  if (!isHttpUrl(url)) {
    return `url-invalida-${hash}`;
  }
  const parsed = new URL(url);
  const readable = `${parsed.hostname}${parsed.pathname}`
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${readable}-${hash}`;
}
