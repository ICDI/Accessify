# Accessify — Evoluções para apresentação

Documento de apoio para apresentar o que mudou na versão **1.1.0** em relação à base **1.0.0**. Foco permanente: **usuários cegos e de baixa visão**, critérios **WCAG 2.1 até o nível AA**.

Tudo o que este documento descreve entrou numa única evolução (1.0.0 → 1.1.0). Não há sub-versões para acompanhar: é um pacote só de melhorias, correções e novos critérios WCAG.

---

## 1. Por que evoluir

O plugin já analisava a página no navegador e pedia a uma IA recomendações de correção. Vários limites atrapalhavam o uso acadêmico e prático:

1. **Dependência total de API paga** (OpenRouter). Sem chave, a análise com IA não rodava.
2. **Alt text frágil**: o modelo recebia só a URL da imagem em texto, então quase nunca "via" a imagem.
3. **Validação WCAG incompleta** para deficiência visual: a página de teste já tinha tabela sem `th` e `div` com `onclick`, mas o avaliador **não detectava** esses casos. Vários critérios A/AA relevantes para leitor de tela e baixa visão estavam de fora.
4. **Avaliador WCAG duplicado** em `content.js` (uma cópia sequer era carregada), o que também explicava parte do item 3.
5. **Contraste podia piorar** depois de o plugin agir, por causa da técnica usada para "esconder" elementos (skip link, H1 injetado) e de um cálculo de fundo que ignorava `background-image`.
6. **Estado da análise era global**, não por aba: analisar a aba 1 e abrir a aba 2 mostrava o resultado da aba 1.
7. **Reanalisar uma página já corrigida** encontrava pouca coisa (as correções anteriores continuavam no DOM), parecendo um "cache" grudado.
8. **A própria interface do plugin** (painel lateral e tela de configurações) tinha problemas de acessibilidade — ironicamente as mesmas classes de erro que o Accessify corrige em páginas de terceiros.

A 1.1.0 ataca todos esses pontos sem sair do recorte visual e sem subir para AAA.

---

## 2. Visão geral do que há de novo

| Área | Antes (1.0.0) | Agora (1.1.0) |
|------|--------|--------|
| IA | Só OpenRouter | Ollama local (Qwen3 8B) **ou** OpenRouter |
| Modelos na nuvem | Lista cara/desatualizada (Kimi, Grok, Gemini 3.1 Lite Preview) | 4 modelos baratos e suficientes |
| Alt text | URL em texto | Local: contexto da página. OpenRouter: visão (imagem) |
| Avaliador WCAG | Duplicado em `content.js` (a cópia não era carregada) | Um único `wcag-evaluator.js`, declarado no manifest |
| Critérios detectados | Poucos A + 2 AA | **>20 critérios A/AA**, cobrindo tabelas, teclado, skip link, iframe, SVG, cor, IDs duplicados, rótulos, contraste (texto e não-texto), zoom, autocomplete, mídia autoplay, animação, CAPTCHA, erro de formulário, ARIA de referência, links quebrados, sublinhado indevido |
| Correção | Quase tudo via IA | **100% determinística no essencial** — regras fixas no DOM; IA só onde falta descrição de imagem |
| Confiabilidade da correção | Um clique só, sem garantia de convergência | Laço de convergência (até 4 rodadas) em `applyOptimizations()`: reaplica até não sobrar problema real ou estabilizar |
| Contraste após o plugin | Podia piorar (skip link/H1 escondidos de forma que ferramentas de auditoria não reconheciam) | Técnica `sr-only` padrão + detecção de fundo incerto (`background-image`) antes de decidir a cor |
| Estado da análise | Global (uma chave para todas as abas) | Isolado por aba, com limpeza automática ao trocar de aba/navegar |
| Reanálise de página já corrigida | Encontrava pouca coisa (aparência de "cache") | Recarrega a aba automaticamente antes de reanalisar, quando detecta marcas do Accessify no DOM |
| Etapa de imagens | Disparava se houvesse contraste/link genérico | Só se existir imagem sem `alt` |
| Acessibilidade da própria interface | Painel e configurações com switch/link não navegáveis por teclado, sem `aria-live`, sem nomes acessíveis em botões só-ícone | Switch com `role="switch"`, botões reais, `aria-live` nas áreas dinâmicas, `fieldset`/`legend`, foco visível |

Arquivos novos ou com papel novo:

- `ai-config.js` — provedores, defaults e catálogo de modelos (fonte única)
- `wcag-evaluator.js` — agora é o avaliador real, carregado **antes** de `content.js`
- `EVOLUCOES_V1.1.md` — este documento

---

## 3. Arquitetura da IA

```
Página (DOM)
    → wcag-evaluator.js  (detecção local, determinística)
    → content.js         (serializa issues, extrai imagens, aplica correções)
    → background.js
           ├─ provider = local      → Ollama  http://127.0.0.1:11434/v1  modelo qwen3:8b
           └─ provider = openrouter → OpenRouter  modelo escolhido
    → content.js aplica no DOM
```

O desenho acadêmico se mantém: **o LLM não descobre os erros**. A varredura WCAG continua no DOM. A IA entra depois, apenas para descrever imagens e para os poucos casos que exigem julgamento contextual (que, na prática, também acabaram cobertos por regra fixa — ver seção 6).

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
| Contraste, SVG, label, tabela, iframe, skip link, H1, "clique aqui" | Pedidos à IA | Regras fixas no DOM |
| JSON inválido | Abortava a análise | Tenta reparar; se falhar, conclui com correções determinísticas |

Isso evita o erro `Expected ',' or '}' after property value in JSON` (resposta truncada/quebrada) e tira o modelo do swap de RAM.

Tela de opções: rádio Local / OpenRouter, URL, modelo, botão **Testar conexão** (tenta `/v1/models` e um ping curto).

Se o teste local der **403**, o Ollama está bloqueando origem `chrome-extension://`. No Windows:

```text
OLLAMA_ORIGINS=chrome-extension://*
```

Reiniciar o Ollama (fechar pelo tray, não só o terminal) e rodar `ollama pull qwen3:8b`.

### 3.2 Modelos OpenRouter

Lista antiga (cara ou pouco adequada ao plugin): GPT-5 Nano, Kimi K2.5 (~US$ 0,45 / 2,25 por 1M), Qwen 3.5 Flash, Gemini 3.1 Flash Lite Preview (~US$ 0,25 / 1,50), Grok 4.1 Fast (~US$ 0,20 / 0,50).

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

O prompt era, em essência: "gere um alt text para esta URL". A maioria dos modelos **não baixa a imagem**. O resultado era genérico ou inventado.

### Agora — dois caminhos

**Ollama / Qwen3 8B (texto, sem visão)**
O plugin monta um contexto da página e pede um alt curto (10–100 caracteres) **sem inventar detalhes**: nome do arquivo, `title` da imagem, `figcaption`, texto adjacente, `aria-label` do elemento pai, dimensões.

**OpenRouter com modelo de visão** (GPT-5 Nano ou Gemini 2.5 Flash Lite)
O content script tenta gerar um `dataUrl` JPEG da imagem (same-origin, canvas). Se conseguir, envia a imagem; senão, envia a URL no formato `image_url`.

A etapa "Processando imagens" **só abre** se `extractImages()` devolver imagens sem atributo `alt` (e que não sejam espaçadoras). Contraste baixo ou "clique aqui" **não** disparam mais essa etapa.

Duas checagens reduzem quantas imagens dependem dessa heurística cara ou de IA:

- `isDecorativeIconImage(img)` — reconhece ícones por **token exato** de classe (`icon`, `fa-`, `glyph`, `bullet`, `divider`, separado por espaço/hífen/underscore — não substring, para não confundir com `"team-icon-photo"`), por caminho (`/icons/`, `/glyphs/`) ou por serem muito pequenas (≤16×16px).
- `isMarkedDecorative(img)` — respeita `role="presentation"`, `role="none"` ou `aria-hidden="true"` já presentes na imagem, mesmo sem `alt`.

---

## 5. Todos os novos critérios WCAG detectados e corrigidos

Recorte: deficiência visual, níveis **A e AA**. Fora: AAA, legendas para surdez, gestos/motor, convulsão.

### 5.1 Já existia na 1.0.0 (e continua)

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

### 5.2 Novos nesta evolução — alto impacto, detecção + correção automática

| Critério | Nível | Detecção | Correção automática (sem IA) |
|----------|--------|----------|------------------------------|
| **1.3.1 tabelas** | A | `table` com ≥ 2 linhas e sem `th`/`scope`/`headers` | Primeira linha `td` → `th scope="col"` |
| **2.1.1 / 4.1.2 clicável não semântico** | A | `div`/`span` com `onclick` sem teclado | `role="button"`, `tabindex="0"`, Enter/Espaço disparam clique |
| **2.4.1 pular blocos** | A | Sem skip link e sem `main` | Insere skip link visível no foco (técnica `sr-only`) |
| **4.1.2 iframe** | A | `iframe` sem `title` nem `aria-label` | `title` inferido do hostname |
| **1.1.1 SVG / input image / area** | A | Gráfico sem nome acessível | SVG: `role="img"` + `aria-label` |
| **1.4.1 uso de cor** | A | Link no meio do texto só por cor, sem sublinhado | Atributo + CSS `text-decoration: underline` |
| **4.1.2 IDs duplicados** | A | Mesmo `id` em dois elementos | Sufixo `-accessify-N` |
| **3.3.2 rótulo visível** | A | Nome acessível só por `title`/`aria-label`/placeholder | Cria `<label for="...">` a partir do texto disponível |
| **1.4.2** Áudio/vídeo autoplay com som | A | `audio[autoplay]`/`video[autoplay]` com som, sem `muted` | `pause()` no elemento e adiciona `controls` |
| **2.4.4** Propósito do link (reforço) | A | `a[target="_blank"]` sem indicação de "nova aba" no nome acessível | Acrescenta " (abre em nova aba)" ao `aria-label` |
| **1.3.1 / 4.1.2** Landmarks duplicados | A | Mais de um `<nav>`/`role="navigation"` ou `<aside>`/`role="complementary"` sem `aria-label` os diferenciando | Infere rótulo por heading interno, posição (`header`/`footer`) ou índice |
| **2.2.2** Controle de animação | A | Elemento visível com animação CSS `infinite` | Injeta `@media (prefers-reduced-motion: reduce)` global |
| **3.3.1 / 3.3.3** Erro de formulário anunciado | A | Campo com texto de erro visível próximo (`.error`, `role="alert"`, etc.) não referenciado via `aria-describedby` | Gera `id` no elemento de erro se faltar, liga via `aria-describedby`, garante `aria-invalid="true"` |
| **4.1.2** ARIA de referência quebrada | A | Qualquer atributo ARIA que aponta um ID inexistente: `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`, `aria-activedescendant`, `aria-flowto`, `aria-details`, `aria-errormessage` | Remove/corrige a referência quebrada |
| **1.4.1** Texto sublinhado indevido | Advisory (apoia 1.4.1/1.3.1) | Texto sublinhado fora de link/botão (pode ser confundido com link clicável), exceto `<ins>` (sublinhado semântico próprio) | Remove `text-decoration: underline` do texto que não é link |

Também passou a contar `aria-label` como nome acessível de campo (antes só `title`, `<label>` e `aria-labelledby`). Placeholder **sozinho** continua **sem** nome acessível (crítico).

### 5.3 Novos nesta evolução — AA visual, ainda automatizável

| Critério | Nível | Detecção | Correção automática |
|----------|--------|----------|---------------------|
| **1.4.11 contraste de não-texto** | AA | Botão/input/link com fundo próprio e contraste &lt; 3:1 em relação ao entorno | Ajuste de CSS |
| **1.4.4 redimensionar texto** | AA | `user-scalable=no` ou `maximum-scale=1` | Libera zoom (`user-scalable=yes`, `maximum-scale=5`) |
| **1.3.5 propósito do input** | AA | email/tel/nome sem `autocomplete` | Preenche `autocomplete` |
| **2.5.3 label in name** | A | `aria-label` que não contém o texto visível | Ajuste de rótulo |
| **1.3.2 sequência** | A | CSS `order` ≠ 0 (DOM vs visual) | Só alerta |
| **1.4.3** ampliado | AA | Limite ampliado; fundo efetivo sobe a árvore até cor opaca, considerando `background-image` | Escolhe cor de texto ou caixa sólida conforme confiabilidade do fundo |

### 5.4 Detectados mas sem correção automática (fica para revisão humana)

| Critério | Nível | Por quê não corrige sozinho |
|---|---|---|
| **1.1.1** Alternativa a CAPTCHA (`iframe`/classe/id com `captcha`, `recaptcha`, `hcaptcha`) | A | Não dá para gerar uma alternativa acessível por regra — fica marcado **crítico** para revisão manual |
| Mais de um `<h1>` (boa prática, apoia 2.4.6) | Advisory | Decidir qual H1 rebaixar exige contexto |
| **2.2.1** Tempo ajustável (`<meta http-equiv="refresh">` com delay) | A | Só alerta (crítico se delay < 20s) — remover arriscaria quebrar fluxos legítimos (ex.: timeout de sessão) |
| Heading level pulado (H3→H5, etc.) | A (detecção) | Inventar um heading intermediário exigiria adivinhar texto que não existe |
| **Broken same-page link** (`<a href="#algo">` sem elemento com esse `id`/`name`) | Alert (WAVE) | Não dá para adivinhar com segurança qual deveria ser o alvo certo |

**Não implementado (fora do recorte, heurística pesada demais):** imagens de texto (1.4.5), reflow (1.4.10), espaçamento (1.4.12), hover/focus (1.4.13), audiodescrição de vídeo (1.2.3/1.2.5), instruções só por forma/posição (1.3.3), idioma de partes (3.1.2), legendas de vídeo incorporado (YouTube). Trabalho futuro.

Também ampliado: `checkForOutlineRemoval()` passou a detectar `outline:none` **inline**, além de folha de estilo (antes só pegava CSS em `<style>`/`<link>`).

---

## 6. Correção: duas camadas + convergência garantida

A aplicação de otimizações tem **duas camadas**:

1. **Determinística** (`applyDeterministicFixes` em `content.js`) — regras fixas, reproduzíveis, sem custo de token. Cobre praticamente tudo (tabelas, teclado, skip link, iframe, SVG, cor, IDs, rótulos, contraste, zoom, autocomplete, mídia, animação, formulário, ARIA, links, sublinhado).
2. **IA** — só para descrever imagens sem contexto textual aproveitável. O pipeline de recomendações estruturais por IA (JSON com `structureChanges`/`ariaLabels`/`textChanges`/`styles`) segue existindo no código como ponto de extensão futuro, mas **todos** os tipos de problema detectados hoje estão na lista de skip (`llmSkipIssueTypes` em `ai-config.js`) — ou seja, **zero chamadas de rede** acontecem para correção estrutural, em qualquer provedor. A etapa "Gerando recomendações" que aparece na UI é, na prática, um no-op.

Troca de tag HTML **não usa `innerHTML`**. Os nós filhos são movidos com `appendChild` + `replaceWith`, o que reduz risco de quebrar listeners e de injeção.

O prompt de remediação **no OpenRouter** inclui um trecho HTML curto. **No Ollama** o prompt é mínimo: título, URL e no máximo um exemplo de H1/salto de heading/link genérico.

### Convergência num clique só

Várias regras determinísticas podem depender do resultado de outra rodando antes dela na mesma passada — revelar um bloco `aria-hidden` pode expor texto com contraste ruim que só a rodada seguinte pega; um heading promovido a H1 muda o que outra regra enxerga como "primeiro heading"; corrigir o fundo de um elemento pai muda o fundo efetivo herdado por um filho.

Por isso `applyOptimizations()` (`content.js`) roda em até **4 rodadas**:

1. Aplica `applyDeterministicFixes()` (que, internamente, já repete contraste + folha de estilo até 3 vezes).
2. Só na primeira rodada, aplica as recomendações de imagem vindas da IA/heurística (`applyAiProvidedOptimizations()`).
3. Roda uma instância **nova** de `WCAGEvaluator` e conta quantos problemas reais ainda existem.
4. Para se: zerou, o número não caiu em relação à rodada anterior (convergiu/travou), ou atingiu 4 rodadas.

O critério de parada é "quantos problemas reais sobram" (reavaliação de verdade), não "quantas alterações apliquei" (esse contador soma de novo mesmo sem mudar nada, ex. reaplicar o mesmo `alt`). `popup.js` não orquestra rodadas — só dispara uma chamada e exibe `appliedCount`/`roundsRun` no relatório final.

### Contraste que não piora mais

A avaliação em site real mostrava a métrica **Contrast Errors** piorando depois de aplicar o Accessify (ex.: IHC 2025 de 26 para 49). Duas causas concretas, já corrigidas:

1. **Skip link e H1 injetado** usavam `position:absolute; left:-9999px`, sem `color`/`background` próprios — o texto ficava sobre o canvas branco padrão do navegador em vez do fundo real da página, e ferramentas de auditoria (WAVE, por exemplo) não reconheciam isso como "oculto". Trocado pela técnica padrão **`sr-only`** (classe `.accessify-sr-only`, `clip-path: inset(50%)`), que ferramentas de acessibilidade excluem das checagens de contraste.
2. **`getEffectiveBackgroundColor()` ignorava `background-image`.** Ao subir a árvore procurando um fundo opaco, pulava fundos com imagem/gradiente e podia cair num branco assumido por padrão, levando a correção a escolher a cor errada. Novo método `hasUncertainBackground(element)` detecta esse caso e força a variante de **caixa sólida** (`solid-dark`/`solid-light`) em vez de arriscar um palpite de cor de texto.

---

## 7. Confiabilidade e ciclo de vida da análise

- **Estado por aba.** `background.js` usa uma chave por aba (`analysisJob:<tabId>`) em vez de uma chave global — analisar a aba 1 e abrir a aba 2 não mistura mais os resultados. `popup.js` informa `tabId` em toda chamada e tem um listener `chrome.tabs.onActivated` para atualizar a tela na hora ao trocar de aba (o painel lateral é uma instância única por janela, não recarrega sozinho ao focar outra aba). Limpeza automática ao fechar a aba (`chrome.tabs.onRemoved`) ou navegar para uma URL diferente.
- **Reload antes de reanalisar página já corrigida.** Como o Accessify só altera o DOM local (nunca envia nada ao servidor), reanalisar a mesma aba sem dar F5 encontrava pouca coisa — as correções anteriores continuavam lá. Agora `startAnalysisJob()` verifica marcas do Accessify no DOM (`data-accessibility`, `data-accessify-skip`, IDs `accessify-*`) e recarrega a aba automaticamente antes de prosseguir, quando encontra alguma (exceto em execuções automáticas de `autoOptimize`, que já partem de página recém-carregada). Login, cookies e sessão sobrevivem ao reload.
- **Resultado estável em sites reais.** `analyzePageForAccessibility()` aguarda `document.fonts.ready` (timeout de segurança de 1,5s) e mais dois frames de renderização antes de rodar `evaluator.evaluate()`, reduzindo variação causada por fontes ainda carregando ou reflow em andamento no instante do clique. Isso não elimina 100% a variação em sites com carrossel automático, banners de cookie ou scripts de terceiros que seguem alterando o DOM depois do carregamento — limite inerente a analisar uma página viva, que outras ferramentas (como a própria WAVE) também têm.

---

## 8. Acessibilidade da própria interface do Accessify

Auditoria manual do `popup.html` (painel lateral) e do `options.html` (tela de configurações) — a interface do plugin, não a página analisada — encontrou as mesmas classes de problema que o Accessify corrige em páginas de terceiros.

| Problema | Critério WCAG |
|---|---|
| Switch "Aplicar melhorias automaticamente" era uma `div` sem `role`, `tabindex` ou estado — impossível de operar só com teclado | 2.1.1, 4.1.2 |
| Link "⚙️ Configurações" era um `<a>` sem `href` — não recebia foco por Tab | 2.1.1, 4.1.2 |
| Barra de progresso sem `role="progressbar"` nem `aria-valuenow` | 4.1.2 |
| Status, progresso, resumo de resultados e relatório de execução mudam de texto sozinhos, sem nenhuma região `aria-live` | 4.1.3 |
| Ícones decorativos (emoji) eram lidos em voz alta junto com o texto | 1.1.1 (uso indevido) |
| Grupo de rádio "Provedor" sem `fieldset`/`legend` | 1.3.1, 3.3.2 |
| Botão de mostrar/ocultar a chave de API era só o emoji "👁️", sem nome acessível | 4.1.2, 2.4.6 |
| Mensagem de "Salvar"/"Testar Conexão" sem `aria-live` | 4.1.3 |
| Nenhum indicador de foco customizado para os controles não nativos | 2.4.7 |

**Correção aplicada:** o switch virou `role="switch"` com `tabindex="0"`, `aria-checked` sincronizado, `aria-labelledby` e handler de teclado (Enter/Espaço). O link de configurações virou `<button type="button">` de verdade. A barra de progresso ganhou `role="progressbar"` com `aria-valuenow` atualizado junto do progresso real. `status-info`, `progress-text`, `results-summary`, `report-status` e `status-message` (configurações) ganharam `role="status" aria-live="polite"`. Passos da análise/relatório viraram `role="list"`/`role="listitem"`. Todo emoji decorativo ganhou `aria-hidden="true"`, inclusive nos pontos montados dinamicamente via JS. O grupo de provedor ganhou `<fieldset><legend>`. O botão de senha ganhou `aria-label`/`aria-pressed` sincronizados. Botões de colapsar/expandir ganharam `aria-expanded`. Todos os controles não nativos ganharam `:focus-visible` com contorno azul de 3px. De passagem, corrigido um CSS quebrado (`.model-list` sem seletor) que tirava a moldura da lista de modelos OpenRouter.

`test-page.html` foi **deixado como está** de propósito: é a fixture de teste com problemas propositais, usada para demonstrar o plugin funcionando.

---

## 9. Página de teste (`test-page.html`)

A página de demonstração cobre os critérios novos, além dos antigos. Problemas propositais presentes na fixture:

- Contraste baixo, imagem sem alt, link "clique aqui", formulário sem label, texto justificado/pequeno, `aria-hidden` indevido, `title` redundante (já existiam na 1.0.0)
- Tabela sem `th`
- `div` com `onclick`
- `iframe` sem title
- SVG sem nome
- IDs duplicados (`id="dup"` duas vezes)
- Link no parágrafo distinguido só por cor
- Viewport com `user-scalable=no`
- Campos `nome`/`email` sem `autocomplete`
- `<meta http-equiv="refresh" content="300">` (delay de 5 minutos, proposital, para não atrapalhar uma sessão de teste manual)
- Link para o W3C com `target="_blank"` sem aviso
- Duas tags `<nav>` sem `aria-label`
- `<video autoplay>` sem `muted`/`controls`
- `.spinning-badge` com `animation: ... infinite`
- `.captcha-widget` simulando um reCAPTCHA
- Campo de e-mail com `.field-error` ao lado, sem `aria-describedby`

Os problemas antigos **não foram removidos** de propósito: se a fixture viesse já corrigida, a análise não teria o que mostrar. O plugin já detectava esses casos na 1.0.0; a 1.1.0 não os tirou do arquivo de teste.

O que acontece em cada um ao clicar em **Aplicar**:

| Problema na test-page | Detecta? | Como corrige |
|-----------------------|----------|----------------|
| Sem H1 / salto H3→H5 | Sim | Regra fixa: o primeiro heading vira `h1`. Salto de nível só é detectado, sem inventar títulos intermediários |
| Imagens sem alt | Sim | Regra fixa com figcaption/texto adjacente/nome do arquivo. No Ollama a IA só entra se faltar contexto (máx. 2). OpenRouter com visão descreve a foto |
| Links "clique aqui" | Sim | Regra fixa: `aria-label` = texto visível + heading/contexto do card |
| Formulário sem label | Sim | Regra fixa: cria `<label>` a partir do placeholder |
| Contraste baixo | Sim | Regra fixa: preto/branco (ou fundo sólido) para bater 4,5:1 |
| Texto justificado / pequeno | Sim (advisory) | Regra fixa: bloco justificado vira `text-align: left`; texto menor que 14px sobe para 14px |
| `aria-hidden` indevido | Sim | Regra fixa só se tiver foco interno ou texto longo |
| Title redundante | Sim | Regra fixa: remove `title` idêntico ao texto visível ou ao alt |
| Tabela sem `th` | Sim | Primeira linha `td` → `th scope="col"` |
| `div` com `onclick` | Sim | `role="button"`, `tabindex="0"`, teclado |
| `iframe` sem title | Sim | `title` inferido do hostname |
| SVG sem nome | Sim | `role="img"` + `aria-label` |
| IDs duplicados | Sim | Sufixo `-accessify-N` |
| Link só por cor | Sim | `text-decoration: underline` |
| Zoom bloqueado | Sim | Libera `user-scalable`/`maximum-scale` |
| Autocomplete ausente | Sim | Preenche `autocomplete` |
| Meta refresh | Sim | Só alerta |
| `target="_blank"` sem aviso | Sim | Acrescenta "(abre em nova aba)" |
| Navs sem `aria-label` | Sim | Infere rótulo por heading/posição |
| Vídeo autoplay sem `muted` | Sim | Pausa e adiciona `controls` |
| Animação infinita | Sim | `prefers-reduced-motion: reduce` |
| CAPTCHA simulado | Sim | Só marca crítico (revisão manual) |
| Erro de campo sem `aria-describedby` | Sim | Liga via `aria-describedby` + `aria-invalid` |

Resumo para a fala: a test-page é um **alvo quebrado permanente**. Detectar ≠ apagar o exemplo do arquivo. Corrigir no navegador, depois de Aplicar, é quase todo por regra fixa. A IA local só descreve imagens sem contexto.

---

## 10. Como demonstrar (roteiro curto)

1. Recarregar a extensão em `chrome://extensions` (versão **1.1.0**).
2. **Local:** Ollama no ar + `ollama pull qwen3:8b` → Configurações → Testar conexão.
3. Abrir `test-page.html`.
4. Analisar: apontar na lista os problemas novos detectados (tabela, onclick, iframe, SVG, IDs, cor, zoom, autoplay, animação, CAPTCHA, meta refresh, links sem aviso de nova aba, erro de formulário).
5. Aplicar: mostrar skip link no Tab, `th` na tabela, label visível, iframe com title, div focável, texto justificado alinhado à esquerda, fonte mínima 14px, `title` redundante removido, vídeo pausado, animação parando com "reduzir movimento" ativo no SO.
6. (Opcional) Trocar para OpenRouter + Gemini 2.5 Flash Lite e mostrar alt text com visão.
7. (Opcional) Abrir o próprio painel do Accessify e navegar só com Tab, mostrando o switch, o botão de configurações e os anúncios de status via leitor de tela.

Atalhos: `Alt+Shift+A` analisa; `Alt+Shift+O` liga/desliga auto-otimizar.

---

## 11. Perguntas frequentes

**"E a qualidade da IA?"**
- Detecção é **local e determinística** → resultado estável entre execuções.
- Qwen3 8B local é suficiente para alt text curto quando a imagem não tem contexto; a remediação estrutural via IA não é mais necessária — zero chamadas de rede acontecem para isso, em qualquer provedor.
- Para alt text "de verdade" (descrever o que está na foto), usar OpenRouter com modelo de visão.
- Correções simples não esperam o modelo: mesmo se a IA falhar, lang, spacer, tabela, iframe, teclado e zoom já entram.

**"Isso muda o quanto o plugin depende de IA?"**
Não há mais chamada de IA para correção estrutural (já era assim desde o início desta evolução, só não estava documentado — a lista de skip cobria 100% dos tipos de problema gerados). A única IA que roda de fato é a descrição de imagens sem nenhum contexto textual aproveitável, e ela ficou menor porque mais imagens decorativas agora são resolvidas por regra.

**"Por que a barra de contraste às vezes piorava antes?"**
Pela técnica de esconder elementos que ferramentas de auditoria não reconheciam como oculta, e por um cálculo de fundo que ignorava imagem de fundo. Os dois foram corrigidos (seção 6).

---

## 12. Arquivos tocados (mapa para perguntas técnicas)

| Arquivo | Papel na 1.1.0 |
|---------|----------------|
| `manifest.json` | Versão 1.1.0; carrega `wcag-evaluator.js`; host localhost |
| `ai-config.js` | **Novo.** Defaults, catálogo de modelos, lista de tipos de issue que nunca vão para a IA (`llmSkipIssueTypes`) |
| `background.js` | Provedor local/OpenRouter, `chatCompletion`, alt text, gating de imagens, estado de análise por aba, reload antes de reanalisar |
| `wcag-evaluator.js` | Única fonte da avaliação WCAG; todos os critérios novos da seção 5 |
| `content.js` | Sem classe duplicada; extração rica de imagens; correções determinísticas; técnica `sr-only`; laço de convergência de até 4 rodadas; espera por fontes/frames antes de avaliar |
| `options.html` / `options.js` | UI de provedor; acessibilidade do próprio formulário (fieldset/legend, aria-label, aria-live) |
| `popup.html` / `popup.js` | Nome do modelo local/OpenRouter; estado por aba; acessibilidade do próprio painel (switch, botão, progressbar, aria-live) |
| `test-page.html` | Casos novos de teste (seção 9) |
| `README.md`, `INSTALLATION.md`, `TECHNICAL.md`, `ANALISE_DE_PAGINA.md` | Alinhados ao comportamento real |

---

## 13. Mensagem de fechamento

A 1.1.0 deixa o Accessify **rodável offline** (Ollama), **mais barato** na nuvem, **mais honesto no alt text**, **mais completo em WCAG A/AA para deficiência visual**, **mais confiável** (convergência garantida, estado isolado por aba, contraste que não piora) e **acessível na própria interface** — com uma fronteira clara: o DOM encontra o problema; regras fixas corrigem o óbvio; a IA só entra onde falta descrição de imagem.
