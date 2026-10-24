# Accessify — Compilado de Melhorias e Correções (pós-1.0.0)

Este documento resume tudo que foi implementado na evolução **1.1.0**, a partir da base 1.0.0. É uma única leva de melhorias — não uma sequência de pequenas versões. Foco permanente: **usuários cegos e de baixa visão**, critérios **WCAG 2.1 até o nível AA**.

---

## Problemas de origem (1.0.0)

- Dependência total de API paga (OpenRouter) para a IA funcionar.
- Alt text gerado só a partir da URL da imagem — o modelo não via a imagem.
- Avaliador WCAG duplicado, com uma cópia sequer carregada, deixando vários critérios A/AA relevantes para leitor de tela fora de detecção (ex.: tabela sem `th`, `div` com `onclick`).
- Contraste podia piorar depois do plugin agir (técnica de esconder elementos que ferramentas de auditoria não reconheciam, e cálculo de fundo que ignorava `background-image`).
- Estado da análise era global, não por aba.
- Reanalisar uma página já corrigida encontrava pouca coisa (aparência de "cache" grudado).
- A própria interface do plugin (painel e configurações) tinha problemas de acessibilidade.

---

## IA e infraestrutura

- **IA local via Ollama (Qwen3 8B)**, sem exigir API key, além do OpenRouter (que segue disponível com lista de modelos mais barata: DeepSeek V4 Flash, GPT-5 Nano, Qwen 3.5 Flash, Gemini 2.5 Flash Lite). Instalação nova cai no Ollama por padrão; quem já tinha chave OpenRouter continua nele.
- **Alt text em dois caminhos:** no Ollama, contexto textual da página (nome do arquivo, `title`, `figcaption`, texto adjacente, `aria-label` do pai, dimensões), sem inventar detalhes; no OpenRouter com modelo de visão, envia a imagem (JPEG via canvas) ou a URL.
- **`wcag-evaluator.js` unificado** como única fonte de verdade da avaliação, carregado antes de `content.js` (eliminada a duplicação que fazia parte da lógica nunca rodar).
- Etapa "Processando imagens" passou a abrir **só** quando há imagem sem `alt` (antes também disparava por contraste/link genérico).
- Duas heurísticas (`isDecorativeIconImage` comparando token exato de classe, `isMarkedDecorative`) reduzem quantas imagens dependem de heurística cara ou de IA.
- **Zero chamadas de IA para correção estrutural, em qualquer provedor.** Todos os tipos de problema detectados estão na lista de skip (`llmSkipIssueTypes`, `ai-config.js`) — o pipeline de recomendações por IA existe como ponto de extensão futuro, mas nunca é chamado hoje. A única IA que roda de fato é a descrição de imagens sem contexto textual aproveitável.

---

## Todos os novos critérios WCAG detectados e corrigidos

**Alto impacto, detecção + correção automática (sem IA):**

| Critério | Nível | O que faz |
|---|---|---|
| 1.3.1 Tabela sem `th`/`scope` | A | Primeira linha `td` → `th scope="col"` |
| 2.1.1 / 4.1.2 `div`/`span` clicável sem teclado | A | `role="button"`, `tabindex="0"`, Enter/Espaço |
| 2.4.1 Skip link ausente | A | Insere skip link visível no foco (técnica `sr-only`) |
| 4.1.2 `iframe` sem `title` | A | `title` inferido do hostname |
| 1.1.1 SVG/imagem sem nome acessível | A | `role="img"` + `aria-label` |
| 1.4.1 Link diferenciado só por cor | A | `text-decoration: underline` |
| 4.1.2 IDs duplicados | A | Sufixo `-accessify-N` |
| 3.3.2 Rótulo de formulário só por placeholder | A | Cria `<label for="...">` |
| 1.4.2 Áudio/vídeo autoplay com som | A | Pausa e adiciona `controls` |
| 2.4.4 Link `target="_blank"` sem aviso | A | Acrescenta "(abre em nova aba)" ao nome acessível |
| 1.3.1/4.1.2 Landmarks duplicados (`nav`/`aside`) | A | Infere `aria-label` por heading, posição ou índice |
| 2.2.2 Animação infinita | A | Injeta `prefers-reduced-motion: reduce` |
| 3.3.1/3.3.3 Erro de formulário sem `aria-describedby` | A | Liga a mensagem de erro via `aria-describedby` + `aria-invalid` |
| 4.1.2 ARIA de referência quebrada (8 atributos: `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`, `aria-activedescendant`, `aria-flowto`, `aria-details`, `aria-errormessage`) | A | Remove/corrige a referência quebrada |
| Texto sublinhado indevido fora de link/botão | Advisory | Remove o sublinhado que pode ser confundido com link |

**AA visual, ainda automatizável:**

| Critério | Nível | O que faz |
|---|---|---|
| 1.4.11 Contraste de elementos não-textuais | AA | Ajuste de CSS |
| 1.4.4 Zoom bloqueado (`user-scalable=no`) | AA | Libera zoom |
| 1.3.5 `autocomplete` ausente em campos de identificação | AA | Preenche `autocomplete` |
| 2.5.3 `aria-label` sem o texto visível | A | Ajuste de rótulo |
| 1.3.2 Ordem visual (CSS `order`) divergente do DOM | A | Só alerta |
| 1.4.3 Contraste de texto (limite ampliado, considera `background-image`) | AA | Cor de texto ou caixa sólida conforme confiabilidade do fundo |

**Detectados mas sem correção automática (revisão humana):**

| Critério | Motivo |
|---|---|
| 1.1.1 Alternativa a CAPTCHA | Não dá para gerar alternativa acessível por regra — marcado crítico |
| Mais de um `<h1>` | Decidir qual rebaixar exige contexto |
| 2.2.1 Meta refresh com delay | Remover arriscaria quebrar fluxos legítimos (ex. timeout de sessão) |
| Heading level pulado (H3→H5) | Inventar heading intermediário exigiria adivinhar texto |
| Link para âncora inexistente (`href="#algo"` sem alvo) | Não dá para adivinhar o alvo certo |

Também ampliado: detecção de `outline:none` passou a cobrir estilo **inline**, além de folha de estilo.

Já existia na 1.0.0 e continua: imagens sem alt/alt redundante/spacer (1.1.1), headings/labels/landmarks (1.3.1 parcial), contraste de texto (1.4.3), `tabindex` positivo em excesso (2.1.1 parcial), título ausente/curto (2.4.2), link vazio/genérico (2.4.4), `outline:none` em CSS (2.4.7), `lang` ausente (3.1.1), `aria-hidden` com foco / `aria-labelledby` quebrado (4.1.2 parcial), texto pequeno/justificado/`title` redundante (advisory).

---

## Confiabilidade e correções de bug

- **Contraste que não piora mais:** skip link e H1 injetado trocaram a técnica antiga (`position:absolute; left:-9999px`, que ferramentas de auditoria não reconheciam como oculta) pela técnica padrão `sr-only`. Novo método `hasUncertainBackground()` detecta fundo com `background-image` e força uma caixa sólida em vez de arriscar a cor de texto errada.
- **Convergência garantida num clique só:** `applyOptimizations()` roda em até 4 rodadas, aplicando as correções determinísticas e recontando problemas reais com uma reavaliação nova a cada rodada, até zerar ou estabilizar. Antes, um problema podia sobrar e só era corrigido se o usuário clicasse de novo manualmente.
- **Estado da análise isolado por aba:** chave por aba (`analysisJob:<tabId>`) em vez de uma chave global — analisar a aba 1 e abrir a aba 2 não mistura mais os resultados. Limpeza automática ao fechar aba ou navegar para URL diferente.
- **Reload automático antes de reanalisar** uma página que já tinha correções aplicadas — evita a falsa impressão de "cache" grudado (o Accessify só altera o DOM local, nunca envia nada ao servidor).
- **Resultado mais estável em sites reais:** a análise aguarda `document.fonts.ready` e frames de renderização antes de avaliar, reduzindo variação causada por fontes ainda carregando.

---

## Acessibilidade da própria interface do Accessify

Auditoria manual do `popup.html` e do `options.html` encontrou as mesmas classes de problema que o Accessify corrige em páginas de terceiros: switch e "link" de configurações sem suporte a teclado/leitor de tela, barra de progresso sem `role="progressbar"`, nenhuma região `aria-live` nas áreas que mudam de texto sozinhas, grupo de rádio "Provedor" sem `fieldset`/`legend`, botão de mostrar/ocultar senha só com emoji (sem nome acessível), ícones decorativos lidos em voz alta pelo leitor de tela, e nenhum indicador de foco customizado.

**Correção:** `role`/`aria-checked`/`aria-labelledby`/teclado no switch; link de configurações virou `<button>`; `role="progressbar"` com `aria-valuenow` sincronizado; `role="status" aria-live="polite"` nas regiões dinâmicas de ambas as telas; `fieldset`/`legend` no grupo de provedor; `aria-label`/`aria-pressed` sincronizados no botão de senha; ícones decorativos com `aria-hidden="true"`; `:focus-visible` com contorno de 3px nos controles não nativos.

---

## Resumo do que mudou, por dimensão

- **Dependência de IA:** de "IA tentava corrigir quase tudo" (1.0.0) para **zero chamadas de IA em correção estrutural** — a única IA que roda de fato é alt text de imagem sem contexto textual aproveitável, e mesmo essa cada vez menor (mais imagens decorativas resolvidas por regra).
- **Critérios WCAG cobertos:** de poucos critérios A + 2 AA (1.0.0) para **>20 critérios A/AA** detectados e, na maioria, corrigidos automaticamente, cobrindo tabelas, teclado, skip link, iframe, SVG, cor, IDs duplicados, rótulos, contraste (texto e não-texto), zoom, autocomplete, mídia autoplay, animação, CAPTCHA, erro de formulário, ARIA de referência, links quebrados, sublinhado indevido.
- **Confiabilidade das correções:** convergência por múltiplas passadas garante que "Aplicar Otimizações" resolve tudo que é automatizável num único clique, sem depender de o usuário repetir a ação.
- **Isolamento e ciclo de vida:** análise por aba, com limpeza automática ao trocar de aba/navegar, e reload automático antes de reanalisar uma página já corrigida.
- **Custo/infra:** roda 100% offline via Ollama (sem API key), ou com lista de modelos OpenRouter mais barata que a original.
- **Acessibilidade da própria interface:** popup e configurações do Accessify passaram a seguir as mesmas regras WCAG que o plugin aplica em páginas de terceiros (teclado, `aria-live`, `fieldset`/`legend`, nomes acessíveis, foco visível).

---

*Compilado a partir de [EVOLUCOES_V1.1.md](EVOLUCOES_V1.1.md).*
