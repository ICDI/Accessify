# Estudo 1 — análise do lote de 24/10/2026

Sessões: 1ª passada `20261024-203955404-d8a9` (baseline, v1.0.0, v1.1.0, v1.1.0-fix em 100 páginas; v1.1.0-vision em 19), variância `20261024-234322221-70ab` (3 execuções × 10 páginas). Build `v1.1.0-jis_submission`; modelo `qwen3:8b` (visão: `gemma3:4b`), temperatura 0, contexto 4096, máquina do lote com GPU em clock travado (D10). Amostra: `docs/pesquisa/criterio_amostragem.md`. Reproduzir: `python3 -I eval/tools/analisar.py 20261024-203955404-d8a9 20261024-234322221-70ab docs/analise/estudo1-comparacao-versoes`.

Leitura: "violações axe" = pares (regra, nó) com violação WCAG 2.1 A/AA; "novos erros" = violações no pós sem par na baseline do mesmo snapshot; "rótulos genéricos" = rótulos de fallback novos no DOM ("Abrir link N", alt "Imagem"); falha é dado do estudo.

## 1. Resultado por condição (1ª passada, uma execução por página)

| Condição | Páginas | ok | parcial | falha | Violações axe baseline→pós (páginas ok) | Média por página baseline→pós | Críticas baseline→pós | Páginas que pioraram | Novos erros axe (total) | IBM violações baseline→pós | Novos erros IBM (total) | Rótulos genéricos (total) | Tokens in / out | Latência média por página |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 100 | 100 | 0 | 0 | 1843 | 18.4 | 365 | — | — | 3189 | — | — | — | — |
| v1.0.0 | 100 | 89 | 0 | 11 | 1672→989 | 18.8→11.1 | 326→92 | 15 | 296 | 2978→2438 | 602 | 940 | 260029 / 199041 | 46.3 s |
| v1.1.0 | 100 | 98 | 0 | 2 | 1836→634 | 18.7→6.5 | 365→110 | 3 | 230 | 3169→1875 | 564 | 1233 | 4369 / 1728 | 0.3 s |
| v1.1.0-fix | 100 | 98 | 0 | 2 | 1836→634 | 18.7→6.5 | 365→110 | 3 | 230 | 3169→1875 | 564 | 1233 | 4531 / 329 | 0.1 s |
| v1.1.0-vision | 19 | 19 | 0 | 0 | 786→279 | 41.4→14.7 | 152→38 | 0 | 78 | 735→224 | 123 | 320 | 11269 / 283 | 1.8 s |

## 2. Redução de violações axe por estrato (média por página, páginas ok; baseline → pós)

| Estrato | Páginas | baseline | v1.0.0 | v1.1.0 | v1.1.0-fix | v1.1.0-vision |
|---|---|---|---|---|---|---|
| A | 18 | 19.9 | 10.4 (n=17) | 5.0 (n=18) | 5.0 (n=18) | 2.5 (n=2) |
| B | 28 | 4.9 | 3.3 (n=23) | 1.9 (n=27) | 1.9 (n=27) | 5.0 (n=1) |
| C | 22 | 28.8 | 16.4 (n=20) | 9.0 (n=21) | 9.0 (n=21) | 14.1 (n=9) |
| D | 18 | 31.1 | 18.9 (n=17) | 13.3 (n=18) | 13.3 (n=18) | 37.0 (n=3) |
| E | 4 | 12.5 | 9.5 (n=4) | 7.5 (n=4) | 7.5 (n=4) | 10.0 (n=3) |
| F | 8 | 7.6 | 7.7 (n=6) | 4.0 (n=8) | 4.0 (n=8) | — |
| controle | 2 | 22.0 | 1.0 (n=2) | 0.5 (n=2) | 0.5 (n=2) | 1.0 (n=1) |

## 3. Regras do axe-core mais corrigidas e mais introduzidas (soma de nós nas páginas ok)

**v1.0.0** — corrigidas: link-name −384, color-contrast −202, label −132, image-alt −83, button-name −16, select-name −9; aumentaram: color-contrast +71, svg-img-alt +50, aria-prohibited-attr +5, label-content-name-mismatch +5, role-img-alt +4; novos erros por regra: color-contrast 71, svg-img-alt 50, aria-prohibited-attr 5, label-content-name-mismatch 5, role-img-alt 4

**v1.1.0** — corrigidas: color-contrast −526, link-name −419, label −132, image-alt −98, label-content-name-mismatch −31, button-name −17; aumentaram: label-content-name-mismatch +25, svg-img-alt +21, nested-interactive +6, role-img-alt +4, color-contrast +4; novos erros por regra: label-content-name-mismatch 25, svg-img-alt 21, nested-interactive 6, role-img-alt 4, color-contrast 4

**v1.1.0-fix** — corrigidas: color-contrast −526, link-name −419, label −132, image-alt −98, label-content-name-mismatch −31, button-name −17; aumentaram: label-content-name-mismatch +25, svg-img-alt +21, nested-interactive +6, role-img-alt +4, color-contrast +4; novos erros por regra: label-content-name-mismatch 25, svg-img-alt 21, nested-interactive 6, role-img-alt 4, color-contrast 4

**v1.1.0-vision** — corrigidas: color-contrast −261, link-name −126, image-alt −98, button-name −9, select-name −7, label-content-name-mismatch −7; aumentaram: label-content-name-mismatch +6, nested-interactive +4, aria-command-name +1, aria-prohibited-attr +1; novos erros por regra: label-content-name-mismatch 6, nested-interactive 4, aria-command-name 1, aria-prohibited-attr 1


## 4. Falhas por causa (1ª passada)

| Condição | Causa | Páginas |
|---|---|---|
| v1.0.0 | aplicação: nome de tag inválido (replaceWith sem validação, C5) | IBC, FNDE, INSS, Periódicos CAPES, eMAG (5) |
| v1.0.0 | painel da v1.0.0 não respondeu (página gigante) | Planalto (1) |
| v1.0.0 | timeout do modelo/análise (D8) | ProUni, Transparência, UFG, Laramara, UFPA (5) |
| v1.1.0 | análise da v1.1.0 não terminou (página gigante) | Planalto (1) |
| v1.1.0 | aplicação: element.id não é texto (formulário com campo "id") | UnB (1) |
| v1.1.0-fix | análise da v1.1.0 não terminou (página gigante) | Planalto (1) |
| v1.1.0-fix | aplicação: element.id não é texto (formulário com campo "id") | UnB (1) |

## 5. Variância entre 3 execuções (10 páginas do estrato `variancia`)

| Condição | Páginas com 3 ok | Violações axe idênticas nas 3 | Maior amplitude | Rótulos genéricos idênticos | Maior amplitude de tokens de saída | Status diferente entre execuções |
|---|---|---|---|---|---|---|
| v1.0.0 | 8 de 10 | 7 | 1 | 7 | 427 | 0 |
| v1.1.0 | 9 de 10 | 9 | 0 | 9 | 0 | 0 |
| v1.1.0-fix | 9 de 10 | 9 | 0 | 9 | 0 | 0 |
| v1.1.0-vision | 1 de 1 | 1 | 0 | 1 | 0 | 0 |

## 6. Textos alternativos gerados (estrato `visao`): condição de visão × v1.1.0-fix

| Condição | Origem | Com imagem | Alts |
|---|---|---|---|
| v1.1.0-fix | heuristic | não | 7 |
| v1.1.0-fix | llm | não | 26 |
| v1.1.0-vision | heuristic | não | 7 |
| v1.1.0-vision | llm | sim | 26 |

Lista completa (alt final, seletor, origem, latência) em `alts_visao.csv` (66 linhas), para a avaliação da coautora.

## 7. Custo por condição (1ª passada, páginas ok)

| Condição | Páginas que chamaram o modelo | Tokens de entrada | Tokens de saída | Latência total do modelo | Latência média por página | Páginas com timeout |
|---|---|---|---|---|---|---|
| v1.0.0 | 89 de 89 | 260029 | 199041 | 68.6 min | 46.3 s | 6 |
| v1.1.0 | 19 de 98 | 4369 | 1728 | 0.6 min | 0.3 s | 0 |
| v1.1.0-fix | 19 de 98 | 4531 | 329 | 0.1 min | 0.1 s | 0 |
| v1.1.0-vision | 18 de 19 | 11269 | 283 | 0.6 min | 1.8 s | 0 |
