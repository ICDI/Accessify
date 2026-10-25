# Estudo 1 — síntese dos resultados

Base: `estudo1-comparacao-versoes.md` (tabelas e CSVs gerados por `eval/tools/analisar.py`). Build `v1.1.0-jis_submission`, 100 páginas (`docs/pesquisa/criterio_amostragem.md`), axe-core e IBM Equal Access, modelos locais no Ollama com temperatura 0 e contexto 4096, máquina com GPU em clock travado (D10). Lotes executados em 24 e 25/10/2026, cerca de 7 horas de máquina, sem incidentes.

## 1. A v1.1.0 é melhor que a v1.0.0 em todas as métricas automáticas

| Métrica (100 páginas, 1 execução) | v1.0.0 | v1.1.0 |
|---|---|---|
| Páginas concluídas | 89 | 98 |
| Violações axe por página, baseline → pós | 18,8 → 11,1 | 18,7 → 6,5 |
| Violações críticas, total | 326 → 92 | 365 → 110 |
| Páginas que pioraram | 15 de 89 | 3 de 98 |
| Erros novos introduzidos (axe) | 296 | 230 |
| Violações IBM, total | 2 978 → 2 438 | 3 169 → 1 875 |
| Latência de modelo por página | 46 s | 0,3 s |
| Tokens de saída, total | 199 041 | 1 728 |

A redução vale em todos os estratos; o maior ganho absoluto está nas universidades e nos portais científicos, que partem de 29 a 31 violações por página. No controle da W3C a v1.1.0 deixa 0,5 violação por página.

## 2. A melhoria vem das correções determinísticas, não do modelo

Na v1.1.0 apenas 19 das 98 páginas chegaram a chamar o modelo, e a condição `v1.1.0-fix` (sem raciocínio) tem resultado idêntico à `v1.1.0`. A v1.0.0 chamava o modelo em todas as páginas, 46 segundos e 2 200 tokens de saída por página, para um resultado pior. O artigo precisa reposicionar a narrativa "correção por LLM": o LLM escreve textos alternativos e rótulos; a conformidade mensurável vem do avaliador determinístico e das correções locais.

## 3. O modelo não altera as métricas automáticas: 10 modelos, mesmo resultado

Na `v1.1.0-fix`, dez modelos de seis famílias (Qwen3 8B, Qwen3.5 4B e 2B, Llama 3.1 8B e 3.2 3B, Gemma 3 4B, Gemma 4 E2B e E4B, Mistral 7B, DeepSeek R1 8B) produziram exatamente as mesmas violações nas 98 páginas, as mesmas 2 falhas e os mesmos 1 233 rótulos genéricos. Só mudam tokens, latência e o texto dos alts. A dependência do modelo, portanto, está inteira na qualidade do texto gerado, que as métricas automáticas não medem.

## 4. Sem a imagem, o alt é inventado

Nas 27 imagens em que todos os modelos geraram alt sem ver a imagem, nenhuma recebeu o mesmo texto em dois modelos. Para o mesmo banner, os modelos descreveram "um relógio digital", "uma pessoa numa praia" e "um gato laranja dormindo". A condição de visão (`gemma3:4b` com a imagem) completou as 19 páginas do estrato, sem piorar nenhuma, e gerou 26 alts pareados com os 26 sem imagem; a comparação de qualidade é objeto da avaliação com leitor de tela.

## 5. O raciocínio do modelo vira alt quando o Ollama ignora o pedido de desligá-lo

Com o DeepSeek R1 8B, as 27 descrições gravadas foram o raciocínio do modelo, e o custo quintuplicou; o mesmo defeito (D5) já ocorria com o Qwen3 original. Qwen3.5 e Gemma 4 respeitaram o pedido. A extensão precisa validar a resposta, não só pedir que não raciocine.

## 6. Rótulos genéricos aumentaram na v1.1.0

1 233 rótulos de fallback na v1.1.0 contra 940 na v1.0.0. A versão nova silencia mais o validador com "Abrir link N" e similares. É limitação a declarar e reforça o item C6 da POC.

## 7. Erros introduzidos mudaram de natureza

A v1.0.0 cria principalmente problemas de contraste (+71) e SVG sem nome (+50). A v1.1.0 cria rótulos acessíveis que não contêm o texto visível (+25), SVG sem nome (+21) e controles aninhados (+6). As regras mais corrigidas são as mesmas nas duas: contraste, nome de link, rótulo de campo e alt de imagem.

## 8. Falhas são determinísticas e apontam defeitos concretos

- v1.0.0, 11 falhas: tag inválida aplicada sem validação (5 páginas; achado C5), timeout do modelo ou da análise (5), painel travado na Constituição Federal (1).
- v1.1.0, 2 falhas em todas as condições e modelos: Constituição Federal (a análise não termina numa página de 885 mil caracteres) e UnB (`element.id` não é texto quando o formulário tem um campo chamado `id`, `content.js:1028`). São defeitos novos para a POC.
- Nas 3 execuções do estrato de variância, nenhuma página mudou de status; a v1.1.0 é determinística (9 de 9 páginas idênticas) e a v1.0.0 varia pouco no resultado (7 de 8) e muito no texto (até 427 tokens).

## 9. A WAVE confirma o quadro na amostra inteira

Leitura humana da extensão WAVE nas 100 páginas, sobre o snapshot (baseline) e sobre o DOM final dos runs (D16): 300 leituras; 10 estados indisponíveis por falhas definitivas dos runs (3 páginas da v1.0.0 recuperadas com prazo ampliado, D17). Nas 91 páginas com leitura nas três condições: erros de 921 para 91 na v1.0.0 e para 25 na v1.1.0; erros de contraste de 977 para 806 na v1.0.0 e para 285 na v1.1.0, com a v1.0.0 piorando o contraste em 36 páginas (40%) e a v1.1.0 em 11. O AIM Score médio sobe de 6,9 para 8,0 e 9,1. Nos sites originais do SEMISH, a WAVE reproduz o defeito relatado no artigo (IHC 2025: 26 → 44 → 10 erros de contraste). Os alertas caem nas duas versões (3 830 → 2 722 → 2 763) e os itens ARIA sobem na v1.1.0 (12 427 → 15 426), reflexo dos rótulos e atributos que a extensão acrescenta. Casos a discutir: a página inicial da UFG, pior da amostra, tem o contraste agravado pela v1.1.0 (64 → 102); no controle da W3C a v1.0.0 deixa 1 erro e a v1.1.0 deixa 7 (cabeçalhos de tabela vazios). Tabelas por estrato e por página na seção 9 do relatório.

## 10. Limitações do estudo

- Amostra sub-representa aplicações de página única e portais com bloqueio anti-bot ou muita publicidade (Escola Virtual Gov, Sisu/ProUni/Fies, Lattes, Sucupira, Nova Escola, Brasil Escola, Mundo Educação ficaram de fora).
- Snapshot da página inicial do CSBC 2026 aceito manualmente por divergência só visual (D12).
- Contraste após alterações de estilo e qualidade semântica dos textos gerados não são medidos por automação; ficam para as Sessões A e B.
- GPU com clock travado para contornar resets de energia; não afeta resultados, só tempo.
