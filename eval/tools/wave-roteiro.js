#!/usr/bin/env node
/**
 * Roteiro assistido para a avaliação manual com a extensão WAVE (D16).
 *
 * Serve em http://127.0.0.1:8765 as 100 páginas da amostra (estrato A primeiro; filtro ?estrato=) em
 * três estados: baseline (page.html do snapshot congelado), v1.1.0 e v1.0.0 (DOM final
 * salvo pelo harness na 1ª passada). A pessoa abre cada estado no seu Chrome com a WAVE
 * instalada da loja, aciona a WAVE à mão (Ctrl+Shift+U), lê os seis totais do painel e
 * digita no formulário; o roteiro grava em docs/evidencias/wave/wave.csv.
 * Nada aqui aciona a WAVE nem lê o resultado dela: os termos da WebAIM proíbem uso
 * automatizado fora da API.
 *
 * Limitação: CSS, imagens e fontes carregam dos sites ao vivo (URLs absolutas do
 * snapshot), não do HAR; o contraste pode diferir se o CSS mudou desde a captura.
 *
 * Uso: node tools/wave-roteiro.js [--sessao 20261024-203955404-d8a9] [--porta 8765]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { latestSnapshots } from '../src/lib/snapshot.js';

const EVAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const SESSAO = opt('sessao', '20261024-203955404-d8a9');
const PORTA = Number(opt('porta', '8765'));
const CONDICOES = ['baseline', 'v1.1.0', 'v1.0.0'];
const CSV = path.resolve(EVAL, '..', 'docs', 'evidencias', 'wave', 'wave.csv');
const COLS = ['site', 'pagina', 'url', 'condicao', 'erros', 'erros_contraste', 'alertas', 'recursos', 'estrutura', 'aria', 'observacoes', 'coletado_por', 'coletado_em', 'snapshot_dir', 'run_id'];

// Páginas da amostra, com nome do site e estrato, a partir da ferramenta de montagem; o
// estrato A vem primeiro para manter os índices /p/0..17 usados na coleta dos sites do SEMISH
const montagem = fs.readFileSync(path.join(EVAL, 'tools', 'amostra', 'montar_amostra.py'), 'utf8');
const bloco = montagem.slice(montagem.indexOf('SITES=['), montagem.indexOf('CONTROLE=['));
const paginas = [];
for (const m of bloco.matchAll(/^\("([A-F])","([^"]*)","([^"]*)","([^"]+)","([^"]+)"/gm)) {
  paginas.push({ estrato: m[1], site: m[3], papel: 'inicial', url: m[4] });
  paginas.push({ estrato: m[1], site: m[3], papel: 'tarefa', url: m[5] });
}
paginas.sort((a, b) => (a.estrato === 'A' ? 0 : 1) - (b.estrato === 'A' ? 0 : 1));
paginas.push({ estrato: 'controle', site: 'Demo W3C Before and After', papel: 'before', url: 'https://www.w3.org/WAI/demos/bad/before/home.html' });
paginas.push({ estrato: 'controle', site: 'Demo W3C Before and After', papel: 'after', url: 'https://www.w3.org/WAI/demos/bad/after/home.html' });
const ESTRATOS = ['A', 'B', 'C', 'D', 'E', 'F', 'controle'];
const NOME_ESTRATO = { A: 'A. Originais do SEMISH', B: 'B. Ingresso, fomento e serviços', C: 'C. Universidades federais', D: 'D. Ciência e publicação', E: 'E. Conteúdo de estudo', F: 'F. Referência em acessibilidade', controle: 'Controle W3C' };

const snapshots = latestSnapshots(path.join(EVAL, 'snapshots'));
const runs = fs.readFileSync(path.join(EVAL, 'results', 'runs.csv'), 'utf8').split('\n');
const cab = runs[0].split(',');
const col = (name) => cab.indexOf(name);
// run_id por (url, condição) na sessão escolhida (linhas sem vírgula em campos de texto: usa-se o run_id, que não tem vírgula)
const runId = new Map();
for (const linha of runs.slice(1)) {
  if (!linha.includes(SESSAO)) continue;
  const id = linha.split(',')[col('run_id')];
  const cond = linha.split(',')[col('condicao')];
  for (const p of paginas) if (id.includes(`_${cond}_`) && linha.includes(`,${p.url},`)) runId.set(`${p.url}|${cond}`, id);
}
function domDe(url, condicao) {
  if (condicao === 'baseline') {
    const s = snapshots.get(url);
    if (!s || s.status !== 'ok') return { erro: `sem snapshot ok para ${url}` };
    return { html: fs.readFileSync(path.join(EVAL, 'snapshots', s.dir, 'page.html'), 'utf8'), ref: s.dir };
  }
  const id = runId.get(`${url}|${condicao}`);
  if (!id) return { erro: `sem run ${condicao} de ${url} na sessão ${SESSAO}` };
  const arquivos = fs.readdirSync(path.join(EVAL, 'results', 'raw')).filter((n) => n.startsWith(`${id}__${SESSAO}__`)).sort();
  if (!arquivos.length) return { erro: `JSON bruto de ${id} não está em results/raw` };
  const raw = JSON.parse(fs.readFileSync(path.join(EVAL, 'results', 'raw', arquivos.at(-1)), 'utf8'));
  if (raw.status !== 'ok' || !raw.domPost) return { erro: `run ${id} terminou em ${raw.status}: ${raw.error || ''}` };
  return { html: raw.domPost, ref: id };
}
function lidas() {
  if (!fs.existsSync(CSV)) return new Set();
  return new Set(fs.readFileSync(CSV, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => { const c = l.split(','); return `${c[2]}|${c[3]}`; }));
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function indice(filtro) {
  const feitas = lidas();
  const visiveis = paginas.map((p, i) => ({ p, i })).filter(({ p }) => !filtro || p.estrato === filtro);
  const porEstrato = ESTRATOS.filter((e) => visiveis.some(({ p }) => p.estrato === e)).map((e) => {
    const linhas = visiveis.filter(({ p }) => p.estrato === e).map(({ p, i }) => {
      const celulas = CONDICOES.map((c) => {
        const d = domDe(p.url, c); const ok = feitas.has(`${p.url}|${c}`);
        return d.erro ? `<td><span class="erro" title="${esc(d.erro)}">indisponível</span></td>` : `<td><a href="/p/${i}/${c}" target="_blank" rel="noopener">${c}</a>${ok ? ' <strong>✓ lida</strong>' : ''}</td>`;
      }).join('');
      return `<tr><th scope="row">${i} · ${esc(p.site)} — ${p.papel}</th>${celulas}<td><a href="/f/${i}">registrar</a></td></tr>`;
    }).join('\n');
    return `<h2 id="e-${e}">${NOME_ESTRATO[e]} (${visiveis.filter(({ p }) => p.estrato === e).length} páginas)</h2><table><thead><tr><th scope="col">Página</th>${CONDICOES.map((c) => `<th scope="col">${c}</th>`).join('')}<th scope="col">Formulário</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }).join('\n');
  const filtros = ['<a href="/">todas</a>'].concat(ESTRATOS.map((e) => `<a href="/?estrato=${e}"${filtro === e ? ' aria-current="page"' : ''}>${e}</a>`)).join(' · ');
  const totalLidas = paginas.reduce((n, p) => n + CONDICOES.filter((c) => feitas.has(`${p.url}|${c}`)).length, 0);
  return pagina('Roteiro WAVE — amostra do Estudo 1', `
<p>Para cada página e estado: abra o link (nova aba), acione a WAVE no seu Chrome (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd>), deixe o painel visível e capture com <code>eval/tools/wave-captura.py</code>, ou <a href="#como">registre</a> à mão. ${paginas.length} páginas × ${CONDICOES.length} estados; ${totalLidas} leituras gravadas em <code>${esc(path.relative(path.resolve(EVAL, '..'), CSV))}</code>.</p>
<p>Filtrar por estrato: ${filtros}</p>
${porEstrato}
<h2 id="como">Como ler o painel da WAVE</h2><ol><li>Errors, Contrast Errors, Alerts, Features, Structural Elements, ARIA: os seis números do resumo, mais o AIM Score.</li><li>Durante as capturas, mantenha o mouse fora da barra de abas (a miniatura cobre o painel).</li><li>Não salve relatórios da WAVE; só os totais entram na planilha.</li></ol>`);
}
function formulario(i) {
  const p = paginas[i];
  const opcoes = CONDICOES.map((c) => `<option value="${c}">${c}</option>`).join('');
  const campos = ['erros', 'erros_contraste', 'alertas', 'recursos', 'estrutura', 'aria'].map((k) => `<p><label for="${k}">${k.replace('_', ' ')}</label> <input id="${k}" name="${k}" type="number" min="0" required inputmode="numeric"></p>`).join('');
  return pagina(`Registrar: ${esc(p.site)} — ${p.papel}`, `
<p><a href="/">← voltar à lista</a></p><p>${esc(p.url)}</p>
<form method="post" action="/salvar/${i}">
<p><label for="condicao">Estado avaliado</label> <select id="condicao" name="condicao" required>${opcoes}</select></p>
${campos}
<p><label for="observacoes">Observações</label> <input id="observacoes" name="observacoes" size="60"></p>
<p><label for="coletado_por">Coletado por</label> <input id="coletado_por" name="coletado_por" required></p>
<p><button type="submit">Gravar linha</button></p></form>`);
}
function pagina(titulo, corpo) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titulo)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:72rem;padding:0 1rem;color:#111;background:#fff}table{border-collapse:collapse}th,td{border:1px solid #666;padding:.4rem .6rem;text-align:left}a{color:#0645ad}.erro{color:#8a1c1c}kbd{border:1px solid #666;padding:0 .3em;border-radius:3px}label{display:inline-block;min-width:11rem}</style></head>
<body><h1>${esc(titulo)}</h1>${corpo}</body></html>`;
}
function csvCampo(v) { v = String(v ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORTA}`);
  const html = (code, body) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(body); };
  let m;
  if (u.pathname === '/') return html(200, indice(u.searchParams.get('estrato')));
  if ((m = u.pathname.match(/^\/p\/(\d+)\/([\w.-]+)$/))) {
    const p = paginas[Number(m[1])]; if (!p || !CONDICOES.includes(m[2])) return html(404, pagina('Não encontrada', ''));
    const d = domDe(p.url, m[2]); if (d.erro) return html(404, pagina('Indisponível', `<p>${esc(d.erro)}</p>`));
    // sem CSP de scripts: a WAVE precisa injetar seu painel; os <script> da página já saíram no snapshot/serialização
    return html(200, d.html);
  }
  if ((m = u.pathname.match(/^\/f\/(\d+)$/)) && paginas[Number(m[1])]) return html(200, formulario(Number(m[1])));
  if ((m = u.pathname.match(/^\/salvar\/(\d+)$/)) && req.method === 'POST' && paginas[Number(m[1])]) {
    let corpo = ''; req.on('data', (c) => { corpo += c; }); req.on('end', () => {
      const f = Object.fromEntries(new URLSearchParams(corpo)); const p = paginas[Number(m[1])];
      if (!CONDICOES.includes(f.condicao)) return html(400, pagina('Erro', '<p>estado inválido</p>'));
      const d = domDe(p.url, f.condicao);
      fs.mkdirSync(path.dirname(CSV), { recursive: true });
      if (!fs.existsSync(CSV)) fs.writeFileSync(CSV, COLS.join(',') + '\n');
      const linha = [p.site, p.papel, p.url, f.condicao, f.erros, f.erros_contraste, f.alertas, f.recursos, f.estrutura, f.aria, f.observacoes || '', f.coletado_por, new Date().toISOString(), f.condicao === 'baseline' ? d.ref : '', f.condicao === 'baseline' ? '' : d.ref];
      fs.appendFileSync(CSV, linha.map(csvCampo).join(',') + '\n');
      html(200, pagina('Gravado', `<p>Linha gravada: ${esc(p.site)} — ${p.papel} — ${esc(f.condicao)}.</p><p><a href="/">← voltar à lista</a></p>`));
    });
    return;
  }
  html(404, pagina('Não encontrada', '<p><a href="/">lista</a></p>'));
});
servidor.listen(PORTA, '127.0.0.1', () => {
  const faltam = paginas.flatMap((p) => CONDICOES.map((c) => ({ p, c, d: domDe(p.url, c) }))).filter((x) => x.d.erro);
  console.log(`Roteiro WAVE em http://127.0.0.1:${PORTA}/  (${paginas.length} páginas × ${CONDICOES.length} estados; sessão ${SESSAO}; filtro /?estrato=A..F,controle)`);
  for (const x of faltam) console.log(`  indisponível: ${x.p.site} — ${x.p.papel} — ${x.c}: ${x.d.erro}`);
  console.log('Ctrl+C encerra.');
});
