# Harness de avaliação — Accessify (estudo JIS)

Roda a avaliação de forma automática: lista de URLs → snapshot congelado → baseline (sem plugin) → plugin v1.0.0 → plugin v1.1.0 (e variantes) → métricas em CSV. Tudo com modelos locais no Ollama.

Decisões e desvios do estudo: [`docs/ESTADO_ATUAL.md`](../docs/ESTADO_ATUAL.md).

## Pré-requisitos

- Node 22+.
- Ollama em `http://127.0.0.1:11434`, iniciado com:
  - `OLLAMA_ORIGINS=chrome-extension://*` (sem isso a extensão recebe 403);
  - `OLLAMA_CONTEXT_LENGTH=4096` (decisão D8; o mesmo valor em todas as máquinas);
  - `OLLAMA_KEEP_ALIVE=30m` ou mais, para não recarregar o modelo a cada run (o harness também pede `keep_alive` de `config.json` ao carregar o modelo).
- Modelos: `ollama pull qwen3:8b` (condições v1.0.0, v1.1.0 e v1.1.0-fix) e `ollama pull gemma3:4b` para a v1.1.0-vision (decisão D9: o `qwen3-vl:8b` raciocina mesmo com `reasoning_effort: "none"`; ver `docs/ESTADO_ATUAL.md`).
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

`--urls`, `--snapshots` e `--resultados` trocam a lista e as pastas (relativas à pasta atual), para testes que não podem tocar nos dados do lote. `EVAL_DEBUG=1` mostra quanto cada etapa da captura levou.

`urls.csv`: uma URL que não abre (sem esquema, vazia) vira `falha` com motivo, na captura e no run; uma URL repetida (a mesma página em dois estratos) vale só na primeira linha e fica registrada na sessão.

## Como um lote roda

- **Ordem.** A `baseline` roda primeiro. Dentro de uma condição, as execuções são intercaladas (`--execucoes 3`: todas as URLs na execução 1, depois todas na 2…), para a segunda execução de uma URL não vir logo depois da primeira com o cache de prompt do Ollama quente.
- **Extensões.** Cada extensão é copiada uma vez no início da sessão; todas as condições e relançamentos usam a mesma cópia (o hash dela é conferido a cada lançamento), mesmo que a pasta de trabalho mude durante o lote.
- **Modelo.** Antes da primeira URL de uma condição com modelo, o harness confere o Ollama e o modelo, carrega o modelo (o tempo de carga não entra no primeiro run) e confere o contexto efetivo (D8). Depois de cada run, o contexto é conferido de novo; qualquer diferença vai para `observacoes`. Ollama fora do ar ou modelo ausente: as linhas da condição viram `falha` com o motivo, sem rodar.
- **Prazos.** Cada run tem um prazo total (`timeouts.runWatchdogMs`); o watchdog fecha as abas do run, cancela o que ainda estiver rodando (nada dele grava baseline ou mexe no run seguinte) e relança o navegador da condição. O axe tem prazo próprio (`evaluatorMs`).
- **Tentativas.** Uma falha ganha uma nova tentativa (`retries`). Se o navegador da condição cair, ele é relançado e a queda não conta como tentativa do plugin (até duas vezes). Se não conseguir abrir, a URL vira `falha` e a próxima tenta de novo; depois de `launchRetries` falhas seguidas, o resto da condição vira `falha` com o motivo. O lote nunca para por causa de uma URL.
- **Baseline.** `novos_erros_axe` compara com a baseline do mesmo snapshot (sha256 do HTML, do HAR e da pasta), do mesmo axe (versão e tags) e do mesmo ambiente (Chromium, viewport, locale). Na sessão, vale a da própria sessão; uma condição rodada em outra sessão usa a mais recente dos JSON brutos pelo início do run. Sem ela, `novos_erros_axe` fica vazio e o motivo vai para `observacoes`.
- **Arquivos.** JSON bruto e linhas do CSV são gravados com novas tentativas (antivírus e indexador seguram arquivos no Windows); um JSON bruto nunca sobrescreve outro. A sessão é gravada no início, a cada condição e a cada erro do harness, sempre por arquivo temporário + troca de nome. Perfis temporários do Chromium e cópias das extensões são apagados no fim.

## Condições (`config.json`)

| Condição | Extensão | Como é acionada | Modelo |
|---|---|---|---|
| `baseline` | nenhuma | — | — |
| `v1.0.0` | cópia de `../../accessify-v1` | painel real (`popup.html` numa aba, Analisar → Aplicar) + adaptador de provedor: uma rota de contexto troca o OpenRouter pelo Ollama, com o modelo e `temperature: 0` da condição | `qwen3:8b` |
| `v1.1.0` | cópia do repositório | gancho C11 (`accessify:run`), que aplica o mesmo payload do painel | `qwen3:8b`, raciocínio como a v1.1.0 manda |
| `v1.1.0-fix` | idem | gancho, `reasoning: "none"` | `qwen3:8b` |
| `v1.1.0-vision` | idem | gancho, `vision: true`, `reasoning: "none"`, só no estrato `visao` | `gemma3:4b` (decisão D9, provisória) |

Cada condição roda num contexto de navegador próprio, com perfil novo e só a extensão dela. O perfil grava `automationHookEnabled: true`, o opt-in do gancho: no navegador do dia a dia o gancho fica desligado.

Prazos dos drivers: o gancho tem `hookMs`; o harness espera `hookMs + hookGraceMs`, mais que o teto de segurança do content script (`hookMs` + 60 s), então sempre lê um resultado. Se o resultado for esse teto (o service worker não respondeu), o driver espera a resposta tardia por `hookLateMs` antes de medir. O painel da v1.0.0 tem `panelMs` para a análise e `applyMs` para o Aplicar; cada chamada ao Ollama pelo adaptador tem `llmCallMs`.

## Saídas

| Arquivo | Versionado | Conteúdo |
|---|---|---|
| `urls.csv` | sim | `url,estrato` |
| `snapshots/index.csv` | sim | uma linha por captura (append-only; vale a `ok` mais recente de cada URL): URL final, status HTTP, hashes, HAR, iframes, shadow roots, CSSOM, `<noscript>`, codificação, compatMode, espera, verificação do replay, suspeita de desafio anti-bot |
| `snapshots/<slug>/<data>/` | não | `page.html`, `page.har` e os arquivos de recurso dele, `frames/` + `frames.json` (iframes congelados), `page.png` (captura) e `replay.png` (replay de verificação). Conteúdo de terceiros: arquivar à parte |
| `results/runs.csv` | sim | uma linha por URL × condição × execução (append-only) |
| `results/runs.pendentes.csv` | sim, se existir | linhas que não entraram no `runs.csv` depois das tentativas de escrita |
| `results/raw/<run_id>__<sessao>__a<N>.json` | não | uma por tentativa: resultado do driver (com o runLog do C10 na v1.1.0 e as chamadas do adaptador na v1.0.0), axe completo, baseline usada, DOM pós (com doctype e shadow roots), rótulos genéricos, contexto do Ollama, requisições abortadas, animações congeladas e rolagem restaurada |
| `results/sessions/<sessao>.json` | sim | versões (Node, Playwright, axe, Chromium), Ollama (versão, digests, carga e contexto por condição), procedência das extensões, lançamentos e relançamentos, chamadas recusadas fora de um run, avisos e erros do harness |

## Colunas de `runs.csv`

- `sessao`, `data_coleta` (data do snapshot), `model_digest` (digest do modelo no Ollama, lido na carga da condição), `execucao` e `tentativas`.
- `versao_plugin`: `git describe` do repositório da extensão, com `-dirty` só se os arquivos da própria extensão tiverem alteração.
- `status`: `ok`, `parcial` (o run aplicou, mas alguma chamada ao LLM falhou ou a visão não teve imagem) ou `falha` (com o motivo em `observacoes`; motivos do próprio harness começam com `harness:`). Falha é dado do estudo.
- `snapshot_sha256` e `raw_sha256` ligam a linha ao snapshot e ao JSON bruto arquivados.
- `har_abortados`: requisições do replay que falharam (fora do HAR ou bloqueadas) e poderiam mudar a renderização: CSS, imagens, fontes, XHR. Scripts e navegações de iframes não congelados ficam de fora da conta; a lista completa, com tipo e erro, fica no JSON bruto.
- `axe_violations_*`: pares (regra, nó) com violação, pelo impacto do nó, com as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` (um elemento que falha em duas regras conta duas vezes, como no axe). `axe_elementos`: elementos distintos com alguma violação. `axe_incomplete`: pares (regra, nó) que o axe não conseguiu decidir.
- `novos_erros_axe`: pares (regra, alvo) do pós que não existiam no baseline do mesmo snapshot. `novos_erros_axe_regra`: soma, por regra, do quanto o número de nós com violação cresceu (não depende dos seletores, que o plugin pode mudar ao renomear IDs).
- `rotulos_genericos`: rótulos de fallback novos no DOM ("Abrir link N", "Acionar botão N", alt "Imagem" etc.), medidos pelo harness do mesmo jeito em todas as condições.
- `tokens_in`, `tokens_out`, `latencia_ms`: soma das chamadas ao LLM do run (do runLog na v1.1.0, do adaptador na v1.0.0). `latencia_ms` soma a latência de cada chamada; não é o tempo total do run. Vazios (com motivo em `observacoes`) quando o run da v1.1.0 não devolveu o runLog.

## Snapshots

A captura espera a rede e o DOM assentarem (com teto) e serializa o DOM renderizado com shadow roots, estado de formulários e o doctype real. Os `<style>` cujo CSSOM foi alterado por script (regras inseridas, CSS-in-JS) e as folhas adotadas viram `<style>` com o texto efetivo. Os `<script>` saem; os handlers inline (`onclick`, `onfocus`…) ficam no DOM, como na página real, e a CSP do replay os impede de rodar. O conteúdo dos `<noscript>` é esvaziado: com scripts ligados ele nunca aparece, e reparseado viraria elementos visíveis. Numa página que não está em UTF-8, URLs com acento viram a forma absoluta que o navegador usou. Os iframes são congelados do mesmo jeito, sob a URL final e sob o `src` do `<iframe>`. Documentos com Trusted Types obrigatório usam uma política própria; se a página também proibir políticas, o documento é clonado e os shadow roots perdidos são contados.

O HAR é limpo: saem as respostas com status ≤ 0, as que não tiveram o corpo gravado (o replay serviria um 200 vazio) e as repetidas. Cada captura tem prazo total (`captureMs`); o navegador é relançado se cair.

Antes de entrar no índice, a captura é reaberta em replay e comparada com a página real: fração de pixels diferentes entre `page.png` e `replay.png` e diferença no tamanho do texto visível. Fica `suspeito` (e o run não usa, com o motivo em `observacoes`) se a tela ou o texto passarem dos limites de `config.json` (`replay`), se o load do replay não terminar, se o `compatMode` mudar ou se a página parecer um desafio anti-bot.

No replay, o documento principal e os iframes congelados vêm do disco com a CSP `script-src 'none'`: nenhum JavaScript da página roda. CSS, imagens e fontes vêm do HAR; o que não estiver lá é abortado e contado (`har_abortados`). Iframes não congelados são bloqueados e só a primeira navegação do frame principal é atendida (um meta refresh não troca a página no meio do run). As animações CSS vão para um estado fixo (as finitas terminam, as infinitas param no início), igual em todas as condições. Assim o contraste e o conteúdo não mudam entre condições. As rotas são da página: o service worker da extensão continua falando com o Ollama. Antes de medir, a rolagem da janela e de cada contêiner rolável volta ao estado de antes do driver (o caminho de visão rola até as imagens) e as animações são congeladas de novo.
