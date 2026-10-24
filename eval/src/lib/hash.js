import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

export const sha256File = (file) => sha256(fs.readFileSync(file));

/**
 * Hash de uma pasta inteira: caminhos relativos ordenados + conteúdo de cada arquivo.
 */
export function sha256Dir(dir) {
  const hash = crypto.createHash('sha256');
  const walk = (current) => fs.readdirSync(current, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        hash.update(path.relative(dir, full).replace(/\\/g, '/'));
        hash.update(fs.readFileSync(full));
      }
    });
  walk(dir);
  return hash.digest('hex');
}

/**
 * Nome de pasta estável para uma URL: host + caminho saneado + 8 caracteres do hash.
 */
export function slugForUrl(url) {
  const parsed = new URL(url);
  const readable = `${parsed.hostname}${parsed.pathname}`
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${readable}-${sha256(url).slice(0, 8)}`;
}
