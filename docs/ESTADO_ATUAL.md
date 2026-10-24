# Estado atual — avaliação Accessify (estudo JIS)

Atualizado em 23/10/2026. O plano detalhado (`docs/PLANO_AVALIACAO.md`) e as instruções do Claude Code (`CLAUDE.md`) são arquivos de apoio locais, fora do git; este arquivo resume o que deles importa para o estudo.

## Referências congeladas

| Referência | Commit | Situação |
|---|---|---|
| tag anotada `v1.0.0-semish` | `b9f6556e798949c81ad9a16328d65023de9554e0` (objeto da tag `f58e3b1`) | no `origin` (github.com/ICDI/Accessify) desde 23/10/2026 |
| tag anotada `v1.1.0` | `36381da0eb7aec6b1c8c5c9ddf296f35db1f8e2e` (objeto da tag `c124605`) | no `origin` desde 23/10/2026 |
| branch `eval-harness` | a partir de `v1.1.0` | no `origin`, rastreando `origin/eval-harness` |
| worktree `../accessify-v1` | `v1.0.0-semish` (HEAD destacado) | só leitura |

## Sessão de 23/10/2026 — Fase 0

O que mudou:

- Tags, branch e worktree acima.
- Novos no repositório: este arquivo, `.gitignore`, `eval/tools/probe-ollama-v1.mjs`, `eval/tools/probe-alt-v110.mjs` e as evidências em `docs/evidencias/`. Locais, fora do git: `CLAUDE.md` e `docs/PLANO_AVALIACAO.md`.
- Nenhuma linha de código da extensão foi alterada.
- Ollama instalado e modelos baixados (ver Ambiente).
- Premissas externas do plano verificadas com fontes primárias, e o `/v1` do Ollama testado na prática (ver abaixo).
- Os documentos foram revisados por dois revisores independentes (precisão contra o código e consistência interna); as correções já estão aplicadas.

Pendências da Fase 0:

- Na máquina do lote: driver NVIDIA compatível, `OLLAMA_KEEP_ALIVE`, `OLLAMA_CONTEXT_LENGTH` conforme D8 e teste de memória com imagem (o `gemma3:4b` ficou inconclusivo aqui).
- Opcional: apagar `D:\Ollama\models` (~0,8 GB de downloads parciais que falharam no FAT32).

## Sessão de 23/10/2026 — Fase 1 (C10, log estruturado)

Branch `eval/fase-1-c10` (PR para a `semish2026`). As fases 1 a 5 vão em branches encadeadas, cada uma com uma PR própria para a `semish2026`, para que nenhum merge fora de ordem deixe trabalho para trás.

O que mudou:

- `content.js`: contadores por regra em `applyDeterministicFixes()` e por categoria em `applyAiProvidedOptimizations()` (só registram o que já era somado em `appliedCount`); `applyOptimizations()` devolve também `deterministicFixes`, `aiFixes`, `remainingByType`, `genericLabels` (diferença no DOM antes/depois, então cobre fallbacks do content, do background e do painel sem contar rótulos que a página já tinha) e `nothingToApply`; `extractImages()` inclui `selector`; o resultado de toda aplicação é reportado ao background (`recordApplyResult`).
- `background.js`: runLog por aba em `analysisRunLog:<tabId>`, com fila por aba para leitura e escrita; as escritas não seguram o fluxo da análise (entram na fila sem `await`, e uma falha do log nunca interrompe a extensão: vira `storageError` no `getRunLog`); `chatCompletion()` mede latência, tokens, `finish_reason` e o tamanho de `content` e `reasoning`, inclusive em falha de rede; `processImages()` marca a origem de cada alt (`heuristic`, `limite`, `llm`, `erro`); `reasoningAsAlt` sinaliza quando o raciocínio do modelo virou o alt; erros por etapa; `getRunLog` por mensagem (`{ action: 'getRunLog', tabId }`) e `optimizer.getRunLog(tabId)` no SW; logs órfãos removidos na inicialização.
- `popup.js` e `buildOptimizationsForApplication()`: campos aditivos `origin` (`llm`, `heuristic`, `limite`, `painel`) em cada item do payload e `runId` na mensagem de aplicação. O aplicador ignora os dois; o log usa para separar o que veio da IA do que veio de fallback e para não misturar execuções.

Significado dos campos que pedem cuidado na análise:

- `deterministicFixes`: operações por regra e rodada (`type` = tipo de problema quando a correspondência é 1:1; `fixRuleIssueTypes` mapeia as demais regras). `noop: true` em `accessify-styles` quando a folha própria não mudou na rodada.
- `aiFixes`: operações de `applyAiProvidedOptimizations()` por categoria e origem (`imageAlts:llm`, `structureChanges:painel`, ...). Só `:llm` é IA de fato.
- `rounds`: alterações e problemas restantes por rodada.
- `altTexts`: `eligible` (o background ofereceu o alt), `applied`/`finalAlt` (o que chegou ao DOM), `discardedAlt` (alt de uma chamada que falhou, que não é aplicado), `reasoningAsAlt`.
- `apply.overrodeDeterministicAlt`: imagens em que o alt do background sobrescreveu o da heurística do content (a mesma imagem aparece em `deterministicFixes` e em `aiFixes`).
- `apply` descreve a aplicação mais recente; `applies` guarda todas (o painel permite reaplicar).
- `genericLabels`: rótulos de fallback novos no DOM (diferença antes/depois), de qualquer origem.

Teste (Playwright 1.64.1, Chromium 1248, extensão descompactada, painel `popup.html` operado de verdade):

| Verificação | Resultado |
|---|---|
| DOM final do build = DOM final da tag `v1.1.0` (test-page, sem LLM) | igual (18 599 caracteres; IDs aleatórios normalizados) |
| Dois runs seguidos | DOM igual e mesmas `deterministicFixes` |
| Soma dos contadores = `appliedCount` | 40 determinísticas + 12 de `applyAiProvidedOptimizations()` = 52 (`ariaLabels:painel` 3, `structureChanges:painel` 6, `styles:painel` 1, `imageAlts:painel` 1, `imageAlts:heuristic` 1; nenhuma da IA) |
| Rodadas | 48, 3 e 1 alterações; 23, 21 e 21 problemas restantes |
| runLog com todos os campos e JSON válido | sim |
| Imagem sem contexto com `qwen3:8b` | alt gravado: "Okay, the user wants me to generate an alt text for an image named IMG_2034.png with dimensions"; `reasoningAsAlt: true`, `finish_reason: length`, 153/64 tokens, 79 s. O avaliador da própria extensão contou 0 problemas restantes |

O último caso confirma, dentro da extensão, o defeito que a sonda tinha mostrado fora dela (D5).

## Sessão de 23/10/2026 — Fase 2 (C11, gancho de automação)

Branch `eval/fase-2-c11`, encadeada na da Fase 1.

Contrato:

- A página dispara `document.dispatchEvent(new CustomEvent('accessify:run', { detail: JSON.stringify(config) }))`. O resultado aparece em `<script type="application/json" id="accessify-result">`, também em falha. `accessify:ping` → `accessify:ready` diz que o listener está pronto; `accessify:ack` confirma cada disparo (`accepted: false` quando já há um run na aba).
- Config aceita (lista branca; qualquer outro campo invalida o run): `provider` (só `local`), `model`, `temperature` (0–2), `apply` (padrão `true`; `false` só analisa), `runId`, `vision`, `reasoning` (`original` | `none`), `timeoutMs` (10 000–290 000, padrão 170 000).
- Resultado: `status` (`ok`, `parcial` quando alguma chamada ao LLM falhou ou a visão ficou sem imagem, `falha`), `runId`, `condition`, `appliedChanges`, `nothingToApply`, `queueWaitMs`, `durationMs`, `runLog` (C10) e `errors`.

Proteções (a revisão independente mostrou que, sem elas, qualquer site aberto num navegador com a extensão descompactada conseguiria usar o gancho):

- Opt-in: o gancho só existe com `automationHookEnabled: true` no `chrome.storage.local`, que só o harness grava pelo service worker; além disso exige `installType === 'development'`.
- Overrides de modelo, temperatura, raciocínio e visão só valem durante o run de automação, um por vez (fila); uma análise manual espera a fila esvaziar.
- Prazo contado a partir de quando o run sai da fila; as chamadas ao LLM são abortadas quando ele acaba e, se ele acabou, nada é aplicado. Runs cuja aba fechou ou que esperaram mais que o prazo na fila são descartados.
- Todas as mensagens do run vão presas ao `documentId` de quem pediu: navegação ou recarga no meio faz o run falhar.
- Página com marcas de uma execução anterior → falha (nunca recarrega). O próprio `#accessify-result` não conta como marca.
- O modelo pedido é conferido no Ollama antes do run.
- Visão local: os bytes vêm do canvas da página (com fundo branco, porque JPEG não tem transparência) ou, quando o canvas fica bloqueado por CORS, de um recorte da captura da aba (`captureVisibleTab`, coberto pelo `<all_urls>` que já existia). Nunca de um fetch pelo service worker, que iria à rede ao vivo (fora do snapshot) e deixaria uma página ler imagens de outras origens. A origem dos bytes (`visionSource`) e o motivo de uma visão sem imagem (`visionError`) ficam no log.

D7 na prática: as correções que o painel soma às da IA saíram do `popup.js` para `panel-fixes.js` (`AccessifyPanelFixes`), usado pelo painel e pelo gancho. Um teste roda o `combineOptimizations()` da tag `v1.1.0` e o novo sobre os mesmos problemas (sintéticos e da `test-page` real) e exige o mesmo payload.

Teste (Playwright 1.64.1, extensão descompactada, gancho disparado pela página, sem cliques):

| Verificação | Resultado |
|---|---|
| Sem o opt-in | o gancho não responde |
| Gancho na `test-page` | `status: ok`, 52 alterações, runLog completo |
| D7: DOM do gancho = DOM do painel real | igual (18 599 caracteres) |
| DOM do build = DOM da tag `v1.1.0` (painel) | igual; payload do painel igual ao da tag (casos sintéticos e `test-page` real) |
| Mesma aba de novo (marcas prévias) | `falha`, sem recarregar |
| Campo fora da lista branca / JSON quebrado / config vazia | `falha` de config / `falha` de config / ignorado |
| Dois disparos seguidos | o segundo é ignorado (`accepted: false`); um só resultado |
| Três abas ao mesmo tempo | três resultados `ok`, `runId` e `tabId` distintos, 52 alterações em cada |
| Modelo que não existe no Ollama | `falha` antes de qualquer chamada |
| `timeoutMs: 10000` com chamada lenta | chamada abortada, `falha` de `tempo`, nada aplicado |
| `v1.1.0` (`qwen3:8b`, raciocínio original), imagem sem contexto | alt = "Okay, the user wants an alt text for an image named IMG_2034.png, which is 64x64 pixels. They"; `reasoningAsAlt: true`; 153/64 tokens; 41 s |
| `v1.1.0-fix` (`reasoning_effort: 'none'`) | alt = "Ícone de seta para cima preto em fundo branco."; 159/17 tokens; 6 s. Sem raciocínio, mas **inventado**: a imagem é metade vermelha, metade azul e o modelo não a vê |
| `v1.1.0-vision`, `gemma3:4b`, imagem da mesma origem | bytes do canvas; alt = "Divisão de cores: vermelho e azul."; 423/10 tokens; 93 s |
| `v1.1.0-vision`, `gemma3:4b`, imagem de outra origem (canvas bloqueado) | bytes recortados da captura da aba; alt = "Divisão de fundo vermelho e azul."; 59 s |
| `v1.1.0-vision`, `qwen3-vl:8b` | o modelo recebeu a imagem (1182 tokens de entrada), mas **raciocina mesmo com `reasoning_effort: 'none'`**: o alt gravado foi o raciocínio ("Okay, let's see. The user wants an alt text for an image that's 64x64 pixels, split into red on the") |

Consequência para o subestudo de visão: com `max_tokens: 64`, o `qwen3-vl:8b` não serve; o `gemma3:4b` (sem modo de raciocínio) funciona. O `gemma4:e4b` também raciocina por padrão e não foi testado com `reasoning_effort: 'none'`.

Ambiente: nesta máquina o codificador de imagem cai no Vulkan da MX350 ("ggml_vulkan: device lost"); os testes de visão rodaram com o servidor só na CPU (`CUDA_VISIBLE_DEVICES=-1`, `OLLAMA_VULKAN=0`, nada persistente).

## Decisões

| Id | Decisão | Situação |
|---|---|---|
| D1 | v1.0.0 local via adaptador em runtime (rota de contexto do Playwright em `openrouter.ai` → Ollama) | tomada |
| D2 | Subestudo de alt text com visão como condição separada `v1.1.0-vision` | tomada |
| D3 | Um contexto de navegador por condição | tomada |
| D4 | Snapshot = DOM sem scripts + HAR dos subrecursos; índice de hashes versionado | tomada |
| D5 | Duas condições: `v1.1.0` (original, o Ollama ignora `think: false` e o alt vira raciocínio) e `v1.1.0-fix` (`reasoning_effort: 'none'` só no modo automação) | tomada em 23/10/2026 |
| D6 | Segundo avaliador = IBM Equal Access (`accessibility-checker-engine`, Apache-2.0) no DOM pós; a WAVE automatizada fica de fora (termos da WebAIM) | tomada em 23/10/2026 |
| D7 | O estudo mede o "Aplicar" do painel: o harness opera o `popup.html` real (v1.0.0) e o gancho C11 da v1.1.0 aplica as mesmas correções do painel | tomada em 23/10/2026 |
| D8 | `temperature: 0` em todas as chamadas das duas versões, `OLLAMA_CONTEXT_LENGTH=4096`, `max_tokens` originais; run lento demais vira falha por timeout | tomada em 23/10/2026 |

## Desvios em relação às instruções e à v1.1.0 (entram no artigo)

- Código da v1.1.0: o C10 só acrescenta instrumentação (contadores, medições, log); o teste da Fase 1 mostrou o DOM final idêntico ao da tag `v1.1.0` na `test-page.html` operando o painel.
- Condição v1.0.0 roda com adaptador de provedor (D1); a v1.0.0 original só fala com o OpenRouter.
- Condição `v1.1.0-vision` (D2) muda o caminho local do alt text; a condição `v1.1.0` fica com o caminho original.
- Condição `v1.1.0-fix` (D5) troca `think: false` por `reasoning_effort: 'none'` nas chamadas ao Ollama.
- `temperature: 0` (D8) substitui os literais da v1.1.0 (0.3 no alt, 0.1 nas recomendações) e o 0.7 da v1.0.0 nas condições do estudo; o uso manual da extensão continua com os valores originais.
- Um contexto por condição (D3) em vez das três extensões juntas (seção 4.1 das instruções).
- Snapshot sem scripts + HAR (D4).
- C11 usa `action` (convenção do código) em vez de `type` nas mensagens.
- A WAVE automatizada da seção 4.4 das instruções foi substituída pelo IBM Equal Access (D6).
- O runLog fica numa chave própria (`analysisRunLog:<tabId>`) ligada ao job pelo `runId`, e não dentro do job, que é zerado a cada carregamento da aba.

## Ambiente de desenvolvimento

| Item | Valor |
|---|---|
| Máquina | Windows 11, GeForce MX350 (2 GB) — só desenvolvimento; o lote roda na máquina de 8 GB |
| Driver NVIDIA | 560.76 (CUDA 12.6) — incompatível com o CUDA do Ollama 0.40.9; usar `CUDA_VISIBLE_DEVICES=-1` |
| Node | 22.14.0 |
| Ollama | 0.40.9 (winget, instalado em `D:\Ollama`) |
| Modelos | `C:\Users\marlo\.ollama\models` (`OLLAMA_MODELS`, variável de usuário) |
| `OLLAMA_ORIGINS` | `chrome-extension://*` (variável de usuário) |
| `OLLAMA_CONTEXT_LENGTH` | não definido → 4096 (default para menos de 23 GiB de VRAM; confirmado em `/api/ps`) |

O D: é FAT32 (limite de 4 GB por arquivo): os downloads de `qwen3:8b`, `qwen3-vl:8b` e `gemma4:e4b` falharam lá, e até o `gemma3:4b` falhou na verificação.

O app do Ollama da bandeja sobe o servidor sem `CUDA_VISIBLE_DEVICES` e se atualiza sozinho. Nesta máquina, fechar o app e subir o servidor à mão (`$env:CUDA_VISIBLE_DEVICES='-1'; & 'D:\Ollama\ollama.exe' serve`) e conferir a versão (`/api/version`) no início da sessão; a máquina do lote deve usar a mesma versão do começo ao fim.

Modelos (registro do Ollama, baixados em 23/10/2026):

| Modelo | Digest | Tamanho | Parâmetros / quant. | Capacidades | Defaults do Modelfile |
|---|---|---|---|---|---|
| `qwen3:8b` | `500a1f067a9f782620b40bee6f7b0c89e17ae61f686b92c24933e4ca4b2b8b41` | 5,23 GB | 8,2B Q4_K_M | completion, tools, thinking | temperature 0.6, top_k 20, top_p 0.95 |
| `qwen3-vl:8b` | `9cf69da2b16d097f7def535917c4b55a95d6c7ee5700eb69ab86b01b3cfca487` | 6,19 GB | 8,2B Q4_K_M | completion, vision, tools, thinking | temperature 1, top_k 20, top_p 0.95 |
| `gemma4:e4b` | `dc35e8d9c6061baa6f0fa870975ab6932e2542b579b13ea0f199fa4bb7300c9c` | 6,58 GB | 7,5B Q4_K_M | completion, vision, audio, tools, thinking | temperature 1, top_k 64, top_p 0.95 |
| `gemma3:4b` | `68ceab7e468a31c988b44d5a4984a0e21f58c4f7158c6ce29c1804babac38df7` | 3,35 GB | 3,9B Q4_K_M | completion, vision | temperature 1, top_k 64, top_p 0.95 |

Nenhum dos quatro define `num_ctx` no Modelfile. `qwen3-vl:8b` e `gemma4:e4b` também raciocinam por padrão, então o defeito do raciocínio (D5) vale também para a condição `v1.1.0-vision`.

## Teste prático do `/v1/chat/completions` (23/10/2026)

Scripts: `eval/tools/probe-alt-v110.mjs` e `eval/tools/probe-ollama-v1.mjs`. Resultados brutos: `docs/evidencias/alt-v110-2026-10-23.json` e `docs/evidencias/ollama-v1-probe-2026-10-23.json`, gerados pelas versões versionadas dos scripts. Ollama 0.40.9 nesta máquina, com `CUDA_VISIBLE_DEVICES=-1` (CPU + Vulkan).

Os testes rodam fora da extensão: reproduzem o corpo exato de `chatCompletion()` e, no `probe-alt-v110`, também `extractMessageText()` + `normalizeAltText()`. O prompt dos casos de texto é o de alt text da v1.1.0 (`buildImageContextPrompt` + system de `generateImageAltText`) para uma imagem sem contexto textual (só nome do arquivo e dimensões), que é o único caso em que a v1.1.0 local chama o LLM: com figcaption, `title`, nome do pai ou texto adjacente de 8+ caracteres, a heurística resolve antes. Os casos de visão usam uma pergunta curta sobre as cores de um PNG.

| Caso | Resultado |
|---|---|
| Corpo exato da v1.1.0 local (`think: false`, `chat_template_kwargs`, `options`, `max_tokens: 64`), `qwen3:8b`, `IMG_2034.jpg` 800×600 | `content: ""`, `finish_reason: "length"`, os 64 tokens gastos em `message.reasoning`. **Alt gravado pela v1.1.0: "Okay, the user wants an alt text for the image IMG_2034.jpg. The image is 800x600 pixels. They"** |
| Idem, `banner-home.webp` 1200×400 | **Alt gravado: "Okay, the user wants an alt text for the image \"banner-home.webp\" which is 1200x400. They specified"** |
| Sem nenhum campo de raciocínio | Igual: raciocina e estoura os 64 tokens |
| `reasoning_effort: "none"` | `content: "Uma pessoa segurando um copo de café."`, 13 tokens, 6,6 s. O modelo **inventou** o conteúdo: o prompt só tinha nome de arquivo e dimensões e pedia para não inventar |
| `options.num_ctx: 8192` | Ignorado: `/api/ps` continua com `context_length: 4096` |
| `usage` | Presente em todas as respostas 200 (`prompt_tokens`, `completion_tokens`, `prompt_tokens_details.cached_tokens`); `model` ecoa o nome pedido; `system_fingerprint` é sempre `"fp_ollama"` |
| Determinismo (`temperature: 0`, `seed: 42`, duas vezes) | Raciocínios diferentes a partir da segunda frase (233 e 231 caracteres; `determinismSameOutput: false`). Os `cached_tokens` também mudaram (149 → 154), o que é compatível com o cache de prompt alterar a numérica, mas a causa não foi isolada |
| Visão `qwen3-vl:8b`, PNG base64 | "As cores que aparecem na imagem são vermelho e azul." (correto; raciocinou antes, 139 s) |
| Visão `gemma4:e4b`, PNG base64 | Raciocínio gastou os 64 tokens, `content` vazio |
| Visão `gemma3:4b`, PNG base64 | Erro 500 (o runner fechou a conexão) nas duas execuções: inconclusivo nesta máquina |
| `image_url` com URL http | 400 "image URLs are not currently supported, please use base64 encoded data instead"; o Ollama não buscou a URL |

Conclusões:

- O defeito do raciocínio (o Ollama ignora o `think: false` que a v1.1.0 envia) atinge **todo alt text que a v1.1.0 local pede ao LLM** com o Ollama atual: o alt gravado é o começo do raciocínio do modelo, em inglês. As imagens resolvidas pela heurística não são afetadas.
- Mesmo corrigido (`reasoning_effort: "none"`), o caminho só-texto inventa descrições para imagens sem contexto. Isso pesa na D5 e motiva a `v1.1.0-vision`.
- `temperature: 0` com `seed` não garante saída idêntica. O critério de determinismo do estudo vale para as correções determinísticas, não para o texto do LLM.
- Latência nesta máquina: de 6 s a 139 s por chamada.

GPU: com o driver NVIDIA 560.76 (CUDA 12.6), toda inferência via CUDA falha ("the provided PTX was compiled with an unsupported toolchain"); o Ollama 0.40.9 traz bibliotecas CUDA mais novas. Com `CUDA_VISIBLE_DEVICES=-1` (só no processo do servidor, nada persistente) o Ollama usa CPU + Vulkan. A máquina do lote precisa de driver com CUDA acima de 12.6.

## Premissas externas verificadas (23/10/2026)

Resultado de uma verificação adversarial: um pesquisador por grupo de premissas tentou refutar cada uma com fontes primárias.

**Ollama `/v1/chat/completions`** — fonte: `openai/openai.go`, `server/routes.go`, `envconfig/config.go` do Ollama (tag v0.40.10 / main) e https://docs.ollama.com/api/openai-compatibility

- `options`, `think` e `chat_template_kwargs` não existem no `ChatCompletionRequest` e são descartados sem erro.
- O raciocínio é controlado por `reasoning_effort` ou `reasoning.effort` (string). Só `"none"` desliga. Sem esses campos, o servidor liga o raciocínio em modelos que o suportam (Qwen3).
- O raciocínio vem em `message.reasoning`; `content` traz só a resposta.
- `usage.prompt_tokens`/`completion_tokens` sempre vêm na resposta não-streaming; `completion_tokens` inclui o raciocínio.
- `temperature` e `seed` de topo são respeitados; sem `temperature`, o `/v1` força 1.0 e `top_p` 1.0, por cima do Modelfile.
- Contexto: `PARAMETER num_ctx` do Modelfile > `OLLAMA_CONTEXT_LENGTH` > default por VRAM (4096 abaixo de 23 GiB, 32768 a partir de 23, 262144 a partir de 47). Em modo automático o contexto pode ser reduzido em caso de falta de memória.
- Imagens: só `image_url` com data URL base64 (jpeg/png/webp). URL http dá 400.

**Service worker MV3** — fonte: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle e `extensions/browser/api/messaging/message_service.cc` do Chromium

- Encerramento após 30 s sem eventos/chamadas de API, após 5 min numa única requisição, e quando um `fetch()` leva mais de 30 s para responder.
- Mensagens por `Port` reiniciam o timer de inatividade.
- `sendMessage` com resposta pendente (`return true`) mantém o SW vivo até ~5 min (keepalive do canal no Chromium; não descrito na doc).
- Com DevTools/CDP anexados, o Chromium praticamente não suspende o SW: o harness com Playwright não reproduz a suspensão por inatividade do uso real.

**Content script e modo desenvolvedor** — fonte: `CustomEvent::detail` no Chromium; https://developer.chrome.com/docs/extensions/reference/api/management

- O `detail` objeto de um `CustomEvent` da página chega ao content script (cópia entre mundos); o harness manda string JSON mesmo assim.
- `chrome.management.getSelf()` funciona sem a permissão `management` e devolve `installType: 'development'` para extensão carregada por `--load-extension`. Não existe em content scripts.

**Playwright** — fonte: https://playwright.dev/docs/chrome-extensions, https://playwright.dev/docs/service-workers, release notes 1.57, `crServiceWorker.ts`

- Extensões exigem `launchPersistentContext` com `channel: 'chromium'`; Chrome e Edge de marca ignoram `--load-extension`.
- `page.keyboard` não dispara atalhos de `chrome.commands`.
- `worker.evaluate()` no SW da extensão acessa `const optimizer` (escopo de script) e as APIs `chrome.*`. O mesmo objeto `Worker` sobrevive à suspensão; um `evaluate` em andamento falha com "Service worker restarted".
- Desde a 1.57, `context.route` intercepta as requisições do SW (inclusive de extensão); `page.route` não.
- Com `--load-extension`, uma pasta `_metadata` não impede o carregamento: o Chrome apaga os arquivos reservados dela na pasta de origem.
- `recordHar` só grava ao fechar o contexto; `waitUntil: 'networkidle'` é desencorajado.
- O painel lateral não é suportado pelo Playwright (issue #26693), o que pesa na D7.

**WAVE** — fonte: https://wave.webaim.org/terms (conferido diretamente), https://wave.webaim.org/extension/

- Termos: "excluding API usage, you may not use WAVE in an automated manner", nem "automatically save WAVE reports without permission"; proíbem engenharia reversa e exigem permissão para copiar ou redistribuir.
- Extensão 3.3.1.0 (ID `jbbplnpkjmmeebjpijfedlgcdilocofh`), MV3, atalho Ctrl+Shift+U. O AIM Score muda a cada edição do WebAIM Million.
- A Subscription API avalia a URL no servidor e não vê o DOM modificado pelo plugin. O Stand-alone API/Testing Engine roda no navegador, mas é pago.

## Próximos passos

1. Fase 3 — harness `eval/` com axe-core.
2. Fase 4 — IBM Equal Access.
3. Fase 5 — aceites.
4. Escolher o modelo da condição `v1.1.0-vision` (o `qwen3-vl:8b` grava o raciocínio; o `gemma3:4b` funciona).
