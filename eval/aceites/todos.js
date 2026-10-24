// Roda os aceites da Fase 5 em sequência, do mais barato ao mais caro, e grava um resumo
// na pasta de evidências. Um aceite com falha não interrompe os seguintes.
// --rapido pula o que depende do LLM (o 3 e a parte b do 4); os demais só precisam do
// Ollama no ar para a checagem do modelo do gancho (6c).
// Uso: node aceites/todos.js [--rapido] [--saida pasta]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EVAL_DIR, parseArgs } from '../src/lib/config.js';
import { REPO_DIR, today } from './lib.js';

const args = parseArgs();
const outDir = typeof args.saida === 'string' ? path.resolve(args.saida) : path.join(REPO_DIR, 'docs', 'evidencias', 'aceites', today());
const quick = !!args.rapido;

const steps = [
  { script: '1-sintaxe.js', args: [] },
  { script: '2-painel.js', args: [] },
  { script: '6-equivalencia.js', args: [] },
  { script: '5-falha-injetada.js', args: [] },
  { script: '4-determinismo.js', args: quick ? ['--sem-llm'] : [] },
  { script: '3-smoke-harness.js', args: [], skip: quick }
];

const summary = { iniciadoEm: new Date().toISOString(), rapido: quick, aceites: [] };
for (const step of steps) {
  if (step.skip) {
    summary.aceites.push({ script: step.script, status: 'pulado (--rapido)' });
    continue;
  }
  console.log(`\n### ${step.script}`);
  const startedAt = Date.now();
  let exit = 0;
  try {
    execFileSync(process.execPath, [path.join(EVAL_DIR, 'aceites', step.script), ...step.args, '--saida', outDir], { cwd: EVAL_DIR, stdio: 'inherit' });
  } catch (error) {
    exit = error.status ?? 1;
  }
  summary.aceites.push({ script: step.script, args: step.args, status: exit === 0 ? 'ok' : 'falha', duracaoS: Math.round((Date.now() - startedAt) / 1000) });
}
summary.terminadoEm = new Date().toISOString();
summary.ok = summary.aceites.every((item) => item.status !== 'falha');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'resumo.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log('\nResumo:');
summary.aceites.forEach((item) => console.log(`  ${item.status.padEnd(18)} ${item.script}${item.duracaoS !== undefined ? ` (${item.duracaoS} s)` : ''}`));
process.exit(summary.ok ? 0 : 1);
