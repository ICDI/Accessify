import fs from 'node:fs';
import path from 'node:path';

const escapeCell = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Acrescenta uma linha ao CSV (nunca reescreve o arquivo). Cria o arquivo com o
 * cabeçalho se ele não existir e recusa gravar se o cabeçalho existente for outro:
 * um CSV de uma versão anterior do harness deve ser arquivado, não misturado. Se a
 * última linha do arquivo já for esta (uma nova tentativa depois de um erro no fsync ou
 * no close, com a escrita já feita), não grava de novo.
 */
export function appendCsvRow(file, columns, row) {
  const headerLine = columns.join(',');

  const unknown = Object.keys(row).filter((key) => !columns.includes(key));
  if (unknown.length > 0) {
    throw new Error(`Colunas desconhecidas na linha: ${unknown.join(', ')}`);
  }
  const line = `${columns.map((column) => escapeCell(row[column])).join(',')}\n`;

  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.split(/\r?\n/, 1)[0] !== headerLine) {
      throw new Error(`${path.basename(file)} tem outro cabeçalho; arquive o arquivo antigo antes de continuar.`);
    }
    if (text.endsWith(line)) {
      return;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${headerLine}\n`);
  }

  const fd = fs.openSync(file, 'a');
  try {
    fs.writeSync(fd, line);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export function readCsv(file) {
  if (!fs.existsSync(file)) {
    return [];
  }

  const text = fs.readFileSync(file, 'utf8');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...data] = rows.filter((r) => r.some((value) => value !== ''));
  return data.map((values) => Object.fromEntries(header.map((column, index) => [column, values[index] ?? ''])));
}
