# Harness de avaliação — Accessify (estudo JIS)

Roda a avaliação de forma automática: lista de URLs → snapshot congelado → baseline (sem plugin) → plugin v1.0.0 → plugin v1.1.0 (e variantes) → métricas em CSV. Tudo com modelos locais no Ollama.

Decisões e desvios do estudo: [`docs/ESTADO_ATUAL.md`](../docs/ESTADO_ATUAL.md).

## Pré-requisitos

- Node 22+.
- Ollama em `http://127.0.0.1:11434`, iniciado com:
  - `OLLAMA_ORIGINS=chrome-extension://*` (sem isso a extensão recebe 403);
  - `OLLAMA_CONTEXT_LENGTH=4096` (decisão D8; o mesmo valor em todas as máquinas);
  - `OLLAMA_KEEP_ALIVE=30m` ou mais, para não recarregar o modelo a cada run.
- Modelos: `ollama pull qwen3:8b` (condições v1.0.0, v1.1.0 e v1.1.0-fix) e `ollama pull gemma3:4b` ou outro modelo de visão sem raciocínio para a v1.1.0-vision (o `qwen3-vl:8b` raciocina mesmo com `reasoning_effort: "none"`; ver `docs/ESTADO_ATUAL.md`).
- GPU: driver com suporte ao CUDA do Ollama instalado. Sem isso, use `CUDA_VISIBLE_DEVICES=-1` (e `OLLAMA_VULKAN=0` se o codificador de imagem cair no Vulkan): fica só CPU e bem mais lento.
- A extensão v1.0.0 em `../../accessify-v1` (worktree da tag `v1.0.0-semish`). O harness copia as extensões para pastas temporárias e nunca carrega as pastas originais.

## Instalação

```bash
npm ci
npx playwright install chromium
```

## Uso

```bash
# 1. Captura os snapshots (DOM sem scripts + HAR) de eval/urls.csv
node src/capture.js
node src/capture.js --estrato smoke

# 2. Roda as condições sobre os snapshots
node src/run.js --smoke                          # 3 URLs × {baseline, v1.0.0, v1.1.0}
node src/run.js --conditions baseline,v1.1.0 --limit 10
node src/run.js --execucoes 3 --estrato variancia
```

A `baseline` roda primeiro dentro de um lote. Uma condição rodada em outro lote procura a baseline nos JSON brutos: vale a mais recente com `status: ok` do mesmo snapshot (sha256 do HTML e do HAR) e do mesmo axe (versão e tags). Sem ela, `novos_erros_axe` fica vazio e o motivo vai para `observacoes`.

Cada run tem um prazo total (`timeouts.runWatchdogMs`). Uma falha ganha uma nova tentativa (`retries`); se o navegador da condição cair, ele é relançado e a queda fica na sessão como erro do harness. O lote nunca para por causa de uma URL.

## Condições (`config.json`)

| Condição | Extensão | Como é acionada | Modelo |
|---|---|---|---|
| `baseline` | nenhuma | — | — |
| `v1.0.0` | cópia de `../../accessify-v1` | painel real (`popup.html` numa aba, Analisar → Aplicar) + adaptador de provedor: uma rota de contexto troca o OpenRouter pelo Ollama, com o modelo e `temperature: 0` da condição | `qwen3:8b` |
| `v1.1.0` | cópia do repositório | gancho C11 (`accessify:run`), que aplica o mesmo payload do painel | `qwen3:8b`, raciocínio como a v1.1.0 manda |
| `v1.1.0-fix` | idem | gancho, `reasoning: "none"` | `qwen3:8b` |
| `v1.1.0-vision` | idem | gancho, `vision: true`, `reasoning: "none"`, só no estrato `visao` | `gemma3:4b` (decisão D9, provisória) |

Cada condição roda num contexto de navegador próprio, com perfil novo e só a extensão dela. O perfil grava `automationHookEnabled: true`, o opt-in do gancho: no navegador do dia a dia o gancho fica desligado.

## Saídas

| Arquivo | Versionado | Conteúdo |
|---|---|---|
| `urls.csv` | sim | `url,estrato` |
| `snapshots/index.csv` | sim | uma linha por captura (append-only; vale a `ok` mais recente de cada URL): URL final, status HTTP, sha256 do HTML e do HAR, frames congelados, shadow roots, compatMode, espera, verificação do replay, suspeita de desafio anti-bot |
| `snapshots/<slug>/<data>/` | não | `page.html`, `page.har`, `frames/` + `frames.json` (iframes congelados), `page.png` (captura) e `replay.png` (replay de verificação). Conteúdo de terceiros: arquivar à parte |
| `results/runs.csv` | sim | uma linha por URL × condição × execução (append-only) |
| `results/runs.pendentes.csv` | sim, se existir | linhas que não entraram no `runs.csv` depois de 3 tentativas de escrita |
| `results/raw/<run_id>__<sessao>__a<N>.json` | não | uma por tentativa: resultado do driver (com o runLog do C10 na v1.1.0 e as chamadas do adaptador na v1.0.0), axe completo, DOM pós, rótulos genéricos, requisições abortadas e contadores do replay |
| `results/sessions/<data>.json` | sim | gravada no início e a cada condição: versões (Node, Playwright, axe, Chromium), Ollama (versão, digests, modelos carregados, contexto efetivo), procedência das extensões, relançamentos e erros do harness |

## Colunas de `runs.csv`

- `sessao`, `data_coleta` (data do snapshot), `model_digest` (digest do modelo no Ollama), `execucao` e `tentativas`.
- `status`: `ok`, `parcial` (o run aplicou, mas alguma chamada ao LLM falhou ou a visão não teve imagem) ou `falha` (com o motivo em `observacoes`). Falha é dado do estudo.
- `snapshot_sha256` e `raw_sha256` ligam a linha ao snapshot e ao JSON bruto arquivados.
- `har_abortados`: requisições do replay que falharam (fora do HAR ou bloqueadas) e poderiam mudar a renderização: CSS, imagens, fontes, XHR. Scripts e navegações de iframes não congelados ficam de fora da conta; a lista completa, com tipo e erro, fica no JSON bruto.
- `axe_violations_*`: nós (elementos) com violação, por impacto, com as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. `axe_incomplete`: nós que o axe não conseguiu decidir.
- `novos_erros_axe`: pares (regra, alvo) do pós que não existiam no baseline do mesmo snapshot. `novos_erros_axe_regra`: soma, por regra, do quanto o número de nós com violação cresceu (não depende dos seletores, que o plugin pode mudar ao renomear IDs).
- `rotulos_genericos`: rótulos de fallback novos no DOM ("Abrir link N", "Acionar botão N", alt "Imagem" etc.), medidos pelo harness do mesmo jeito em todas as condições.
- `tokens_in`, `tokens_out`, `latencia_ms`: soma das chamadas ao LLM do run (do runLog na v1.1.0, do adaptador na v1.0.0).

## Snapshots

A captura espera a rede e o DOM assentarem (com teto), serializa o DOM renderizado com shadow roots, CSSOM sincronizado (regras inseridas por script), estado de formulários e o doctype real, tira os `<script>` e os handlers inline, e congela os iframes do mesmo jeito. O HAR é limpo (sem respostas com status ≤ 0 nem entradas repetidas). Antes de entrar no índice, a captura é reaberta em replay e verificada.

No replay, o documento principal e os iframes congelados vêm do disco com a CSP `script-src 'none'`: nenhum JavaScript da página roda. CSS, imagens e fontes vêm do HAR; o que não estiver lá é abortado e contado (`har_abortados`). Iframes não congelados são bloqueados e só a primeira navegação do frame principal é atendida (um meta refresh não troca a página no meio do run). Assim o contraste e o conteúdo não mudam entre condições. As rotas são da página: o service worker da extensão continua falando com o Ollama. Antes de medir, a página volta ao topo (o caminho de visão rola até as imagens).
