# Accessify 1.1.0 — Evoluções para apresentação

Documento de apoio para apresentar o que mudou nesta versão. Foco permanente: **usuários cegos e de baixa visão**, critérios **WCAG 2.1 até o nível AA**.

Versão anterior: **1.0.0**. Versão atual: **1.1.0**.

---

## 1. Por que evoluir

O plugin já analisava a página no navegador e pedia a uma IA recomendações de correção. Três limites atrapalhavam o uso acadêmico e prático:

1. **Dependência total de API paga** (OpenRouter). Sem chave, a análise com IA não rodava.
2. **Alt text frágil**: o modelo recebia só a URL da imagem em texto, então quase nunca “via” a imagem.
3. **Validação WCAG incompleta** para deficiência visual: a página de teste já tinha tabela sem `th` e `div` com `onclick`, mas o avaliador **não detectava** esses casos. Vários critérios A/AA relevantes para leitor de tela e baixa visão estavam de fora.

A 1.1.0 ataca esses três pontos sem sair do recorte visual e sem subir para AAA.

---

## 2. Visão geral do que há de novo

| Área | Antes | Agora |
|------|--------|--------|
| IA | Só OpenRouter | Ollama local (Qwen3 8B) **ou** OpenRouter |
| Modelos na nuvem | Lista cara/desatualizada (Kimi, Grok, Gemini 3.1 Lite Preview) | 4 modelos baratos e suficientes |
| Alt text | URL em texto | Local: contexto da página. OpenRouter: visão (imagem) |
| Avaliador WCAG | Duplicado em `content.js` (o outro arquivo não era carregado) | Um único `wcag-evaluator.js`, declarado no manifest |
| Critérios | Poucos A + 2 AA | Onda 1 + onda 2 (visual, até AA) |
| Correção | Quase tudo via IA | Regras determinísticas no DOM + IA só onde precisa julgamento |
| Etapa de imagens | Disparava se houvesse contraste/link genérico | Só se existir imagem sem `alt` |

Arquivos novos ou com papel novo:

- `ai-config.js` — provedores, defaults e lista de modelos (fonte única)
- `wcag-evaluator.js` — agora é o avaliador real, carregado **antes** de `content.js`
- `EVOLUCOES_V1.1.md` — este documento

---

## 3. Arquitetura nova da IA

```
Página (DOM)
    → wcag-evaluator.js  (detecção local, determinística)
    → content.js         (serializa issues, extrai imagens, aplica correções)
    → background.js
           ├─ provider = local      → Ollama  http://127.0.0.1:11434/v1  modelo qwen3:8b
           └─ provider = openrouter → OpenRouter  modelo escolhido
    → content.js aplica no DOM
```

O desenho acadêmico se mantém: **o LLM não descobre os erros**. A varredura WCAG continua no DOM. A IA entra depois, para descrever imagens e sugerir remediações que exigem contexto.

### 3.1 Provedor local (Ollama + Qwen3 8B)

Configurações em `chrome.storage.sync`:

| Chave | Padrão | Função |
|-------|--------|--------|
| `provider` | `local` | `local` ou `openrouter` |
| `localBaseUrl` | `http://127.0.0.1:11434/v1` | API OpenAI-compatible do Ollama |
| `localModel` | `qwen3:8b` | Modelo local |
| `apiKey` / `selectedModel` | — | Só usados no OpenRouter |

Comportamento importante para a apresentação:

- **Sem API key no modo local.** `isConfigured()` exige só URL + nome do modelo.
- Quem **já tinha chave OpenRouter** e ainda não escolheu provedor continua no OpenRouter (migração automática). Instalação nova cai no Ollama.
- Chamada unificada: `POST {base}/chat/completions`.
- Qwen3 é modelo *thinking*. Se o raciocínio vazar na resposta, o JSON de remediação quebra. Por isso o plugin envia `think: false` e `chat_template_kwargs.enable_thinking: false`, e ainda remove tags `<think>` da resposta.
- `response_format: json_object` **só no OpenRouter**. No Ollama o JSON é extraído do texto.
- Tokens realistas: 32 (teste), 256 (alt text), 4096 (recomendações). No Ollama o escopo é ainda menor: 64 tokens de alt e 768 de recomendações, com `num_ctx: 2048`.
- Permissões explícitas para `localhost:11434` e `127.0.0.1:11434`.

#### Escopo reduzido no Ollama (16 GB)

Em máquina local o Qwen3 8B não aguenta o dump completo da página. O console `WCAG Analysis Complete` continua listando **todos** os problemas; o que muda é o que vai para o modelo:

| Tarefa | Antes | Agora no Ollama |
|--------|--------|------------------|
| Imagens sem alt | Todas, uma chamada cada | No máximo **2**. Se houver figcaption/texto adjacente, gera alt sem IA |
| Emojis WordPress (`alt="❤️"`) | Iam para a IA | Ignorados |
| Recomendações | 16 frentes + HTML de 4.000 caracteres + 3 exemplos por tipo | **Nenhuma** no Ollama: headings, links genéricos e contraste viraram regra fixa |
| Contraste, SVG, label, tabela, iframe, skip link, H1, “clique aqui” | Pedidos à IA | Regras fixas no DOM |
| JSON inválido | Abortava a análise | Tenta reparar; se falhar, conclui com correções determinísticas |

Isso evita o erro `Expected ',' or '}' after property value in JSON` (resposta truncada/quebrada) e tira o modelo do swap de RAM.

Tela de opções: rádio Local / OpenRouter, URL, modelo, botão **Testar conexão** (tenta `/v1/models` e um ping curto).

Se o teste local der **403**, o Ollama está bloqueando origem `chrome-extension://`. No Windows:

```text
OLLAMA_ORIGINS=chrome-extension://*
```

Reiniciar o Ollama (fechar pelo tray, não só o terminal) e rodar `ollama pull qwen3:8b`.

### 3.2 Modelos OpenRouter

Lista antiga (cara ou pouco adequada ao plugin):

- GPT-5 Nano
- Kimi K2.5 (~US$ 0,45 / 2,25 por 1M)
- Qwen 3.5 Flash
- Gemini 3.1 Flash Lite Preview (~US$ 0,25 / 1,50)
- Grok 4.1 Fast (~US$ 0,20 / 0,50)

Lista nova (set/2026, USD / 1M tokens):

| Modelo | ID | Entrada / saída | Papel no plugin |
|--------|-----|-----------------|-----------------|
| DeepSeek V4 Flash | `deepseek/deepseek-v4-flash` | 0,05 / 0,14 | Padrão OpenRouter. Melhor custo para JSON de remediação |
| GPT-5 Nano | `openai/gpt-5-nano` | 0,05 / 0,40 | Segue instruções; aceita visão |
| Qwen 3.5 Flash | `qwen/qwen3.5-flash-02-23` | 0,07 / 0,26 | Mesma família do modelo local |
| Gemini 2.5 Flash Lite | `google/gemini-2.5-flash-lite` | 0,10 / 0,40 | Visão para alt text, mais barato que o 3.1 Lite |

A UI (`options.html`) e o painel (`popup.js`) leem essa lista de `ai-config.js`. Não há mais nomes hardcoded espalhados.

---

## 4. Pipeline de alt text (o que mudou de verdade)

### Antes

O prompt era, em essência: “gere um alt text para esta URL”. A maioria dos modelos **não baixa a imagem**. O resultado era genérico ou inventado.

### Agora — dois caminhos

**Ollama / Qwen3 8B (texto, sem visão)**  
O plugin monta um contexto da página e pede um alt curto (10–100 caracteres) **sem inventar detalhes**:

- nome do arquivo
- `title` da imagem
- `figcaption`
- texto adjacente
- `aria-label` do elemento pai
- dimensões

**OpenRouter com modelo de visão** (GPT-5 Nano ou Gemini 2.5 Flash Lite)  
O content script tenta gerar um `dataUrl` JPEG da imagem (same-origin, canvas). Se conseguir, envia a imagem; senão, envia a URL no formato `image_url`.

A etapa “Processando imagens” **só abre** se `extractImages()` devolver imagens sem atributo `alt` (e que não sejam espaçadoras). Contraste baixo ou “clique aqui” **não** disparam mais essa etapa.

---

## 5. Validação WCAG: o que já existia vs o que entrou

Recorte: deficiência visual, níveis **A e AA**. Fora: AAA, legendas para surdez, gestos/motor, convulsão.

### 5.1 Já existia (e continua)

| Critério | Nível | O que o plugin faz |
|----------|--------|---------------------|
| 1.1.1 imagens | A | `img` sem `alt`, alt curto/longo, alt redundante, spacer |
| 1.3.1 parcial | A | Headings, labels, landmarks, `div` com role em excesso |
| 1.4.3 | AA | Contraste de texto 4,5:1 (3:1 se texto grande) |
| 2.1.1 parcial | A | Excesso de `tabindex` positivo |
| 2.4.2 | A | Título ausente ou curto |
| 2.4.4 | A | Link vazio, genérico, imagem linkada sem alt |
| 2.4.7 | AA | `outline: none` em CSS (falha se a folha for CORS) |
| 3.1.1 | A | `lang` no `html` |
| 4.1.2 parcial | A | `aria-hidden` com foco, `aria-labelledby`/`describedby` quebrado |
| Advisory | — | Texto &lt; 14px, justificado, `title` redundante |

Limite de contraste de texto: **100 → 400** elementos visíveis com texto direto.

### 5.2 Onda 1 — alto impacto, vários já na página de teste

Esses critérios **não eram detectados** e agora são.

| Critério | Nível | Detecção | Correção automática (sem IA) |
|----------|--------|----------|------------------------------|
| **1.3.1 tabelas** | A | `table` com ≥ 2 linhas e sem `th`/`scope`/`headers` | Primeira linha `td` → `th scope="col"` |
| **2.1.1 / 4.1.2 clicável não semântico** | A | `div`/`span` com `onclick` sem teclado | `role="button"`, `tabindex="0"`, Enter/Espaço disparam clique |
| **2.4.1 pular blocos** | A | Sem skip link e sem `main` | Insere skip link visível no foco |
| **4.1.2 iframe** | A | `iframe` sem `title` nem `aria-label` | `title` inferido do hostname |
| **1.1.1 SVG / input image / area** | A | Gráfico sem nome acessível | SVG: `role="img"` + `aria-label` |
| **1.4.1 uso de cor** | A | Link no meio do texto só por cor, sem sublinhado | Atributo + CSS `text-decoration: underline` |
| **4.1.2 IDs duplicados** | A | Mesmo `id` em dois elementos | Sufixo `-accessify-N` |
| **3.3.2 rótulo visível** | A | Nome acessível só por `title`/`aria-label`/placeholder | Cria `<label for="...">` a partir do texto disponível |

Também passou a contar `aria-label` como nome acessível de campo (antes só `title`, `<label>` e `aria-labelledby`). Placeholder **sozinho** continua **sem** nome acessível (crítico).

### 5.3 Onda 2 — AA visual, ainda automatizável

| Critério | Nível | Detecção | Correção automática |
|----------|--------|----------|---------------------|
| **1.4.11 contraste de não-texto** | AA | Botão/input/link com fundo próprio e contraste &lt; 3:1 em relação ao entorno | Encaminha à IA (CSS) |
| **1.4.4 redimensionar texto** | AA | `user-scalable=no` ou `maximum-scale=1` | Libera zoom (`user-scalable=yes`, `maximum-scale=5`) |
| **1.3.5 propósito do input** | AA | email/tel/nome sem `autocomplete` | Preenche `autocomplete` |
| **2.5.3 label in name** | A | `aria-label` que não contém o texto visível | Encaminha à IA |
| **1.3.2 sequência** | A | CSS `order` ≠ 0 (DOM vs visual) | Só alerta |
| **1.4.3** | AA | Limite ampliado; fundo efetivo sobe a árvore até cor opaca | IA sugere CSS |

**Não implementado (onda 3 / heurística pesada):** imagens de texto (1.4.5), reflow (1.4.10), espaçamento (1.4.12), hover/focus (1.4.13), audiodescrição de vídeo (1.2.3/1.2.5), status messages (4.1.3), instruções só por forma/posição (1.3.3), idioma de partes (3.1.2). Dá para citar como trabalho futuro.

---

## 6. Duas camadas de correção (ponto forte para a fala)

A aplicação de otimizações agora tem **duas camadas**:

1. **Determinística** (`applyDeterministicFixes` em `content.js`) — regras fixas, reproduzíveis, sem custo de token. Útil para o artigo: o plugin não depende da IA para o essencial.
2. **IA** — JSON com `structureChanges`, `ariaLabels`, `textChanges`, `styles`, `imageAlts`. Validado minimamente (arrays/strings esperados) antes de ir para o DOM.

Troca de tag HTML **não usa mais `innerHTML`**. Os nós filhos são movidos com `appendChild` + `replaceWith`, o que reduz risco de quebrar listeners e de injeção.

O prompt de remediação **no OpenRouter** inclui um trecho HTML curto. **No Ollama** o prompt é mínimo: título, URL e no máximo um exemplo de H1/salto de heading/link genérico. Antes o HTML era extraído e **ignorado**; depois passou a ser enviado demais para 16 GB.

---

## 7. Página de teste (`test-page.html`)

A página de demonstração foi ampliada para os critérios novos. Na apresentação, vale abrir essa página, analisar e aplicar.

Problemas intencionais **novos ou que agora são de fato detectados**:

- tabela sem `th`
- `div` com `onclick`
- `iframe` sem title
- SVG sem nome
- IDs duplicados (`id="dup"` duas vezes)
- link no parágrafo distinguido só por cor
- viewport com `user-scalable=no`
- campos `nome` / `email` sem `autocomplete`

Os problemas **antigos também continuam no HTML da página de teste**, de propósito. Não foram “deixados sem solução no plugin”: se o arquivo de teste viesse já corrigido, a análise não teria o que mostrar. O plugin **já detectava** esses casos na 1.0; a 1.1 não os removeu da fixture.

O que acontece em cada um ao clicar em **Aplicar**:

| Problema na test-page | Detecta? | Como corrige |
|-----------------------|----------|----------------|
| Sem H1 / salto H3→H5 | Sim | **Regra fixa:** o primeiro heading vira `h1`. Salto de nível (H3→H5) só é detectado, sem inventar títulos intermediários |
| Imagens sem alt | Sim | **Regra fixa** com figcaption/texto adjacente/nome do arquivo. No Ollama a IA só entra se faltar contexto (máx. 2). OpenRouter com visão ainda descreve a foto |
| Links “clique aqui” | Sim | **Regra fixa:** `aria-label` = texto visível + heading/contexto do card. Não altera o texto visível |
| Formulário sem label | Sim | **Regra fixa na 1.1:** cria `<label>` a partir do placeholder |
| Contraste baixo | Sim | **Regra fixa:** CSS preto/branco (ou fundo sólido) para bater 4,5:1. A IA não escolhe mais a paleta |
| Texto justificado / pequeno | Sim (advisory) | **Regra fixa:** bloco longo justificado vira `text-align: left`; texto menor que 14px sobe para 14px |
| `aria-hidden` | Sim | **Regra fixa** só se tiver foco interno ou texto longo (caso da test-page). Ícones decorativos em SVG/`i` ficam escondidos |
| Title redundante | Sim | **Regra fixa:** remove `title` quando ele é idêntico ao texto visível ou ao alt |

Resumo para a fala: a test-page é um **alvo quebrado permanente**. Detectar ≠ apagar o exemplo do arquivo. Corrigir no navegador, depois de Aplicar, é quase todo por regra fixa. A IA local só descreve imagens sem contexto.

---

## 8. Como demonstrar (roteiro curto)

1. Recarregar a extensão em `chrome://extensions` (versão **1.1.0**).
2. **Local:** Ollama no ar + `ollama pull qwen3:8b` → Configurações → Testar conexão.
3. Abrir `test-page.html`.
4. Analisar: apontar na lista issues que **antes não existiam** (tabela, onclick, iframe, SVG, IDs, cor, zoom).
5. Aplicar: mostrar skip link no Tab, `th` na tabela, label visível, iframe com title, div focável, texto justificado alinhado à esquerda, fonte mínima 14px e `title` redundante removido.
6. (Opcional) Trocar para OpenRouter + Gemini 2.5 Flash Lite e mostrar alt text com visão.

Atalhos que já existiam e continuam: `Alt+Shift+A` analisa; `Alt+Shift+O` liga/desliga auto-otimizar.

---

## 9. O que falar se perguntarem “e a qualidade da IA?”

- Detecção é **local e determinística** → resultado estável entre execuções.
- Qwen3 8B local é suficiente para alt text curto quando a imagem não tem contexto; a remediação JSON deixou de ser necessária no Ollama.
- Para alt text “de verdade” (descrever o que está na foto), usar OpenRouter com modelo de visão.
- Correções simples não esperam o modelo: mesmo se a IA falhar, lang, spacer, tabela, iframe, teclado e zoom já entram.

---

## 10. Arquivos tocados (mapa para perguntas técnicas)

| Arquivo | Papel na 1.1.0 |
|---------|----------------|
| `manifest.json` | Versão 1.1.0; carrega `wcag-evaluator.js`; host localhost |
| `ai-config.js` | **Novo.** Defaults e catálogo de modelos |
| `background.js` | Provedor local/OpenRouter, `chatCompletion`, alt text, gating de imagens |
| `wcag-evaluator.js` | Única fonte da avaliação WCAG |
| `content.js` | Sem classe duplicada; extração rica de imagens; correções determinísticas |
| `options.html` / `options.js` | UI de provedor |
| `popup.html` / `popup.js` | Nome do modelo local ou OpenRouter |
| `test-page.html` | Casos novos |
| `README.md`, `INSTALLATION.md`, `TECHNICAL.md`, `ANALISE_DE_PAGINA.md` | Alinhados ao comportamento real |

---

## 11. Mensagem de fechamento

A 1.1.0 deixa o Accessify **rodável offline** (Ollama), **mais barato** na nuvem, **mais honesto no alt text** e **mais completo em WCAG A/AA para deficiência visual**, com uma fronteira clara: o DOM encontra o problema; regras fixas corrigem o óbvio; a IA só entra onde falta descrição ou julgamento.
