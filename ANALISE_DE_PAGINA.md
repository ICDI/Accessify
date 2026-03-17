# Processo de Analise de Pagina

Este documento descreve o fluxo real da extensao ao analisar uma pagina, quais verificacoes WCAG sao executadas localmente, quando o LLM e acionado e por que ele entra no fluxo.

## Visao geral

A analise e dividida em tres camadas:

1. Popup: inicia a analise e acompanha progresso.
2. Background service worker: orquestra o job, decide quando chamar o LLM e consolida os resultados.
3. Content script: inspeciona o DOM da pagina e executa as verificacoes locais de acessibilidade.

Em termos operacionais, o fluxo e:

1. O usuario clica em Analisar no popup.
2. O popup envia a acao `startAnalysisJob` para o background.
3. O background cria um job com etapas, progresso e identificador de execucao.
4. O background solicita ao content script a analise local da pagina.
5. O content script executa as validacoes WCAG diretamente no DOM e retorna issues + resumo + metadados da pagina.
6. O background verifica se ha pontos que demandam apoio do LLM.
7. Se necessario, o background chama o LLM para gerar alt text de imagens sem texto alternativo.
8. O background chama o LLM para transformar os problemas encontrados em recomendacoes de remediacao.
9. O job e marcado como concluido e o popup passa a exibir o resultado consolidado.

## Etapas detalhadas

### 1. Disparo da analise

O processo comeca no popup, quando a rotina `startAnalysis()` valida se a aba atual e uma pagina HTTP/HTTPS suportada. Em seguida, ela exibe a secao de progresso e envia ao background:

- `action: startAnalysisJob`
- `tabId`
- `windowId`

O popup nao faz a inspecao da pagina. Ele apenas inicia o job e consulta seu estado.

### 2. Criacao e orquestracao do job no background

O background cria um `runId` unico e inicializa o estado do job com quatro etapas:

1. Analisando estrutura WCAG
2. Processando imagens
3. Gerando recomendacoes
4. Preparando interface

Esse job fica salvo em `chrome.storage.local`, o que permite ao popup consultar progresso, status, resultados parciais e erros.

### 3. Analise local no content script

O background envia `action: analyzeAccessibility` para a aba. O content script responde executando `AccessibilityAnalyzer.analyzePageForAccessibility()`.

Essa rotina:

1. Instancia `WCAGEvaluator`.
2. Executa `evaluate()`.
3. Serializa os problemas encontrados.
4. Gera um resumo com:
   - `total`
   - `critical`
   - `warnings`
   - `requiresLLM`
   - lista completa de `issues`
5. Extrai metadados da pagina em `pageContent`:
   - titulo
   - URL
   - idioma
   - HTML truncado em 50.000 caracteres
   - lista de imagens com `src`, `alt` e `title`

Importante: essa fase e local. Nenhuma chamada ao LLM acontece aqui.

### 4. Avaliacoes WCAG executadas localmente

O metodo `evaluate()` executa as seguintes verificacoes no DOM:

1. `evaluateImages()`
2. `evaluateHeadings()`
3. `evaluateForms()`
4. `evaluateLinks()`
5. `evaluateButtons()`
6. `evaluateTitleAttributes()`
7. `evaluateColorContrast()`
8. `evaluateTextPresentation()`
9. `evaluatePageRegions()`
10. `evaluateSemanticHTML()`
11. `evaluateAriaHidden()`
12. `evaluateAriaReferences()`
13. `evaluateLanguage()`
14. `evaluatePageTitle()`
15. `evaluateKeyboardNavigation()`
16. `evaluateFocusIndicators()`

Cada issue recebe severidade, criterio WCAG associado, mensagem e, quando aplicavel, a flag `requires_llm`.

### 5. Decisao sobre uso de LLM

Depois da analise local, o background usa `analysisResult.summary.requiresLLM > 0` para decidir se a etapa "Processando imagens" deve ser ativada.

Na implementacao atual, `requiresLLM` sobe quando existe pelo menos um problema marcado com `requires_llm: true`, incluindo:

- imagens sem alt
- alt muito curto
- alt muito longo
- links com texto generico
- contraste insuficiente

Observacao importante: essa decisao ativa a etapa de processamento de imagens, mas a extracao de imagens para essa etapa considera apenas imagens sem atributo `alt`. Isso significa que a etapa pode ser aberta mesmo quando o problema que acionou `requiresLLM` nao e uma imagem sem alt.

### 6. Acionamento do LLM para imagens

Se a etapa de imagens for ativada, o background pede ao content script `action: extractImages`.

O content script retorna apenas imagens que:

- nao sao espacadoras
- nao possuem atributo `alt`

Para cada imagem retornada, o background executa `processImages()` e, dentro dela, chama `generateImageAltText(image.src)`.

#### Quando o LLM e acionado aqui

O LLM e acionado uma vez por imagem elegivel.

#### Por que o LLM e acionado aqui

Porque a extensao nao consegue inferir de forma confiavel, apenas pelo DOM, o conteudo visual da imagem. O modelo e usado para gerar uma descricao curta e util como texto alternativo.

#### O que e enviado ao LLM aqui

O prompt de alt text envia principalmente:

- a URL da imagem
- uma instrucao de sistema pedindo um alt text conciso, descritivo e sem explicacoes extras

#### Resultado esperado

O modelo deve retornar apenas o alt text. Se a chamada falhar, a rotina registra falha por imagem e usa fallback.

### 7. Acionamento do LLM para recomendacoes de remediacao

Independentemente de haver ou nao imagens a processar, o background executa `analyzePageForOptimizations(pageContent, issues)` ao final da analise local.

Essa e a principal chamada de LLM para raciocinio sobre correcao.

#### Quando o LLM e acionado aqui

O LLM e acionado apos a etapa de analise local, durante a etapa "Gerando recomendacoes".

#### Por que o LLM e acionado aqui

Porque transformar problemas brutos do DOM em recomendacoes tecnicas aplicaveis exige interpretacao contextual. O modelo e usado para:

- priorizar correcoes
- sugerir mudancas semanticas
- propor `aria-label`
- sugerir alteracoes de texto visivel
- gerar CSS para contraste, foco e legibilidade
- relacionar cada recomendacao a um criterio WCAG

#### O que e enviado ao LLM aqui

O prompt inclui:

- titulo da pagina
- URL
- idioma
- resumo dos problemas encontrados

Esse resumo e gerado por `prepareIssuesSummary()` e pode incluir, conforme o tipo de problema:

- seletor CSS
- `aria-labelledby`
- `aria-describedby`
- trecho de HTML
- `placeholder`
- `title_attribute`
- `element_text`
- `alt_text`
- `adjacent_text`
- `name`
- `id`
- `input_type`
- `text_content`
- `foreground_color`
- `background_color`
- `contrast_ratio`
- `minimum_contrast`
- `font_size`
- `font_weight`
- indicacao de texto grande
- `background_image`

Observacao importante: embora `pageContent` contenha o HTML truncado da pagina, o prompt atual de recomendacoes usa explicitamente titulo, URL, idioma e o resumo dos problemas. O HTML extraido nao aparece no prompt montado hoje.

#### Estrutura de resposta esperada do LLM

O modelo deve devolver um JSON com:

- `optimizations`
- `structureChanges`
- `ariaLabels`
- `textChanges`
- `styles`

Esse formato existe para que a extensao consiga aplicar correcoes de forma controlada depois da analise.

### 8. Consolidacao e encerramento

Ao final, o background salva no job:

- `analysisResult`
- `imageAltResults`
- `optimizations`
- `progress: 100`
- `status: completed`

O popup entao passa a ler esse job e mostrar progresso, resumo dos problemas e recomendacoes prontas para revisao.

## Itens WCAG tratados na analise local

### 1.1.1 Alternativas de Texto - Nivel A

Checagens executadas:

- imagem sem atributo `alt`
- imagem espacadora sem `alt=""`
- alt muito curto
- alt muito longo
- alt redundante em relacao ao texto adjacente

Uso de LLM:

- Sim, para gerar alt text de imagens sem `alt`
- Sim, indiretamente, para recomendacoes sobre problemas de alt text

### 1.3.1 Informacoes e Relacoes - Nivel A

Checagens executadas:

- ausencia total de headings
- pagina sem `h1`
- primeiro heading nao ser `h1`
- salto de nivel de heading, como `h2` para `h4`
- heading vazio
- campo de formulario sem rotulo associado
- ausencia de landmarks ou regioes semanticas
- excesso de `div` com `role` no lugar de elementos semanticos

Uso de LLM:

- Sim, na etapa de recomendacoes estruturais
- Nao, na deteccao inicial

### 1.4.3 Contraste Minimo - Nivel AA

Checagens executadas:

- contraste de texto abaixo do minimo exigido
- limite minimo de 4.5:1 para texto normal
- limite minimo de 3:1 para texto grande

Detalhe de implementacao:

- a rotina verifica elementos visiveis com texto direto
- a checagem e limitada aos primeiros 100 elementos elegiveis

Uso de LLM:

- Sim, para propor CSS corretivo e estrategia de remediacao

### 2.1.1 Teclado - Nivel A

Checagens executadas:

- excesso de `tabindex` positivo em elementos interativos

Uso de LLM:

- Sim, apenas na fase de recomendacoes

### 2.4.2 Titulo da Pagina - Nivel A

Checagens executadas:

- pagina sem titulo
- titulo muito curto

Uso de LLM:

- Sim, apenas para sugerir correcao, se necessario

### 2.4.4 Proposito do Link - Nivel A

Checagens executadas:

- link sem texto descritivo
- imagem clicavel sem alternativa textual adequada
- link com texto generico como "clique aqui", "leia mais" ou "saiba mais"

Uso de LLM:

- Sim, para propor textos melhores e rotulos acessiveis
- O problema de texto generico ja nasce com `requires_llm: true`

### 2.4.7 Foco Visivel - Nivel AA

Checagens executadas:

- remocao de `outline` em seletores `:focus` sem substituicao evidente

Uso de LLM:

- Sim, para sugerir estilos de foco visivel

### 3.1.1 Idioma da Pagina - Nivel A

Checagens executadas:

- ausencia de atributo `lang` no elemento `html`

Uso de LLM:

- Sim, apenas para recomendacao de ajuste

### 4.1.2 Nome, Funcao, Valor - Nivel A

Checagens executadas:

- elemento com `aria-hidden="true"` contendo conteudo navegavel
- elementos com `aria-labelledby` ou `aria-describedby` apontando para IDs inexistentes

Uso de LLM:

- Sim, para sugerir remediacao segura de atributos ARIA e visibilidade

## Alertas adicionais tratados fora dos criterios principais

A extensao tambem gera alertas de legibilidade com criterio interno `Advisory`:

- `title` redundante, repetindo exatamente o texto ja visivel
- texto muito pequeno, abaixo de 14px
- blocos longos com `text-align: justify`

Esses pontos nao sao modelados como um criterio WCAG principal no objeto de criterios, mas entram no resumo e podem influenciar as recomendacoes geradas pelo LLM.

## Resumo de quando o LLM e acionado

O LLM e acionado em dois momentos distintos:

1. Geracao de alt text de imagem
   - Quando ha imagens elegiveis sem `alt`
   - Motivo: inferir conteudo visual e produzir texto alternativo

2. Geracao de recomendacoes de correcao
   - Depois que a analise local termina
   - Motivo: converter issues tecnicas em acoes concretas de acessibilidade, semantica, ARIA e CSS

## O que continua sendo deterministico e local

As seguintes partes nao dependem de LLM:

- varredura do DOM
- identificacao inicial dos problemas
- contagem de problemas criticos e avisos
- serializacao de seletores e metadados dos elementos
- extracao de metadados da pagina
- decisao de orquestracao do job

Em outras palavras: o LLM nao descobre os problemas iniciais. Ele entra depois, para enriquecer a resposta e sugerir como corrigi-los.

## Observacoes relevantes sobre o comportamento atual

1. A etapa "Processando imagens" e ativada por `summary.requiresLLM > 0`, mas a extracao de imagens so considera imagens sem `alt`. Isso pode deixar a etapa ativa mesmo sem imagens elegiveis para gerar alt text.
2. O HTML da pagina e extraido no content script, mas o prompt atual de recomendacoes nao usa esse HTML explicitamente.
3. Problemas de contraste e texto generico em links ja marcam `requires_llm: true`, o que influencia a progressao do job mesmo antes de qualquer chamada especifica de alt text.

## Conclusao

O desenho atual separa bem duas responsabilidades:

- deteccao local e deterministica de problemas WCAG
- apoio do LLM para produzir descricoes e recomendacoes de remediacao

Isso reduz dependencia do modelo na descoberta inicial dos erros e usa o LLM principalmente onde ha necessidade de interpretacao contextual ou descricao de conteudo visual.