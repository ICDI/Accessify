# Harness de avaliação — Accessify (estudo JIS)

Roda a avaliação de forma automática: lista de URLs → snapshot congelado → baseline (sem plugin) → plugin v1.0.0 → plugin v1.1.0 (e variantes) → métricas em CSV (axe-core e IBM Equal Access). Tudo com modelos locais no Ollama.

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

`urls.csv`: uma URL que não abre (sem esquema, vazia) vira `falha` com motivo, na captura e no run. Uma URL em mais de uma linha (a mesma página na amostra e num subconjunto, como `visao` ou `variancia`) vira uma entrada só, com todos os estratos: um snapshot, um `run_id` por execução, e o filtro `--estrato` e os estratos de uma condição valem para qualquer um deles. A coluna `estrato` junta todos com `+`. Uma condição sem nenhuma URL elegível é avisada no console e na sessão.

## Como um lote roda

- **Ordem.** A `baseline` roda primeiro. Dentro de uma condição, as execuções são intercaladas (`--execucoes 3`: todas as URLs na execução 1, depois todas na 2…), para a segunda execução de uma URL não vir logo depois da primeira com o cache de prompt do Ollama quente.
- **Extensões.** Cada extensão é copiada uma vez no início da sessão; todas as condições e relançamentos usam a mesma cópia (o hash dela é conferido a cada lançamento), mesmo que a pasta de trabalho mude durante o lote.
- **Modelo.** Antes da primeira URL de uma condição com modelo, o harness confere o Ollama e o modelo, carrega o modelo (o tempo de carga não entra no primeiro run) e confere o contexto efetivo (D8). Depois de cada run, o contexto é conferido de novo; qualquer diferença vai para `observacoes`. Ollama fora do ar ou modelo ausente: as linhas da condição viram `falha` com o motivo, sem rodar.
- **Prazos.** Cada run tem um prazo total (`timeouts.runWatchdogMs`); o watchdog fecha as abas do run, cancela o que ainda estiver rodando (nada dele grava baseline ou mexe no run seguinte) e relança o navegador da condição. O axe e o IBM têm prazo próprio (`evaluatorMs`); um estouro do IBM vira `ibm_status: erro` e não muda o `status` do run.
- **Tentativas.** Uma falha ganha uma nova tentativa (`retries`). Falhas do próprio harness não contam como tentativa do plugin (até duas por URL): o navegador da condição caiu (é relançado), o replay não abriu, ou a medição (axe, DOM pós) falhou depois do driver; nesse último caso o resultado do driver e o uso do LLM ficam no JSON bruto e na linha. Se o navegador não conseguir abrir, a URL vira `falha` e a próxima tenta de novo; depois de `launchRetries` falhas seguidas, o resto da condição vira `falha` com o motivo. O lote nunca para por causa de uma URL; um erro inesperado do harness fecha o navegador aberto e registra `aborted` na sessão.
- **Baseline.** `novos_erros_axe` compara com a baseline do mesmo snapshot (sha256 do HTML, do HAR e da pasta), do mesmo axe (versão e tags) e do mesmo ambiente (Chromium, viewport, locale e o hash do código do harness: uma mudança no replay ou na medição invalida baselines antigas). Na sessão, vale a da própria sessão; uma condição rodada em outra sessão usa a mais recente dos JSON brutos pelo início do run. O IBM da baseline é escolhido à parte: o mais recente do mesmo snapshot e ambiente com a mesma versão do motor, o mesmo conjunto de regras e o mesmo formato dos resultados (uma execução da baseline em que o IBM deu erro não esconde outra em que ele rodou). Sem baseline, `novos_erros_*` ficam vazios e o motivo vai para `observacoes`.
- **Arquivos.** JSON bruto, linhas do CSV e a sessão são gravados com novas tentativas (antivírus e indexador seguram arquivos no Windows); um JSON bruto nunca sobrescreve outro, e uma linha do CSV não é gravada duas vezes se a nova tentativa vier depois de a escrita já ter acontecido. A sessão é gravada no início, a cada condição e a cada erro do harness, sempre por arquivo temporário + troca de nome. Perfis temporários do Chromium e cópias das extensões são apagados no fim.
- **Procedência.** A sessão registra a versão do harness (commit, `describe`, se `eval/src` ou `config.json` tinham alteração não commitada e um hash dos dois); a coluna `versao_harness` traz o `describe`, com `-dirty` quando o código do harness não era o commitado.

## Avaliadores

Os dois rodam no DOM pós de todas as condições, inclusive a baseline, nesta ordem:

1. **axe-core** (`@axe-core/playwright`), com as tags de `config.json` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`). Entra em todos os iframes congelados.
2. **IBM Equal Access** (`accessibility-checker-engine`, Apache-2.0; decisão D6), conjunto de regras `WCAG_2_1` (A e AA). O motor é injetado pelo CDP, então a CSP do replay não o bloqueia; roda por último porque deixa `ace` no escopo global da página. Avalia o documento principal, os shadow roots abertos e os iframes da mesma origem; iframes de outra origem ficam de fora. O nível de cada resultado segue o mapeamento do `accessibility-checker` (`VIOLATION`+`FAIL` → violation, `VIOLATION`+`POTENTIAL` → potentialviolation, `RECOMMENDATION`+`FAIL` → recommendation, `RECOMMENDATION`+`POTENTIAL` → potentialrecommendation, `VIOLATION`/`RECOMMENDATION`+`MANUAL` → manual). Um run em que o motor não devolve nenhum resultado (nem os que passaram, como com um conjunto de regras desconhecido) é erro do IBM, não página perfeita. Exceções de regras dentro do motor, que somem com os resultados daquela regra no elemento, ficam contadas no JSON bruto e em `observacoes`.

A WAVE automatizada ficou de fora: os termos da WebAIM proíbem uso automatizado sem a API (ver `docs/ESTADO_ATUAL.md`).

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
| `snapshots/index.csv` | sim | uma linha por captura (append-only; vale a `ok` mais recente de cada URL): URL final, status HTTP, hashes, HAR, iframes, shadow roots, CSSOM, `<noscript>`, rolagem, codificação, compatMode, espera, verificação do replay, suspeita de desafio anti-bot |
| `snapshots/aceitos.csv` | sim | capturas `suspeito` aceitas após revisão manual (URL, sha256 da pasta, justificativa, revisor, data); só essas entram no run, com o aceite em `observacoes` (D12) |
| `snapshots/<slug>/<data>/` | não | `page.html`, `page.har` e os arquivos de recurso dele, `frames/` + `frames.json` (iframes congelados), `page.png` (captura) e `replay.png` (replay de verificação). Conteúdo de terceiros: arquivar à parte |
| `results/runs.csv` | sim | uma linha por URL × condição × execução (append-only) |
| `results/runs.pendentes.csv` | sim, se existir | linhas que não entraram no `runs.csv` depois das tentativas de escrita |
| `results/raw/<run_id>__<sessao>__a<N>.json` | não | uma por tentativa: resultado do driver (com o runLog do C10 na v1.1.0 e as chamadas do adaptador na v1.0.0), axe e IBM completos, baselines usadas, DOM pós (com doctype e shadow roots), rótulos genéricos, contexto do Ollama, requisições abortadas, animações congeladas e rolagem restaurada |
| `results/sessions/<sessao>.json` | sim | versões (Node, Playwright, axe, motor do IBM, Chromium), Ollama (versão, digests, carga e contexto por condição), procedência das extensões, lançamentos e relançamentos, chamadas recusadas fora de um run, avisos e erros do harness |

## Colunas de `runs.csv`

- `sessao`, `data_coleta` (data do snapshot), `model_digest` (digest do modelo no Ollama, lido na carga da condição), `execucao` e `tentativas`.
- `versao_plugin`: `git describe` do repositório da extensão, com `-dirty` só se os arquivos da própria extensão tiverem alteração. `versao_harness`: o mesmo para o código do harness (`eval/src` e `config.json`).
- `estrato`: todos os estratos da URL, juntos com `+`.
- `status`: `ok`, `parcial` (o run aplicou, mas alguma chamada ao LLM falhou ou a visão não teve imagem) ou `falha` (com o motivo em `observacoes`; motivos do próprio harness começam com `harness:`). Falha é dado do estudo.
- `snapshot_sha256` e `raw_sha256` ligam a linha ao snapshot e ao JSON bruto arquivados.
- `har_abortados`: requisições do replay que falharam (fora do HAR ou bloqueadas) e poderiam mudar a renderização: CSS, imagens, fontes, XHR. Scripts e navegações de iframes não congelados ficam de fora da conta; a lista completa, com tipo e erro, fica no JSON bruto.
- `axe_violations_*`: pares (regra, nó) com violação, pelo impacto do nó, com as tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` (um elemento que falha em duas regras conta duas vezes, como no axe). `axe_elementos`: elementos distintos com alguma violação. `axe_incomplete`: pares (regra, nó) que o axe não conseguiu decidir.
- `ibm_violations`, `ibm_potential_violations`, `ibm_recommendations`, `ibm_potential_recommendations`, `ibm_manual`: resultados do IBM por nível; cada resultado é uma regra num elemento por um motivo (uma regra pode acusar o mesmo elemento mais de uma vez, por exemplo um por atributo em conflito). `ibm_status`: `ok` ou `erro` (o motivo vai para `observacoes`; um erro ou estouro de prazo do avaliador não muda o `status` do run).
- `novos_erros_axe`: pares (regra, alvo) do pós que não existiam no baseline do mesmo snapshot. `novos_erros_axe_regra`: soma, por regra, do quanto o número de nós com violação cresceu (não depende dos seletores, que o plugin pode mudar ao renomear IDs).
- `novos_erros_ibm`: violações do IBM no pós sem par na baseline do mesmo snapshot. O pareamento tem quatro passadas, cada violação usada uma vez: mesma regra, motivo, argumentos e XPath; depois regra, motivo e XPath sem os argumentos (eles trazem valores medidos, como razão de contraste e tamanho da fonte, que mudam quando o plugin mexe no estilo sem corrigir a violação); depois o mesmo trecho de HTML do elemento; depois a mesma posição na árvore sem nomes de tag (o XPath do IBM é feito de nomes de tag, e muda quando o plugin troca a tag de um ancestral, como `td` → `th`). `novos_erros_ibm_regra`: crescimento por regra, que não depende de caminhos e é a medida mais robusta das duas. Ficam vazios sem baseline do IBM compatível.
- `rotulos_genericos`: rótulos de fallback novos no DOM ("Abrir link N", "Acionar botão N", alt "Imagem" etc.), medidos pelo harness do mesmo jeito em todas as condições.
- `tokens_in`, `tokens_out`, `latencia_ms`: soma das chamadas ao LLM do run (do runLog na v1.1.0, do adaptador na v1.0.0). `latencia_ms` soma a latência de cada chamada; não é o tempo total do run. Zero quando o run nem começou (o gancho não respondeu, ou a extensão recusou a configuração); vazios, com motivo em `observacoes`, quando o run da v1.1.0 não terminou a tempo (o runLog lido do service worker seria parcial).

## Snapshots

A captura espera a rede e o DOM assentarem (com teto), congela as animações da página (o mesmo estado que o replay vai usar) e serializa o DOM renderizado com shadow roots, estado de formulários (o valor digitado vira atributo nos campos de texto; botões `submit`/`reset` sem `value` continuam sem, para manter o rótulo padrão do navegador) e o doctype real. Os `<style>` cujo CSSOM foi alterado por script (regras inseridas, CSS-in-JS) e as folhas adotadas viram `<style>` com o texto efetivo. Os `<script>` saem; os handlers inline (`onclick`, `onfocus`…) ficam no DOM, como na página real, e a CSP do replay os impede de rodar. O conteúdo dos `<noscript>` parseado como texto cru é esvaziado: com scripts ligados ele nunca aparece, e reparseado viraria elementos visíveis (num iframe `sandbox` sem scripts o conteúdo aparece e fica). A rolagem de contêineres feita por script (carrossel, lista) e a da janela vão em atributos que o replay aplica e remove antes de qualquer medição (`elementos_rolados`). Numa página que não está em UTF-8, URLs com acento (atributos, `srcset`, `href` de SVG, `url()` em estilos) viram a forma absoluta que o navegador usou, sem mexer na página ao vivo, e os CSS sem charset declarado (nem no cabeçalho, nem com BOM ou `@charset`) ganham o da página no HAR (`har_css_charset`). Os iframes são congelados do mesmo jeito, sob a URL final e sob o `src` do `<iframe>`. Documentos com Trusted Types obrigatório usam uma política própria; se a página também proibir políticas, o documento é clonado e os shadow roots perdidos são contados.

O HAR é limpo: saem as respostas com status ≤ 0, as que não tiveram o corpo gravado (o replay serviria um 200 vazio) e as repetidas. Cada captura tem prazo total (`captureMs`); o navegador é relançado se cair, e uma falha ao gravar o índice não para as URLs seguintes.

Antes de entrar no índice, a captura é reaberta em replay e comparada com a página real: fração de pixels diferentes entre `page.png` e `replay.png` e fração das linhas do texto visível sem par na outra versão (um texto trocado do mesmo tamanho também conta). Fica `suspeito` (e o run não usa, com o motivo em `observacoes`) se a tela ou o texto passarem dos limites de `config.json` (`replay`), se o load do replay não terminar, se o `compatMode` mudar ou se a página parecer um desafio anti-bot com sinal forte (título de desafio, ou o padrão numa página quase sem texto). O padrão numa página com conteúdo ("protegido por reCAPTCHA") só fica registrado (`suspeita_desafio: fraca`). Requisições abortadas no replay (`replay_abortados`) e iframes congelados que o replay não pediu (lazy, fora da tela) ficam registrados para revisão, sem bloquear; `frames_servidos` conta arquivos congelados distintos.

No replay, o documento principal e os iframes congelados vêm do disco com a CSP `script-src 'none'`: nenhum JavaScript da página roda. CSS, imagens e fontes vêm do HAR; o que não estiver lá é abortado e contado (`har_abortados`). Iframes não congelados são bloqueados e só a primeira navegação do frame principal é atendida (um meta refresh não troca a página no meio do run). As animações CSS, inclusive dentro de shadow roots, vão para um estado fixo (as finitas terminam, as infinitas param no início), igual em todas as condições. Assim o contraste e o conteúdo não mudam entre condições. As rotas são da página: o service worker da extensão continua falando com o Ollama. Antes de medir, cada contêiner rolável volta à posição de antes do driver (o caminho de visão rola até as imagens), a janela vai para o topo (todas as condições medem do topo) e as animações são congeladas de novo. As rolagens do harness são instantâneas, mesmo em páginas com `scroll-behavior: smooth`.

## Aceites (Fase 5)

Scripts em `aceites/`, um por critério de aceite. Cada um imprime `OK`/`FALHA` por verificação, grava um JSON em `docs/evidencias/aceites/<data>/` (ou em `--saida`) e sai com código 1 se algo falhar. Testes que rodam o harness usam pastas temporárias e não tocam em `results/` nem em `snapshots/` (o 3 e o 4 leem os snapshots do lote). Perfis do Chromium e cópias das extensões criados pelos aceites são apagados na saída. Um erro fora das verificações (preparação, tag ausente) vira a verificação "aceite rodou até o fim" com falha, e o JSON é gravado mesmo assim.

| Script | O que confere | Precisa de |
|---|---|---|
| `1-sintaxe.js` | `node --check` em cada JS (um por chamada), `manifest.json` válido e sem permissões além das da tag `v1.1.0`, nenhuma chave de API versionada, nenhum `innerHTML` novo na extensão desde a `v1.1.0` (inclusive em arquivos da raiz ainda fora do git, que a cópia do harness carregaria) | — |
| `2-painel.js` | interface: painel real na `test-page.html` (Analisar → Aplicar) sem LLM, runLog do C10 completo e coerente com o painel, sem erros de JavaScript; o gancho fica desligado sem o opt-in na aba em que o content script acabou de aplicar, e responde com o opt-in (controle); `--llm` roda também uma imagem sem contexto no Ollama | Ollama só com `--llm` |
| `3-smoke-harness.js` | 3 URLs × {`baseline`, `v1.0.0`, `v1.1.0`} → 9 linhas, JSON bruto válido e com o `raw_sha256` da linha, axe e IBM preenchidos (o IBM tem de ter rodado em toda baseline e em ao menos uma linha de cada condição), cada condição com plugin chamou o LLM, ao menos um run com plugin aplicou, sessão com as versões e o contexto do modelo (D8); `--validar <pasta>` só confere um lote já rodado (as linhas da execução 1 do estrato `smoke` da sessão mais recente, ou de `--sessao`) | Ollama, snapshots do estrato `smoke` |
| `4-determinismo.js` | dois runs → as mesmas correções determinísticas: (a) pelo painel sem LLM, DOM final idêntico; (b) pelo harness com LLM (`--execucoes 2`), mesmas `deterministicFixes` (só condições da v1.1.0 pelo gancho, que devolvem o runLog) | Ollama na parte (b); `--sem-llm` pula |
| `5-falha-injetada.js` | URL que não resolve e URL sem esquema → `falha` na captura e no run, e o lote segue; snapshot adulterado no disco → `falha` por sha256 | rede (captura a URL válida) |
| `6-equivalencia.js` | tag `v1.1.0` (copiada pelo git) × build pelo mesmo caminho (`optimizer.runAutoOptimization`) e pelo painel, sem LLM: DOMs finais iguais (IDs aleatórios numerados pela ordem de aparição, então um rótulo ligado ao campo errado aparece); D7: gancho × painel no build; payload do painel da tag × `panel-fixes.js` | Ollama no ar (só a checagem do modelo do gancho) |

```bash
npm run aceites            # todos, na ordem 1, 2, 6, 5, 4, 3
npm run aceites:rapido     # sem o 3 e sem a parte com LLM do 4
node aceites/3-smoke-harness.js --validar results
```

O texto gerado pelo LLM não entra no critério de determinismo: no Ollama, `temperature: 0` com `seed` não garante saída idêntica (`docs/ESTADO_ATUAL.md`).
