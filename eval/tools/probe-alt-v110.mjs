// Reproduz, fora da extensão, o alt text que a v1.1.0 local gravaria para uma imagem que
// chega ao LLM: corpo de chatCompletion() + extractMessageText() + normalizeAltText().
// No modo local, processImages() só chama o LLM quando buildHeuristicImageAlt() não acha
// figcaption, title, nome do pai ou texto adjacente com 8+ caracteres; então o prompt real
// dessas imagens traz só nome do arquivo e dimensões (buildImageContextPrompt).
// Uso: node eval/tools/probe-alt-v110.mjs <arquivo-de-saida.json>
import fs from 'node:fs';

const out = process.argv[2];
const cases = [
  { fileName: 'IMG_2034.jpg', width: 800, height: 600 },
  { fileName: 'banner-home.webp', width: 1200, height: 400 }
];

const stripThinking = (t) => (typeof t === 'string' ? t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '').trim() : '');
const extractMessageText = (m) => { let c = typeof m.content === 'string' ? m.content : ''; if (!c && typeof m.reasoning === 'string') c = m.reasoning; return stripThinking(c).trim(); };
const normalizeAltText = (a) => { const n = a.replace(/\s+/g, ' ').trim(); if (n.length <= 100) return n; const t = n.slice(0, 100); const s = t.lastIndexOf(' '); return (s > 60 ? t.slice(0, s) : t).trim(); };

const buildImageContextPrompt = (image) => [
  'Gere um alt text curto (10 a 100 caracteres) para esta imagem.',
  'Descreva só o que é visível ou o que o contexto da página indica com segurança.',
  'Não invente detalhes. Responda APENAS com o texto alternativo.',
  `Nome do arquivo: ${image.fileName}`,
  `Dimensões: ${image.width}x${image.height}`
].join('\n');

const results = { startedAt: new Date().toISOString(), cases: [] };
for (const image of cases) {
  const body = {
    model: 'qwen3:8b', max_tokens: 64, temperature: 0.3,
    think: false, chat_template_kwargs: { enable_thinking: false },
    options: { temperature: 0.3, num_predict: 64, num_ctx: 2048 },
    messages: [
      { role: 'system', content: 'Você é um especialista em acessibilidade web. Gere um texto alternativo conciso e descritivo. O texto deve ter entre 10 e 100 caracteres. Responda APENAS com o texto alternativo, sem explicações adicionais.' },
      { role: 'user', content: buildImageContextPrompt(image) }
    ]
  };
  const t0 = performance.now();
  const res = await fetch('http://127.0.0.1:11434/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  results.cases.push({
    image,
    status: res.status,
    ms: Math.round(performance.now() - t0),
    finish_reason: data.choices?.[0]?.finish_reason,
    usage: data.usage,
    content: msg.content,
    reasoning: msg.reasoning,
    altGravadoPelaV110: normalizeAltText(extractMessageText(msg)),
    error: data.error
  });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`${image.fileName}: ${JSON.stringify(results.cases.at(-1).altGravadoPelaV110)}`);
}
results.finishedAt = new Date().toISOString();
fs.writeFileSync(out, JSON.stringify(results, null, 2));
