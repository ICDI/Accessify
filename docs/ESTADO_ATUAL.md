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

## Decisões

| Id | Decisão | Situação |
|---|---|---|
| D1 | v1.0.0 local via adaptador em runtime (rota de contexto do Playwright em `openrouter.ai` → Ollama) | tomada |
| D2 | Subestudo de alt text com visão como condição separada `v1.1.0-vision` | tomada |
| D3 | Um contexto de navegador por condição | tomada |
| D4 | Snapshot = DOM sem scripts + HAR dos subrecursos; índice de hashes versionado | tomada |
| D5 | Raciocínio na v1.1.0 local (o Ollama ignora `think: false`; confirmado na prática) | **pendente** |
| D6 | WAVE: os termos da WebAIM proíbem automatizar a extensão | **pendente** |
| D7 | Caminho de aplicação medido: "Aplicar" do painel ou otimização automática | **pendente** |
| D8 | Parâmetros de geração: `OLLAMA_CONTEXT_LENGTH`, temperatura da `v1.1.0`, limites do adaptador da v1.0.0 | **pendente** |

## Desvios em relação às instruções e à v1.1.0 (entram no artigo)

- Código da v1.1.0: nenhum desvio até aqui.
- Condição v1.0.0 roda com adaptador de provedor (D1); a v1.0.0 original só fala com o OpenRouter.
- Condição `v1.1.0-vision` (D2) muda o caminho local do alt text; a condição `v1.1.0` fica com o caminho original.
- Um contexto por condição (D3) em vez das três extensões juntas (seção 4.1 das instruções).
- Snapshot sem scripts + HAR (D4).
- C11 usa `action` (convenção do código) em vez de `type` nas mensagens.
- A WAVE automatizada da seção 4.4 das instruções não será feita sem permissão da WebAIM (D6).
- Se D8 trocar a temperatura do alt (0.3) pela do gancho, isso é desvio da v1.1.0.

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

1. C10 — log estruturado (instrumentação; não depende das decisões pendentes).
2. Decidir D5, D7 e D8 antes do C11 (gancho e overrides) e D6 antes do segundo avaliador.
