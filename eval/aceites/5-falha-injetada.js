// Aceite 5: falha injetada. Uma URL que não resolve e uma URL sem esquema na lista viram
// 'falha' na captura e no run, e o lote continua com a URL válida; um snapshot adulterado
// no disco (sha256 diferente do índice) também vira 'falha' sem parar o lote. Tudo em
// pastas temporárias.
// Uso: node aceites/5-falha-injetada.js [--url https://...] [--saida pasta]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from '../src/lib/config.js';
import { readCsv } from '../src/lib/csv.js';
import { createReport, runHarnessScript } from './lib.js';

const args = parseArgs();
const { report, check, finish } = createReport('5-falha-injetada', args);
const INVALID = 'https://accessify-aceite.invalid/';
const MALFORMED = 'www.accessify-sem-esquema.test/pagina';
const valid = typeof args.url === 'string' ? args.url : 'https://www.w3.org/WAI/demos/bad/before/home.html';

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'accessify-aceite-falha-'));
const urlsFile = path.join(work, 'urls.csv');
const snapshots = path.join(work, 'snapshots');
fs.writeFileSync(urlsFile, ['url,estrato', `${INVALID},aceite`, `${MALFORMED},aceite`, `${valid},aceite`, ''].join('\n'));
report.work = work;

const captureExit = runHarnessScript('capture.js', ['--urls', urlsFile, '--snapshots', snapshots]);
const index = readCsv(path.join(snapshots, 'index.csv'));
const invalidSnapshot = index.find((row) => row.url === INVALID);
const malformedSnapshot = index.find((row) => row.url === MALFORMED);
const validSnapshot = index.find((row) => row.url === valid);
report.capture = { exit: captureExit, index: index.map((row) => ({ url: row.url, status: row.status, observacoes: row.observacoes })) };
check('captura terminou (código 0) apesar das URLs inválidas', captureExit === 0, String(captureExit));
check('captura: URL que não resolve registrada como falha', invalidSnapshot?.status === 'falha', invalidSnapshot?.observacoes);
check('captura: URL sem esquema registrada como falha', malformedSnapshot?.status === 'falha' && /URL inválida/.test(malformedSnapshot?.observacoes || ''), malformedSnapshot?.observacoes);
check('captura: URL válida capturada depois delas', validSnapshot?.status === 'ok', validSnapshot?.observacoes);

function runBaseline(label) {
  const results = path.join(work, label);
  const exit = runHarnessScript('run.js', ['--urls', urlsFile, '--snapshots', snapshots, '--resultados', results, '--conditions', 'baseline']);
  const rows = fs.existsSync(path.join(results, 'runs.csv')) ? readCsv(path.join(results, 'runs.csv')) : [];
  return { exit, rows, byUrl: (url) => rows.find((row) => row.url === url) };
}

const first = runBaseline('resultados-1');
report.run1 = { exit: first.exit, rows: first.rows.map((row) => ({ url: row.url, status: row.status, observacoes: row.observacoes })) };
check('run terminou (código 0) com as URLs inválidas', first.exit === 0, String(first.exit));
check('run: uma linha por URL', first.rows.length === 3, String(first.rows.length));
check('run: URL que não resolve → status falha com motivo', first.byUrl(INVALID)?.status === 'falha' && /snapshot/.test(first.byUrl(INVALID)?.observacoes || ''), first.byUrl(INVALID)?.observacoes);
check('run: URL sem esquema → status falha com motivo', first.byUrl(MALFORMED)?.status === 'falha' && /URL inválida/.test(first.byUrl(MALFORMED)?.observacoes || ''), first.byUrl(MALFORMED)?.observacoes);
check('run: URL válida → ok', first.byUrl(valid)?.status === 'ok', first.byUrl(valid)?.observacoes);

// Snapshot adulterado: um byte a mais no page.html depois de indexado
if (validSnapshot?.status === 'ok') {
  fs.appendFileSync(path.join(snapshots, validSnapshot.dir, 'page.html'), ' ');
  const second = runBaseline('resultados-2');
  report.run2 = { exit: second.exit, rows: second.rows.map((row) => ({ url: row.url, status: row.status, observacoes: row.observacoes })) };
  check('run com snapshot adulterado terminou (código 0)', second.exit === 0, String(second.exit));
  check('snapshot adulterado → falha (sha256 diferente do índice)', second.byUrl(valid)?.status === 'falha' && /sha256/.test(second.byUrl(valid)?.observacoes || ''), second.byUrl(valid)?.observacoes);
}

process.exit(finish());
