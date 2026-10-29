# Estudo 2 — sessão de 28/10/2026: registro, pontos para o artigo e melhorias

Sessão de tarefas com a coautora cega (NVDA, Windows; nome omitido até o consentimento de identificação, seção 5), por videoconferência. Marlon Marcon facilitou e Franciele Beal observou. A reunião começou às 19:39 e durou 3:27:42. As tarefas vão de ≈ 00:53 a ≈ 03:04 (seção 2.1), e a entrevista final vai de ≈ 03:04 a ≈ 03:20.

Instrumentos:

- formulário preenchido: `docs/pesquisa/estudo2_formulario_sessao_2026-10-28.xlsx`, uma cópia do modelo. O modelo em branco, `estudo2_formulario.xlsx`, não muda; o gerador `eval/tools/estudo2_gerar.py` escreve nele por padrão;
- protocolo: `docs/pesquisa/estudo2_tarefas.md`.

**Como foi codificado.** A fonte é a transcrição automática do Meet. As referências **Lxxxx** apontam para a linha da transcrição, numerada sem as linhas em branco do `.docx`. As janelas de vídeo vêm dos marcadores de 5 minutos; t0 e t1, do cruzamento da transcrição com o chat do Meet (seção 2.1).

- Dois codificadores independentes (agentes de IA) leram a transcrição inteira e codificaram as 24 execuções pelas regras da seção 5 do protocolo.
  - Concordaram em 23 dos 24 resultados. A divergência foi CSBC-2-B (F × P), conciliada como F, pela regra de encerramento, com P como leitura alternativa.
  - Houve ainda uma divergência no campo "encerrada" de SBC-2-A, conciliada como desistência (F nas duas codificações).
- Os comportamentos da extensão foram conferidos no código. O zip instalado é o commit `296e257`, do branch `modelo-local-gemma3-4b`; no que a sessão exercitou, o código é idêntico ao da tag `v1.1.0-jis_submission`.
- Uma revisão independente conferiu cada citação contra a transcrição e cada referência ao código; as correções já estão aplicadas.
- **Tempos, SEQ e falas literais do NVDA não estão na transcrição.** t0 e t1 foram estimados pelo horário das mensagens do chat e pelas marcas de 5 min (seção 2.1), com erro típico de 20 s em cada ponto: servem para achar as tarefas no vídeo e checar o teto, não substituem a medida no vídeo. A SEQ não foi perguntada.
- A transcrição traz só as vozes, com erros de reconhecimento. As "falas do NVDA" registradas são o que a avaliadora disse ter ouvido.

## 1. O que a sessão foi, e onde se afastou do protocolo

| Aspecto | Protocolo | Sessão |
|---|---|---|
| Provedor e modelo (C) | Ollama local, `qwen3:8b` | **OpenRouter, `openai/gpt-5-nano`** (com visão), com a chave do facilitador (L0400–L0423). O Ollama local (`gemma3:4b`) não conectou no Windows da avaliadora: "Testar conexão" falhou mesmo com `localhost:11434` respondendo, e definir `OLLAMA_ORIGINS` e reabrir o Ollama, com comandos colados no chat (00:22:26–00:22:58), não resolveu (L0234–L0289; M-6). A mesma falha ocorreu no Windows da Franciele (L0763). |
| Acionamento (C) | painel lateral em cada página | **Modo automático** (Alt+Shift+O) em toda a condição C (L0837–L0847, L1621). O painel não foi usado para analisar nem aplicar nas tarefas. Ficou aberto no EDU-1-A, onde mostrou o progresso do automático e recebeu dois Alt+Shift+A (L1169–L1199). Análise e aplicação pelo painel, só no ensaio em sbc.org.br. |
| Perfis | perfil S sem extensão, perfil C com extensão | **Um perfil**, com a extensão instalada. S = automático desligado e painel não acionado; nesse estado a extensão não altera o DOM (`content.js:1882–1930`, `background.js:997–1001`). |
| Build | `v1.1.0-jis_submission` | zip do commit `296e257`, equivalente à tag no que foi exercitado (só muda o modelo local padrão e textos). |
| P0 (treino do painel) | W3C BAD *before*, antes do bloco 1b | Não feito. Houve um ensaio guiado em sbc.org.br durante a instalação (L0463–L0503). |
| Sessões | núcleo (≈ 1h30) e complementar (≈ 40 min) em dias separados, pausa de 10 min | Tudo numa reunião, sem pausa (L1228–L1235, L1525–L1531). Antes das tarefas, ≈ 50 min de instalação e depuração. |
| Cronometragem e SEQ | "pode começar" / "minha resposta é…", teto de 300 s líquidos, SEQ após cada tarefa, log do NVDA | Nada disso ao vivo. As tarefas terminaram por resposta, desistência ou decisão do facilitador. t0 e t1 foram estimados depois, pela transcrição e pelo chat (seção 2.1). |
| Regras lidas à avaliadora | silêncio, "minha resposta é…", pedir repetição | Não foram lidas. Só "sem baixar arquivos" aparece nas ações do IHC. |
| Entrega das ações | o facilitador abre a URL e lê o cartão | URLs e títulos (ou o nome do periódico) colados no chat. A ação foi dita oralmente, às vezes incompleta (EDU-1-A; EDU-3-A; JIS-1-B, com o ano trocado, L1716–L1718), e ela perguntou várias vezes o que devia encontrar (L0664, L1715, L1750). A URL da CAPES-1-A saiu sem o h inicial e foi corrigida de viva voz (L0653). As de SBC-1-B e SBC-2-B não foram coladas: ela voltou ao site sozinha (L1757, L1775). |
| Ajuda | proibida (indicar caminho, conteúdo ou atalho) | Houve ajuda em CAPES-1-A, SOL-2-A, IHC-1-A/B, JIS-1-A/B, SBC-1-A e SBC-2-A. A observadora interveio em várias tarefas e compartilhou a própria tela entre os blocos 1a e 1b (L0770–L0824). |
| Retestes e interrupções | — | CSBC-2-B refeito sem a extensão logo depois (L1310–L1331). Na página do JIS, a extensão foi ligada depois do JIS-1-A para comparar (L1567–L1606). JIS-1-B foi pulada (L1712–L1713, L1746) e SBC-2-B virou checagem do menu (L1779). |
| Ordem | roteiro, 24 execuções | Seguiu o roteiro de 1 a 24, sem trocas por reserva. A SOL abriu nas 4 execuções. |

Linha do tempo do modo automático:

| Linha | Estado | Para quê |
|---|---|---|
| L0465 | desligado | antes do bloco 1a |
| L0838 | ligado | blocos 1b e 2a |
| L1312 | desligado | bloco 2b |
| L1569–L1590 | ligado e desligado | só para o teste no JIS |
| L1621 | ligado | blocos 3b e 4a |
| L1757 | desligado | bloco 4b |

## 2. Resultados por tarefa

Resultado pela regra estrita do protocolo (ajuda, desistência ou encerramento pelo facilitador → F) e, entre parênteses, a leitura alternativa quando ela muda o código (coluna AG do formulário). A leitura alternativa não rebaixa a F uma ajuda leve dada depois de a avaliadora já ter o caminho, e aplica o critério P da linha em CSBC-2-B.

| Tarefa | Efeito previsto | S (sem extensão) | C (modo automático) |
|---|---|---|---|
| SOL-1 | baixo | A: **S** — "Danilo Lima … Teixeira" | B: **S** — "João Vítor … Castro", hesitante |
| CAPES-1 | nulo a negativo | A: **F** — leu o e-ISSN 1678-4804; o facilitador disse o valor esperado (L0671) antes da resposta 0104-6500 | B: **S** — 0103-5053; "ficou o mesmo" (L1256) |
| IHC-2 (controle) | — | A: **S** — ST 2; horário associado só pela posição (L0721–L0728) | B: **S** — ST 6; "mesmo padrão", em resposta a pergunta do facilitador |
| CSBC-2 | **negativo** | A: **S** — o NVDA leu `scherm.com.br` | B: **F** (alt. P) — o link do logotipo virou "ouro"; ela propôs seguir o link e o facilitador encerrou (L1293–L1309) |
| SOL-2 (controle) | — | B: **S** — "pela posição do conteúdo na página" | A: **F** (alt. S) — o facilitador disse que a informação estava na própria página (L0868–L0874) |
| CAPES-2 | baixo | B: **S** — cref@sibi.ufrj.br | A: **S** — e-mails @unb.br, abrindo "Acionar botão 7…11" um a um |
| IHC-1 | baixo/negativo | B: **F** — "a informação … não tem" | A: **F** — "uns 20 minutos ou mais"; encerrada |
| EDU-1 | positivo | B: **S** | A: **S** |
| JIS-1 (controle) | — | A: **F** — busca "somente leitura"; respondeu que o artigo não estava no periódico | B: **F** — pulada pelo facilitador; menu "não deixa interagir" |
| EDU-3 | positivo | A: **S** — "as trilhas … separadas por título ajudou" | B: **S** |
| SBC-1 | positivo | B: **S** — R$ 394 | A: **F** (alt. S) — R$ 142 depois de "você tem que tentar encontrar nos menus" (L1643) |
| SBC-2 | positivo | B: **F** — virou checagem do menu, sem resposta | A: **F** — "jamais vou achar essa informação" |

Contagens:

| Leitura | S (sem extensão) | C (com extensão) |
|---|---|---|
| Regra estrita | 8 S, 4 F | 6 S, 6 F |
| Leitura alternativa | 8 S, 4 F | 8 S, 1 P, 3 F |

Síntese:

- Na leitura alternativa, o resultado foi igual nas duas condições em 10 das 12 tarefas. Diferem:
  - **CSBC-2**, pior com a extensão, como o protocolo previa (§9);
  - **CAPES-1**, em que a variante sem a extensão teve o valor dito pelo facilitador (efeito da condução, não da extensão).
- **IHC-1 falhou nas duas condições** por barreiras do site: estrutura das listas e falta de busca.
- **JIS-1 e SBC-2** falharam na primeira variante pelas barreiras do site (busca e menus). Na segunda, foram interrompidas pelo facilitador depois de ela encontrar a mesma barreira (L1746, L1779).
- Nenhum dos quatro efeitos positivos previstos (EDU-1, EDU-3, SBC-1, SBC-2) mudou o resultado. O ganho da tabela da SBC apareceu só na percepção da avaliadora (seção 3.2, item 5).
- A estimativa global da avaliadora foi "uns 20%" de diferença (L1840). A primeira resposta dela foi "Ainda não muito, um pouco às vezes na estrutura da página" (L1796–L1798).
- O estudo funcionou como teste de "não causar dano": houve um dano observado (CSBC-2) e ganhos pontuais percebidos.

### 2.1 Tempos estimados pela transcrição e pelo chat

Não houve cronômetro. Os tempos abaixo cruzam a transcrição com a transcrição do chat do Meet (`.sbv`) e foram calculados por `eval/tools/estudo2_tempos.py`, que também os grava no formulário (colunas N, O e AH). Servem para achar cada tarefa no vídeo e para checar o teto de 300 s. Não substituem a medida no vídeo.

- **Âncoras.** As marcas de 5 min da transcrição e as 32 mensagens do chat, cada uma com horário exato. São 27 URLs e títulos das tarefas, o endereço dos atalhos, os três comandos de instalação do Ollama e a chave do OpenRouter.
  - Cada mensagem foi casada com a fala que a menciona. "Vou colar" começa antes da mensagem; "colei" ou "tá no chat", depois.
  - As 32 caem na janela de 5 min esperada: a transcrição e o chat têm o mesmo zero. Falta conferir o zero do vídeo.
- **t0 e t1.** Sem "pode começar", t0 é o fim da instrução falada, com as repetições que o facilitador fez antes de ela começar. t1 é o fim da última resposta dela, mesmo depois de ajuda (CAPES-1-A), ou da desistência. Sem nenhuma das duas, t1 é a fala do facilitador que encerrou a tarefa. As linhas estão na coluna AF.
  - Um segundo leitor conferiu as linhas contra a transcrição e concordou com as 35 âncoras do chat e com 17 das 24 escolhas.
  - Seis mudaram: o t0 de IHC-2-A, IHC-2-B e SBC-1-A, e o t1 de JIS-1-A, CSBC-2-B e IHC-1-B. O t1 passou a ser a resposta ou a última fala dela, não o encerramento, que veio depois de ajuda.
- **Faixa.** É o intervalo que cabe entre as âncoras com fala rápida (6 palavras/s) e nenhum silêncio.
- **Estimativa.** É a média de dois modelos, com o ritmo típico de fala medido na entrevista final (2,16 palavras/s):
  - o modelo A interpola entre as âncoras vizinhas;
  - o modelo B põe o silêncio que sobra entre as âncoras dentro das tarefas, onde a avaliadora navega calada.
- **Validação.** Cada mensagem do chat foi deixada de fora, e o script previu a hora da fala que a menciona.
  - As 35 falas caíram na faixa prevista.
  - Para a média dos modelos, o erro mediano foi de 17 s e o máximo de 124 s. Para o modelo A, 21 s e 160 s; para o B, 15 s e 90 s.
  - Uma duração soma dois desses erros: a ordem de grandeza é ±30 s, e chega a 2 min nos piores casos.
- **Tempo no painel.** É 0 nas linhas C: nenhum Alt+Shift+A caiu entre t0 e t1. A espera pelo processamento automático, quando houve dentro da tarefa (SBC-2-A, "Já finalizou o pluguinho", L1660), fica no tempo total.

| Tarefa | Cond. | Resultado | t0 ≈ | t1 ≈ | Total ≈ (s) | Modelos A / B (s) | Faixa (s) | Teto de 300 s |
|---|---|---|---|---|---|---|---|---|
| SOL-1 A | S | S | 0:53:23 | 0:54:32 | 69 | 67 / 73 | 6–135 | abaixo |
| CAPES-1 A | S | F | 0:55:44 | 0:59:12 | 208 | 194 / 223 | 16–271 | abaixo |
| IHC-2 A | S | S | 1:00:55 | 1:03:30 | 155 | 117 / 194 | 15–276 | abaixo |
| CSBC-2 A | S | S | 1:05:41 | 1:07:00 | 79 | 33 / 126 | 4–246 | abaixo |
| SOL-2 A | C | F (alt. S) | 1:16:18 | 1:19:01 | 163 | 151 / 174 | 14–252 | abaixo |
| CAPES-2 A | C | S | 1:25:26 | 1:27:27 | 121 | 81 / 160 | 6–267 | abaixo |
| IHC-1 A | C | F | 1:35:11 | 1:45:50 | 639 | 629 / 648 | 330–855 | **acima** |
| EDU-1 A | C | S | 1:49:01 | 1:50:20 | 79 | 34 / 124 | 7–404 | indeterminado |
| SOL-1 B | C | S | 1:52:30 | 1:53:33 | 63 | 47 / 78 | 2–104 | abaixo |
| CAPES-1 B | C | S | 1:54:23 | 1:55:33 | 70 | 33 / 107 | 1–174 | abaixo |
| IHC-2 B | C | S | 1:57:20 | 1:58:03 | 43 | 16 / 69 | 1–207 | abaixo |
| CSBC-2 B | C | F (alt. P) | 1:59:37 | 2:01:27 | 110 | 70 / 151 | 16–293 | abaixo |
| SOL-2 B | S | S | 2:06:47 | 2:08:34 | 107 | 64 / 149 | 3–250 | abaixo |
| CAPES-2 B | S | S | 2:09:30 | 2:10:12 | 42 | 28 / 58 | 3–341 | indeterminado |
| IHC-1 B | S | F | 2:12:53 | 2:23:35 | 642 | 628 / 655 | 363–733 | **acima** |
| EDU-1 B | S | S | 2:26:06 | 2:26:32 | 26 | 10 / 42 | 0–88 | abaixo |
| JIS-1 A | S | F | 2:28:53 | 2:32:23 | 210 | 110 / 309 | 10–468 | indeterminado |
| EDU-3 A | S | S | 2:38:49 | 2:39:22 | 33 | 20 / 46 | 3–120 | abaixo |
| SBC-1 A | C | F (alt. S) | 2:42:16 | 2:46:11 | 235 | 154 / 316 | 8–580 | indeterminado |
| SBC-2 A | C | F | 2:47:28 | 2:52:54 | 326 | 257 / 396 | 26–568 | indeterminado |
| JIS-1 B | C | F | 2:55:43 | 2:58:21 | 158 | 177 / 139 | 36–280 | abaixo |
| EDU-3 B | C | S | 2:58:32 | 2:59:22 | 50 | 33 / 67 | 2–122 | abaixo |
| SBC-1 B | S | S | 2:59:53 | 3:01:09 | 76 | 61 / 93 | 6–371 | indeterminado |
| SBC-2 B | S | F | 3:01:23 | 3:03:31 | 128 | 119 / 138 | 24–277 | abaixo |

"Abaixo" e "acima" valem para toda a faixa. "Indeterminado" quer dizer que a faixa cruza os 300 s.

A estimativa é fraca onde os modelos A e B divergem em mais de 1 min: IHC-2-A, CSBC-2-A, CAPES-2-A, EDU-1-A, CAPES-1-B, CSBC-2-B, SOL-2-B, JIS-1-A, SBC-1-A e SBC-2-A. Nesses casos, a âncora mais próxima está longe, ou o silêncio entre âncoras pode ter caído fora da tarefa:

- **JIS-1-A:** a instrução foi dita duas vezes (L1528 e L1531), com ≈ 2 min quase calados antes da marca de 02:30.
- **SOL-2-B:** está entre duas âncoras do tipo "colei", que só limitam por baixo.
- **SBC-1-A e SBC-2-A:** a janela de 02:45 a 02:50 tem só 75 palavras.

O que os tempos dizem:

- **O teto não muda nenhum resultado da regra estrita.**
  - Dos 14 sucessos, 11 ficam abaixo de 300 s em toda a faixa. Os outros três (EDU-1-A, CAPES-2-B, SBC-1-B) têm estimativas de 42 a 79 s.
  - IHC-1-A e IHC-1-B passaram do teto com certeza. Já eram F, encerradas pelo facilitador.
- **A leitura alternativa do SBC-1-A depende do vídeo.** O S só vale se o tempo ficar abaixo de 300 s. A estimativa é 235 s, mas o modelo B dá 316 s, e a faixa vai de 8 a 580 s.
- **Duração.** A maioria dos sucessos levou de meio minuto a três minutos.
  - Mediana de todas as execuções: 93 s sem a extensão e 116 s com ela.
  - Médias, puxadas pelos IHC-1: 148 s e 171 s.
- **A ordem pesa mais que a condição.** Nas 8 tarefas do núcleo, a segunda execução de cada tarefa:
  - foi mais rápida em 5, por 53 a 138 s;
  - empatou em 2 (SOL-1 e IHC-1, com diferença de até 6 s);
  - foi mais lenta só no CSBC-2, a tarefa do dano, por 31 s, dentro do erro.

  No SBC-1 e no SBC-2, a variante sem a extensão veio depois e foi 159 e 198 s mais rápida. A estimativa de aprendizagem pelos controles (aba Resumo, L24) dá 84 s, da ordem das próprias diferenças. Com uma avaliadora e esse erro de estimativa, os tempos não sustentam conclusão sobre a extensão. Se entrarem no artigo, que seja como descrição e depois da conferência no vídeo.

## 3. Pontos para relatar no artigo

### 3.1 Método (Seção 6, "Sessions A and B" → Estudo 2)

1. O Estudo 2 avaliou o **modo automático com OpenRouter/`gpt-5-nano`**, não o painel com modelo local (`04-arquitetura.tex:24` já diz que o automático aplica menos correções). O DOM difere do Estudo 1 em pelo menos quatro pontos relevantes para o leitor de tela:
   - botões sem nome numerados pelo índice global da página ("Acionar botão 7–11" em vez de 5–9);
   - links sem nome rotulados pela heurística de contexto (cabeçalho anterior, domínio), em vez de "Abrir link N";
   - ícones mantêm `aria-hidden`, então o D-6 não ocorre;
   - alts de outro modelo e outro provedor, e as imagens foram enviadas a terceiros.

   O automático também não aplica as demais correções de `panel-fixes.js`: troca do texto de links e botões vazios (que apaga logotipo ou ícone), remoção de `title` e de alt redundantes, rótulos de campos e CSS de reserva.
2. Por que a nuvem: o caminho local não conectou no Windows (seção 4, item M-6). Ajustes no texto do artigo:
   - qualificar "all model inference … ran locally" em `10-12-discussao.tex:7` e `:43`;
   - em `06-metodo.tex:52`, trocar "in the study" por "in Study 1";
   - `05-iteracao.tex:49` já está restrito ao Estudo 1.
3. Formato real:
   - uma reunião remota de ≈ 3h28;
   - 12 tarefas e 24 execuções, com variantes A/B contrabalançadas, em 7 sites ao vivo (SOL, CAPES, IHC 2026, CSBC 2026, EduComp 2026, SBC, JIS);
   - perfil único;
   - sem cronometragem ao vivo (t0 e t1 estimados depois, seção 2.1), sem SEQ e sem log do NVDA;
   - resultados codificados a partir da transcrição automática, com a codificação do vídeo pendente.
4. A v1.0.0 não entra no Estudo 2 (protocolo §1). O texto que previa "Session A = baseline × v1.0.0" sai.

### 3.2 Resultados (Seção 9)

1. **Desfechos por tarefa** (tabela da seção 2): igualdade em 10 de 12 tarefas na leitura alternativa, com um dano atribuível à extensão. Relatar as duas leituras de codificação.
2. **Barreiras que persistiram com e sem a extensão** (são do site):
   - **IHC 2026:** listas de centenas de trabalhos sem cabeçalhos por trabalho, alguns títulos como link e outros como texto, marcador lido como "bolinha", sem busca na página. "Chegam uns 400 artigos aí no meio dessa página" (L1442); "se torna uma navegação cansativa" (L1453); "ia demorar uns 20 minutos ou mais" (L1126). A observadora, que enxerga, também não achou o trabalho (L1132).
   - **SOL, anais:** a trilha só existe como título de seção, sem a palavra "trilha", e os números de página aparecem sem rótulo ("um número 3857, que não sei o que é", L0908).
   - **IHC, programação:** horário e sessão associados só pela posição ("escrito não tem", L0728).
   - **sbc.org.br:** megamenu achatado em lista de links, sem hierarquia ("aparecem todos como link, não como menu", L1676–L1678; "Mesma lógica" sem a extensão, L1781).
   - **JIS/OJS:** campo de busca "somente leitura, em branco", busca avançada que "não pode pesquisar com leitor de tela" e menu que "não deixa interagir" (L1556–L1560, L1602, L1727–L1728). "Acho que essa é a pior página até agora de acessibilidade" (L1591–L1593).
   - **CAPES, suporte regional:** botões das regiões sem nome ("os dois errados … o ideal seria … região submenu", L1385–L1387).
   - **Links de compartilhamento:** lidos numa linha só, com e sem a extensão (L1006–L1023, L1378–L1380). Depende da opção de layout de tela do NVDA, que não foi registrada.
3. **Triangulação com o Estudo 1**: menos violações não se traduziram em tarefas mais fáceis. Números da sessão `20261024-203955404-d8a9` (`eval/results/runs.csv`): total de violações do axe-core e do IBM, baseline → v1.1.0 (painel, `qwen3:8b`, snapshots):

   | Página | axe-core | IBM | Na sessão |
   |---|---|---|---|
   | Lista A–Z da CAPES | 172 → 40 | 290 → 258 | "ficou o mesmo" (L1256) |
   | Página inicial do JIS | 146 → 76 | 79 → 6 | "a pior página até agora" (L1591–L1593) |
   | Página inicial do CSBC 2026 | 34 → 19 | 33 → 16 | pior com a extensão: "pelo que tá escrito na página, não tem como" (L1302) |
   | Página inicial da SBC | 36 → 29 | 53 → 33 | menus iguais: "Mesma lógica" (L1781) |
   | Página inicial do EduComp | 29 → 2 | 29 → 1 | sem comentário; EDU-1 S nas duas condições |

   Ressalva: o Estudo 2 usou o modo automático ao vivo, e o DOM não é o mesmo.
4. **O dano previsto se confirmou.** No CSBC 2026, o link do logotipo de cada patrocinador recebeu como `aria-label` o cabeçalho da categoria ("OURO", "Diamante" ×2). O endereço, que o NVDA anunciava sem a extensão, desapareceu (L1295–L1331). Marlon: acrescentar o ARIA "não faz sentido se ele não disser … o que a imagem representa" (L1329–L1330).
   - **Origem:** a heurística contextual do content script (`getLinkPurposeContext` → `getPrecedingHeadingText`), não o rótulo de último recurso do painel. Não é o D-7 como a tabela de defeitos o define; é candidato a defeito novo (M-3).
   - **Interrupção:** ela propôs seguir o link para descobrir a empresa (L1301), e a tarefa foi encerrada antes.
5. **Ganhos percebidos**, poucos e estruturais:
   - **Tabela de anuidades da SBC.** Depois de a Franciele identificar o site (L1845–L1847), a avaliadora disse que, com a extensão, o NVDA "já falava… a linha um, coluna um, e falava o que tava escrito" (L1863); sem ela, "falava o valor sozinho e aí tinha que contar" (L1864). A regra que transforma a primeira linha em `th scope="col"` (`content.js:675–693`, o mesmo mecanismo da D-11) explica o efeito. Que o cabeçalho da coluna passou a ser lido junto do valor é inferência do código, a conferir no vídeo.
   - **Botões numerados no mapa da CAPES.** Mesmo genéricos ("Acionar botão 7…11"), os números distintos deixaram a avaliadora saber "se eu não estava sempre no mesmo botão" (L1917–L1921). A Franciele ligou isso à carga de memória (L1931–L1935). Relatar como percepção, com quatro ressalvas:
     - quem formulou o ganho foi a Franciele ("dava um número diferente para cada botão", L1910–L1913), e a avaliadora concordou (L1914);
     - durante a própria tarefa com a extensão, ela criticou a numeração: "tá numerando os botões e não tá dizendo o que que é cada um" (L1064–L1066);
     - na variante sem a extensão, disse que as duas formas estavam "erradas" (L1385);
     - a lembrança de que "caía direto dentro da lista" e de que, sem a extensão, só ouvia "botão" contradiz o que ela disse durante a variante S ("menu recolhido, submenu", L1373–L1375). O código não altera foco nem `aria-expanded` (M-2).
6. **Alt com o texto de raciocínio do modelo em uso real.** A imagem do EduComp foi lida como "You need to create a con[cise alt] text in português…" (L1213–L1215). A avaliadora entendeu que a extensão "identificou que precisava de um atributo alt" (L1868–L1870).
   - É compatível com o mecanismo do D-8: `background.js:1474–1476` usa `message.reasoning` quando `content` vem vazio, e o `gpt-5-nano` é um modelo de raciocínio com 256 tokens para o alt.
   - **A confirmar nos logs do OpenRouter.** Se confirmado, o D-8 não é exclusivo do caminho local, como a tabela de defeitos diz hoje.
7. **A extensão avaliada com leitor de tela** (Seção 9.4; `04-arquitetura.tex:64` e `05-iteracao.tex:27/53` falam em "Session B"):
   - **Instalação:** a avaliadora carregou a extensão descompactada com o NVDA, seguindo instruções verbais do facilitador (L0085–L0093), e escolheu a pasta sozinha (L0094–L0100). O caminho local falhou: o pull do modelo levou quase meia hora (L0395–L0397), e o erro do "Testar conexão" não foi anunciado ("Esse erro ali não leu", L0239).
   - **Atalhos:** Alt+Shift+A não vinha atribuído depois da instalação e foi definido à mão em `chrome://extensions/shortcuts` (L0109–L0166). A avaliadora, de imediato: "Beleza, já foi encontrado um bug" (L0136).
   - **Retorno ao usuário:**
     - ligar o automático "não avisou" (L0842–L0845);
     - usar o atalho do painel também não ("Não recebi feedback que fechou", L1194–L1196);
     - o fim da aplicação automática não é anunciado: "Aí eu não tenho como saber quando isso aqui terminou" (L0450–L0457); "E aí eu não sei se ele já terminou" (L1172). Só o início ("aplicando otimizações automaticamente") foi ouvido, com o painel aberto (L1169–L1171).
   - **Painel:** operável por teclado, com switch, botões e resumo legíveis (L0167–L0183, L0498–L0501). O foco se perde depois de Analisar e de Aplicar (L0484–L0490, L0508–L0517), e a página pareceu "em branco" depois de aplicar. Alt+Shift+A não fecha o painel: reinicia a análise e pode recarregar a página (M-12).
   - **Configurações:** emojis lidos ("disquete Salvar", "tubo de ensaio Testar conexão", L0223–L0227), o que contradiz "most decorative glyphs are hidden" (`04-arquitetura.tex:64`).
8. **Tempos, só descritivos** (seção 2.1, depois de conferidos no vídeo). A maioria dos sucessos levou de meio minuto a três minutos. As duas IHC-1 passaram de 10 min. A diferença entre as condições acompanha a ordem de execução, não a extensão: não relatar como efeito.

### 3.3 Discussão

- **"Fewer errors is not more accessibility"** ganha evidência humana: a triangulação do item 3.2.3 e a avaliação global ("uns 20%"; Franciele: "esperava mais … não resolveu muita coisa", L1801–L1803).
- **Limites estruturais.** Parte das barreiras exige informação que não está no DOM ou que depende do contexto da página: "trilha", "páginas 18 a 37", qual empresa está no logotipo. Marlon: "É difícil ele fazer o que não tá no site" (L0931). Isso justifica, como trabalho futuro, usar o contexto da página com o modelo (L0936–L0949).
- **Rótulos genéricos têm dois lados.** Não dizem a função ("ele não identificou para que que era o botão", L0555), mas podem distinguir elementos e reduzir a carga de memória (L1917–L1935, com as ressalvas do item 3.2.5). Isso nuança `07-09-resultados.tex:82` ("None of them gives a screen-reader user any information").
- **Um rótulo errado é pior que nenhum** quando substitui uma informação que o leitor de tela já dava (CSBC: endereço → "ouro"). É o argumento de "não causar dano".
- **Estratégia da usuária.** A transcrição não registra uso da busca do NVDA (NVDA+Ctrl+F), que era o caminho previsto para IHC-1. A avaliadora procurou uma busca do site ("Deveria ter um campo de busca", L1100), e a Franciele comentou "como faz falta … um buscar na página" (L1425, L1437). Conferir no vídeo; se confirmado, relatar como fator nas falhas do IHC-1.

### 3.4 Ameaças à validade (novas)

1. **Condição C diferente da medida no Estudo 1 e do padrão lançado:** nuvem, `gpt-5-nano` com visão, modo automático. O padrão "local-first" não foi testado com a usuária. No EDU-1-A, dois Alt+Shift+A podem ter recarregado a página e desfeito o automático (M-12): o estado do DOM nessa execução é incerto.
2. **Sem medidas de desempenho ao vivo.** Os tempos são estimados pela transcrição e pelo chat (seção 2.1): erro típico de 20 s em cada ponto, e a faixa de 6 execuções cruza o teto. Também não há SEQ nem log do NVDA. Com N = 1, a análise é qualitativa e descritiva. A estimativa de aprendizagem pelos controles (84 s) é só indicativa, mas é da ordem das diferenças entre condições.
3. **Ajuda e intervenções durante as tarefas**, que mudam 3 resultados conforme a leitura (SOL-2-A, SBC-1-A, CSBC-2-B), e uma revelação do valor esperado (CAPES-1-A). Pela participação ativa, a Franciele não serve de segunda codificadora independente.
4. **Perguntas indutivas na entrevista.** A Franciele identificou o site da tabela e formulou os ganhos, e a avaliadora concordou (L1847, L1862, L1897, L1910–L1913). Marlon atribuiu a ela um comentário que ela não tinha feito (L1884–L1887). Tudo isso depois de os observadores darem a própria avaliação (L1793–L1794, L1801–L1803).
5. **Relação de orientação.** A avaliadora é coautora e orientanda, e o estudo alimenta a qualificação dela (L1979–L1985): risco de desejabilidade social.
6. **Sessão longa e noturna** (≈ 3h28), com 50 min de depuração e sem pausa. A fadiga se confunde com a ordem, sobretudo no complementar. Houve exposição prévia ao sbc.org.br com a extensão (ensaio) e à página do JIS com a extensão (teste depois do JIS-1-A, antes do JIS-1-B).
7. **Atenção do facilitador.** Várias falas domésticas são do próprio facilitador, dirigidas à família no meio das tarefas (CAPES-1-A, L0672–L0682, entremeadas com a ajuda de L0671; IHC-2-A, L0713–L0714).
8. **Validade das tarefas.**
   - IHC-1 seguiu uma rota diferente da prevista, e o próprio facilitador a achou difícil (L1099, L1485).
   - JIS-1 teve confusão entre 2025 e 2026 (L1549, L1716–L1718), e a variante B foi pulada (L1712–L1713, L1746).
   - O critério de CAPES-1 não previa o e-ISSN.
   - As falhas nas duas condições reduzem a sensibilidade.
9. **O NVDA só existe por paráfrase:** a transcrição tem só vozes, com erros de reconhecimento. Verificar se a gravação captou o áudio do sistema.
10. **Sites ao vivo em 28/10, contra snapshots de 24/10 no Estudo 1.** Coincidem as páginas iniciais da Lista A–Z da CAPES, do CSBC, do EduComp, da SBC e do JIS.
11. **Análise assistida por IA** (reconhecimento de fala e codificação por agentes). Mitigação: conferência humana no vídeo.

### 3.5 Ética e segurança

- **Consentimento.** O consentimento da gravação não aparece na transcrição. A Franciele sugeriu mostrar o vídeo ao Alan (L1631–L1635), o que exige consentimento específico. Há vozes domésticas no áudio: editá-las se o vídeo for arquivado ou compartilhado.
- **Imagens enviadas a terceiros.** Imagens das páginas foram enviadas ao OpenRouter/OpenAI. Registrar no artigo, na declaração de uso de IA, e na ética.
- **Chave de API exposta.** A chave do OpenRouter do facilitador foi colada no chat de uma reunião gravada (00:35:30; L0400–L0412) e ficou salva na máquina da avaliadora. **Revogada em 29/10/2026.** O texto continua no chat da reunião e na transcrição do chat (`.sbv`): apagar a linha antes de arquivar ou compartilhar esses arquivos.

## 4. Melhorias da extensão (trabalhos futuros)

Pela D18, nada é corrigido antes da submissão: estes itens alimentam a seção de trabalhos futuros e o backlog.

- "D-x/C-x" remete a `docs/analise/estudo1-defeitos.md`.
- Os itens "novo" são candidatos a entrar na tabela de defeitos (D-13 em diante) e no backlog (C22 em diante).
- As evidências de código foram conferidas em 29/10/2026 no commit `296e257`.

### Rótulos e nomes acessíveis

| # | Problema observado | Causa no código | Relação | Melhoria |
|---|---|---|---|---|
| M-1 | "Acionar botão N" não diz a função (lupa da SBC, regiões da CAPES; L0555, L0979–L0981, L1640, L1064–L1066). A numeração segue o índice global da página. | `content.js:1236–1248` (nos dois modos) e `panel-fixes.js:215–238` (painel). `isEmptyButton` (`wcag-evaluator.js:1032–1046`) ignora `aria-label`, `aria-labelledby`, `title` e `<title>` de SVG. Com isso, sobrescreve nomes dados por `aria-label` (CAPES: "Abrir Acesso Rápido", "Menu") e por `<title>` de SVG; no painel, também por `title`. | D-7 / C16; a sobrescrita de nome existente é nova | Calcular o nome acessível antes e nunca sobrescrever. Tirar o nome do conteúdo controlado (`aria-controls`; `.dropdown-menu[aria-labelledby]` → "Região Centro-Oeste") ou do ícone (`fa-search`, `svg#search` → "Pesquisar"). Se ainda for genérico, numerar dentro do grupo ("Região 3 de 5"). Preservar o ícone. |
| M-2 | Botões de *dropdown* sem nome continuam sem o nome da região (L1385–L1387) | Nenhuma regra para `aria-haspopup`/`aria-expanded`; a extensão não move foco | novo | Regra para *disclosure*: rotular o botão pelo primeiro título ou parágrafo do menu que ele controla. |
| M-3 | Link de logotipo rotulado pelo cabeçalho anterior ("OURO") esconde o domínio que o NVDA já lia (CSBC-2-B, L1295–L1331) | `getLinkPurposeContext` (`content.js:1149–1201`) consulta `getPrecedingHeadingText` (1162) **antes** do hostname (1186–1189). Imagens com `alt=""` não vão ao modelo (`content.js:244–250`). | novo (D-13 candidato), ligado à C16. Não é o D-7 como a tabela o define (rótulo genérico do painel), e contradiz o "cabeçalho próximo" previsto na C16. | Para link só com imagem que aponta para outro domínio, preferir o domínio ou o nome do arquivo ("qualcomm.com"), ou combinar ("Ouro: qualcomm.com"). Não dar o mesmo rótulo a vários links irmãos. Mandar logotipos ao modelo com visão. CSBC 2026 como caso de teste. |
| M-4 | "Algumas vezes ele colocava a descrição do link, outras não" (L1957–L1960; "link saiba mais" no EDU-1-A, L1221–L1224) | No automático, só links sem nome ou com texto da lista de `isGenericLinkText` recebem rótulo. `getLinkPurposeContext` devolve fontes diferentes conforme a página (title, cabeçalho do contêiner, cabeçalho anterior, texto do pai, domínio…). Quando o contexto é genérico ou vazio, o link fica como estava (`content.js:1119–1147`). | C16 | Heurística única e previsível; tratar "Saiba mais" e afins pelo título do cartão; contar no relatório os links que ficaram genéricos. A divergência painel × automático agrava (M-11). |

### Modelo e texto alternativo

| # | Problema observado | Causa no código | Relação | Melhoria |
|---|---|---|---|---|
| M-5 | Alt com texto de raciocínio em inglês ("You need to create a con[cise alt] text in português…", L1213–L1215), entendido pela usuária como aviso de alt ausente (L1868–L1870) | Provável: `background.js:1474–1476` usa `message.reasoning` como alt quando `content` vem vazio. Com `gpt-5-nano` e 256 tokens (`ai-config.js:20`), o raciocínio deve consumir o orçamento. `normalizeAltText` (1760–1775) só corta o tamanho. A confirmar nos logs do OpenRouter. | D-8 / C17; amplia o D-8 ao OpenRouter se confirmado | Nunca usar `reasoning` como alt. Pedir pouco raciocínio ao OpenRouter ou aumentar `max_tokens`. Validar idioma, tamanho e marcas de raciocínio ("You need", "the user wants", inglês em página em português) e cair na heurística se falhar. Contar no relatório. |
| M-6 | Caminho local não conecta no Windows; o erro não orienta (L0234–L0289) | Causa provável: o Ollama recusa a origem `chrome-extension://` sem `OLLAMA_ORIGINS`; a navegação direta a `localhost:11434` passa porque não leva `Origin`. Na sessão, os comandos colados no chat (00:22:26–00:22:58) foram `taskkill /f /im ollama.exe`, `setx OLLAMA_ORIGINS "chrome-extension://*"` e `start ollama app`, e o teste falhou de novo (L0289). Provavelmente o servidor que respondeu não tinha a variável, por três motivos possíveis: o `setx` vale para processos novos, não para o terminal em que roda; `start ollama app` sem aspas chama `ollama.exe` com o argumento `app`, e não o aplicativo da bandeja; e o `taskkill` por nome não fecha o `ollama app.exe`, que pode ter reaberto o servidor com o ambiente antigo. O status do erro não foi registrado, e o teste não o diagnostica (`background.js:1785–1797`). A instrução existe em README, INSTALLATION e `options.html:355`. | novo | `testConnection` deve detectar o 403 e mostrar o roteiro exato no Windows: definir a variável (`setx OLLAMA_ORIGINS "chrome-extension://*"` ou Variáveis de Ambiente), sair do Ollama pela bandeja e reabri-lo pelo menu Iniciar. Seção no TROUBLESHOOTING. Testar na máquina da usuária antes. |
| M-7 | Falha do modelo é silenciosa: a página muda (correções determinísticas) e as imagens ficam com alt heurístico, sem aviso (Franciele, L0763, L0806–L0812) | `background.js:2183–2200` e 799 descartam os erros por imagem | novo (próximo de D-9) | Avisar no painel e na página: "correções aplicadas sem IA". |

### Retorno ao usuário e modo automático

| # | Problema observado | Causa no código | Relação | Melhoria |
|---|---|---|---|---|
| M-8 | Ligar ou desligar o automático (Alt+Shift+O) não dá retorno falado (L0842–L0847) | `toggleAutoOptimizeSetting` (`background.js:966–972`) só muda o ícone (`updateActionIcon`, 948–964) | novo (pedido do facilitador, L0846–L0847) | Anunciar na página, por região `aria-live` do content script ou `chrome.tts`: "Accessify: aplicação automática ligada/desligada". |
| M-9 | Fim da aplicação automática não é anunciado (L0450–L0457, L1172) | Ao concluir, o job passa a `completed` e o painel chama `showResults` (`popup.js:203–211, 594–597`). Esconde `#progress-section` sem escrever a mensagem final (`background.js:1095`) e mostra `#results-summary` já preenchida. Com o painel fechado, nada é anunciado. | novo | Anunciar uma vez, na página: "Accessify aplicou N melhorias". |
| M-10 | A opção "Mostrar notificações" não faz nada | `showNotifications` é gravada (`options.js:199–202`) e lida só para repor a própria caixa (`options.js:67, 92`); nenhum outro script a usa | novo | Implementar ou remover. |
| M-11 | O automático aplica um conjunto de correções diferente do painel | `buildOptimizationsForApplication` (`background.js:885–895`) não usa `AccessifyPanelFixes` (`panel-fixes.js:23–238`) | achado lateral do protocolo §9, confirmado | Um único montador de correções para os dois modos. |
| M-12 | Alt+Shift+A com o automático ligado desfaz ou impede a aplicação: a página fica sem as correções. Evidência a conferir: "a página tá igual ainda" (L0462, ambígua, porque o run podia não ter terminado) e EDU-1-A (L1188–L1199). | `startAnalysisJob` recarrega a página se ela já foi tratada (`background.js:700–722`) ou substitui o run em curso (514–517). Nos dois casos, o automático não volta a rodar (1004–1006). | novo | Com o automático ligado e a página já tratada, o atalho só abre o painel (ou alterna abrir e fechar) e leva o foco ao último resultado. Nunca recarregar sem avisar. |
| M-13 | Página aberta em aba de segundo plano não é otimizada (dúvida da avaliadora, L0580) | `handleTabCompleted` ignora abas inativas (`background.js:992–994`) | novo | Processar ao ativar a aba (`tabs.onActivated`). |
| M-14 | Atalho padrão não atribuído na instalação, sem aviso (L0109–L0166) | O Chrome não atribui um `suggested_key` em conflito; nada no código verifica | novo | Em `onInstalled`, chamar `chrome.commands.getAll()`; se um atalho vier vazio, avisar de forma acessível com o caminho `chrome://extensions/shortcuts`. Documentar no README. |

### Painel e configurações

| # | Problema observado | Causa no código | Relação | Melhoria |
|---|---|---|---|---|
| M-15 | Foco se perde depois de Analisar e de Aplicar; a página pareceu "em branco" (L0484–L0490, L0508–L0517). A página "em branco" pode vir também do skip link (M-20). | `showProgressSection` esconde a seção com o botão focado (`popup.js:565–573`); depois de aplicar, `results-section` é escondida (`popup.js:797`); nenhum `.focus()` | novo | Levar o foco ao título de cada etapa ("Processando", "Análise completa"). Depois de aplicar, anunciar "N alterações aplicadas; F6 volta à página". |
| M-16 | Bipes da barra de progresso durante a análise (L0472, L0477) | O painel regrava `aria-valuenow` e reescreve o resumo a cada 1 s numa região `role=status` (`popup.js:149–151, 205–211, 488–492`) | novo | Anunciar uma vez por etapa (`aria-valuetext`), sem reescrever a região viva. |
| M-17 | Resumo "1145 problemas, 357 críticos, 788 avisos" grande demais para orientar. "Otimizações recomendadas" é sempre 0 pelo código, mas a transcrição diz "duas" (L0501): conferir no vídeo. | Contagem por ocorrência (`content.js:99–108`). O contador lê `optimizations.optimizations.length` (`popup.js:617`), campo que nem a IA nem o painel preenchem (`background.js:1494, 2026–2052`). A IA de recomendações nunca é chamada: todos os tipos estão em `llmSkipIssueTypes` (`ai-config.js:33–87`). | novo | Resumir por tipo de problema; remover ou corrigir o contador. |
| M-18 | Emojis lidos nos botões ("disquete", "tubo de ensaio", L0223–L0227) | `options.html:404–405` e `options.js:145, 166, 173` (o texto do botão é regravado: "⟳ Testando…", "🧪 Testar Conexão"); ✓ e ✗ nas mensagens (`options.js:124–171`) | novo (pedido em L0232–L0233) | Remover os emojis ou envolvê-los em `aria-hidden`, no HTML e no JS. |
| M-19 | Erro do "Testar conexão" não anunciado (L0239) | `#status-message` tem `role=status`, mas fica em `display:none` até receber o texto e some depois de 5 s (`options.html:247–253`; `options.js:204–212`) | novo | Manter a região sempre renderizada; `role="alert"` para erros; não esconder sozinha. |

### Estrutura da página e uso do contexto

| # | Problema observado | Causa no código | Relação | Melhoria |
|---|---|---|---|---|
| M-20 | No ensaio em sbc.org.br, "Pular para o conteúdo principal" levou ao topo, às redes sociais (L0506, L0519–L0526) | `content.js:717–735` usa o primeiro elemento que casa com seletores amplos; em sbc.org.br é `div#page-top`, vazio (DOM v1.1.0 do Estudo 1) | novo (achado lateral do protocolo §9, confirmado) | Só inserir quando houver alvo com conteúdo (`main`, primeiro `h1`); senão, não inserir. |
| M-21 | Menus aninhados lidos como lista plana de links (SBC) | Sem regra para menus | novo (barreira do site) | Regra futura: transformar submenus de `nav` em *disclosure* (botão com `aria-expanded`) ou dar títulos por nível ("Organizar melhor os menus", L1971–L1972). |
| M-22 | Busca "somente leitura" e link de busca com `aria-hidden` (JIS/OJS) | Sem regra para campo `readonly` com `opacity:0`. No automático, `fixAriaHiddenContent` (`content.js:1439–1464`) não revela o link de busca, ao contrário do painel. | novo (barreira do site); a divergência entre os modos se liga à C15 | Revelar e rotular o link de busca ("Busca avançada"); tratar o campo `readonly` invisível. |
| M-23 | Informação implícita na página: trilha sem a palavra "trilha", números de página sem rótulo, listas de trabalhos sem cabeçalhos, marcador lido como "bolinha" | As regras não usam o contexto da página | novo | Usar o contexto da página com o modelo: "Trilha de Relatos de Experiência", "páginas 18 a 37" (L0936–L0949). Promover títulos de trabalho em listas longas a itens navegáveis. Ocultar marcadores gráficos. |
| M-24 | Tabela sem cabeçalho: o ganho percebido | `content.js:675–693` (1ª linha → `th scope="col"`) | D-11 / C21 (aqui positivo) | Ao implementar a C21, manter a regra para tabelas de dados (≥ 2×2, 1ª linha com texto curto); considerar `th scope="row"` na 1ª coluna. |

### Processo de avaliação (para a próxima rodada)

- **Testes automatizados com o NVDA** rodando (L1071) e **repetição do Estudo 2** com a v1.2 (L1067, L1979).
- Na próxima sessão:
  - seguir o protocolo de cronometragem e de SEQ (sem cronômetro, o chat e as marcas da transcrição só dão estimativas, seção 2.1);
  - colar no chat só URLs e títulos, conferidos antes; nunca chaves;
  - ligar o log do NVDA, que resolve as divergências de memória (CAPES-1-B, CAPES-2);
  - testar a conexão do modelo na máquina da avaliadora antes;
  - usar o painel ou o automático de forma declarada;
  - não ajudar nem fazer retestes no meio do bloco.

## 5. Pendências antes de escrever

- [x] **Revogar a chave do OpenRouter** exposta no chat (L0400): feito em 29/10/2026.
- [ ] **Apagar a chave** da transcrição do chat (`.sbv`) e de qualquer cópia do chat antes de arquivar ou compartilhar.
- [ ] **Versões:** NVDA (L1518) e suas configurações (voz, velocidade, verbosidade, layout de tela, bipes de progresso), Windows e Chrome.
- [ ] **Do vídeo, tempos e áudio:**
  - conferir se o vídeo tem o mesmo zero da transcrição e do chat (uma mensagem do chat basta);
  - t0 e t1 de cada execução: procurar ±2 min em torno das estimativas (colunas N, O e AH; seção 2.1) e substituir N e O pelos tempos medidos;
  - SBC-1-A abaixo de 300 s? Decide a leitura alternativa (S ou F);
  - falas literais do NVDA nas barreiras;
  - se o áudio do sistema foi gravado.
- [ ] **Do vídeo, codificações a conferir:**
  - CAPES-1-A: ela ouviu 0104-6500 antes da fala do facilitador?
  - SOL-1-B: Castro ou Valença?
  - CSBC-2-B: teria achado a empresa seguindo o link?
  - EDU-1-A: a página recarregou depois dos Alt+Shift+A?
  - a contradição de CAPES-2;
  - o valor de "otimizações recomendadas" no ensaio;
  - "Já finalizou o pluguinho" (L1660): pergunta ou afirmação?
  - o uso da busca do NVDA no IHC-1.
- [ ] **Codificação humana** a partir do vídeo, por quem não estava na sessão, e conciliação com esta.
- [ ] **Logs do OpenRouter de 28/10, 19:39–23:07:** chamadas, custo e as saídas do EduComp. Comprovam ou não o M-5/D-8 (`content` vazio e `reasoning` preenchido).
- [ ] **Evidência de DOM** com o mesmo build e a mesma configuração (automático + `gpt-5-nano`), antes que os sites mudem: CSBC 2026 (link "OURO"), CAPES suporte regional (botões), sbc.org.br (lupa, tabela de anuidades, skip link), EduComp (alt) e JIS (busca).
- [ ] **Com a avaliadora:**
  - familiaridade prévia com cada site;
  - dados de posicionalidade;
  - impacto (1–3) de cada barreira, se o *Barrier Walkthrough* ficar;
  - o que ela aceita publicar;
  - SEQ retrospectiva, se for usar, registrada como tal.
- [ ] **Consentimento:** gravação, identificação e o pedido de compartilhamento com o Alan.
- [ ] **Artigo, Estudo 2 no lugar das Sessões A e B:**
  - trocar "Sessions A/B" por Estudo 2 em `06-metodo.tex:70–72`, `05-iteracao.tex:3, 27, 53`, `04-arquitetura.tex:64` e `GLOSSARIO_PT.md:46–47`;
  - substituir os `\pending` de Sessions A/B em `main.tex:68`, `01-introducao.tex:26`, `07-09-resultados.tex:219` e `10-12-discussao.tex:29`.
- [ ] **Artigo, frases que a sessão contradiz:**
  - qualificar "all inference ran locally" em `10-12-discussao.tex:7, 43` e o escopo de `06-metodo.tex:52`;
  - qualificar `04-arquitetura.tex:24` ("the panel announces progress and completion"): o fim da aplicação automática não é anunciado (M-9);
  - nuançar `07-09-resultados.tex:82`.
- [ ] **Artigo, defeitos:**
  - D-8 "(local)" → qualquer provedor, em `07-09-resultados.tex:163, 209` e `estudo1-defeitos.md:14`, se os logs confirmarem;
  - decidir se o "OURO" do CSBC entra como D-13 ou amplia a definição do D-7 (`estudo1-defeitos.md:13`, `07-09-resultados.tex:162`).
- [ ] **Artigo, declaração de uso de IA** (`10-12-discussao.tex:39`): incluir o OpenRouter, a transcrição automática do Meet e a codificação por agentes.
