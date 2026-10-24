// Testa na prática o que o plano assume sobre o /v1/chat/completions do Ollama.
// Uso: node eval/tools/probe-ollama-v1.mjs <arquivo-de-saida.json> [--vision]
// Resultado de 23/10/2026 (esta versão do script): docs/evidencias/ollama-v1-probe-2026-10-23.json
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:11434';
const out = process.argv[2];
const withVision = process.argv.includes('--vision');
const results = { startedAt: new Date().toISOString(), cases: [] };

async function post(path, body) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* resposta não-JSON */ }
  return { status: res.status, ms: Math.round(performance.now() - t0), json, text: json ? undefined : text.slice(0, 500) };
}

async function ps() {
  const res = await fetch(`${BASE}/api/ps`);
  return (await res.json()).models?.map((m) => ({ name: m.name, context_length: m.context_length, size_vram: m.size_vram })) || [];
}

function summarize(r) {
  const msg = r.json?.choices?.[0]?.message || {};
  return {
    status: r.status,
    ms: r.ms,
    model: r.json?.model,
    system_fingerprint: r.json?.system_fingerprint,
    usage: r.json?.usage,
    finish_reason: r.json?.choices?.[0]?.finish_reason,
    contentChars: typeof msg.content === 'string' ? msg.content.length : null,
    content: msg.content,
    reasoning: msg.reasoning,
    reasoningField: Object.keys(msg).filter((k) => /reason|think/i.test(k)),
    reasoningChars: typeof msg.reasoning === 'string' ? msg.reasoning.length : null,
    contentHasThinkTag: typeof msg.content === 'string' && /<think>/i.test(msg.content),
    error: r.json?.error || r.text
  };
}

async function runCase(name, body) {
  process.stdout.write(`${name}... `);
  const r = await post('/v1/chat/completions', body);
  const entry = { name, request: { ...body, messages: '[omitido]' }, response: summarize(r), loaded: await ps() };
  results.cases.push(entry);
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`${r.status} ${r.ms}ms`);
  return entry;
}

// Prompt de alt text da v1.1.0 (buildImageContextPrompt + system de generateImageAltText) para
// uma imagem sem contexto textual: é o único caso em que a v1.1.0 local chama o LLM.
const altMessages = [
  { role: 'system', content: 'Você é um especialista em acessibilidade web. Gere um texto alternativo conciso e descritivo. O texto deve ter entre 10 e 100 caracteres. Responda APENAS com o texto alternativo, sem explicações adicionais.' },
  { role: 'user', content: 'Gere um alt text curto (10 a 100 caracteres) para esta imagem.\nDescreva só o que é visível ou o que o contexto da página indica com segurança.\nNão invente detalhes. Responda APENAS com o texto alternativo.\nNome do arquivo: IMG_2034.jpg\nDimensões: 800x600' }
];

const model = 'qwen3:8b';

// 1. Corpo exatamente como a v1.1.0 envia no modo local (chatCompletion)
await runCase('v110-local-body', {
  model, messages: altMessages, max_tokens: 64, temperature: 0.3,
  think: false, chat_template_kwargs: { enable_thinking: false },
  options: { temperature: 0.3, num_predict: 64, num_ctx: 2048 }
});
// 2. Sem nenhum campo de raciocínio: o default do modelo pensa?
await runCase('no-think-fields', { model, messages: altMessages, max_tokens: 64, temperature: 0 });
// 3. Mecanismo OpenAI de raciocínio
await runCase('reasoning-effort-none', { model, messages: altMessages, max_tokens: 64, temperature: 0, reasoning_effort: 'none' });
// 4. Determinismo: mesmo corpo duas vezes com temperature 0 + seed
const detBody = { model, messages: altMessages, max_tokens: 64, temperature: 0, seed: 42, think: false };
const d1 = await runCase('determinism-1', detBody);
const d2 = await runCase('determinism-2', detBody);
// Compara resposta e raciocínio: com o raciocínio ligado, content pode vir vazio nas duas
results.determinismSameOutput = d1.response.content === d2.response.content
  && d1.response.reasoning === d2.response.reasoning;
// 5. num_ctx via options: o /api/ps mostra o contexto efetivo do modelo carregado
await runCase('options-num-ctx-8192', { model, messages: altMessages, max_tokens: 16, temperature: 0, think: false, options: { num_ctx: 8192 } });

if (withVision) {
  // PNG 64x64: metade esquerda vermelha, metade direita azul
  const w = 64, h = 64;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      if (x < w / 2) { raw[o] = 220; raw[o + 1] = 20; raw[o + 2] = 20; } else { raw[o] = 20; raw[o + 1] = 40; raw[o + 2] = 220; }
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;

  let hits = 0;
  const server = http.createServer((req, res) => { hits++; res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(png); });
  await new Promise((r) => server.listen(18765, '127.0.0.1', r));

  const visionPrompt = (url) => [{ role: 'user', content: [
    { type: 'text', text: 'Quais cores aparecem nesta imagem? Responda em uma frase curta.' },
    { type: 'image_url', image_url: { url } }
  ] }];
  for (const vm of ['qwen3-vl:8b', 'gemma4:e4b', 'gemma3:4b']) {
    await runCase(`vision-base64-${vm}`, { model: vm, messages: visionPrompt(dataUrl), max_tokens: 64, temperature: 0, think: false });
  }
  const before = hits;
  await runCase('vision-remote-url-gemma3:4b', { model: 'gemma3:4b', messages: visionPrompt('http://127.0.0.1:18765/img.png'), max_tokens: 64, temperature: 0 });
  results.remoteUrlFetchedByOllama = hits > before;
  server.close();
}

results.finishedAt = new Date().toISOString();
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log('ok');
