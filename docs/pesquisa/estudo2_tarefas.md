# Estudo 2: tarefas cronometradas com leitor de tela

Versão de 28/10/2026. Define as tarefas que a coautora cega faz com e sem o Accessify, as respostas esperadas, a ordem da sessão, as medidas e o tempo necessário. Instrumentos:

- formulário de registro: `docs/pesquisa/estudo2_formulario.xlsx` (abas Instruções, Sessão, Roteiro, Resumo e Tarefas), gerado por `eval/tools/estudo2_gerar.py` (que também gera os cartões da seção 4 e faz trocas por reservas com `--trocar`);
- conferência ao vivo das respostas esperadas: `python3 -I eval/tools/estudo2_conferir.py`, na véspera e no dia.

## 1. O que é e onde entra no artigo

A avaliação especialista do artigo (Seção 6, "Sessões A e B") é um *Barrier Walkthrough*. Este protocolo acrescenta a ela uma medida de desempenho: a avaliadora faz tarefas simples em sites reais, ao vivo, sem a extensão e com a v1.1.0. De cada execução registramos:

- o tempo;
- o resultado (sucesso, parcial ou falha);
- a facilidade percebida (SEQ, de 1 a 7);
- a estratégia de navegação;
- as barreiras, com a fala literal do NVDA.

A sessão é gravada, e tempos e resultados saem do vídeo e do log do NVDA.

Com uma única avaliadora, os números são **descritivos**: relatamos cada tarefa e as contagens por condição, sem teste de hipótese. As barreiras observadas alimentam o *Barrier Walkthrough* (impacto × persistência).

A v1.0.0 fica fora das tarefas cronometradas. Ao vivo, ela só fala com o OpenRouter, porque o adaptador para o Ollama existe só no harness. No Estudo 1, ela falhou ou estourou o prazo em 11 páginas (D-1, D-2 e D-3), entre elas a página inicial do Portal de Periódicos (D-1). Por isso o texto pendente da Seção 6 do artigo, que previa a Sessão A como baseline × v1.0.0, precisa mudar.

## 2. Condições

| | S — sem extensão | C — com extensão |
|---|---|---|
| Navegador | Chrome, perfil S, sem o Accessify | Chrome, perfil C, com o build `v1.1.0-jis_submission` |
| Modelo | — | Ollama local, `qwen3:8b`, raciocínio original (o padrão da v1.1.0, como na condição `v1.1.0` do Estudo 1), numa máquina com GPU |
| Acionamento | — | painel lateral em cada página nova do site da tarefa, antes de procurar a informação (sequência abaixo) |

Sequência de acionamento na condição C:

1. Alt+Shift+A abre o painel lateral do Chrome e inicia a análise.
2. A avaliadora ouve o resultado (o painel anuncia por `aria-live`).
3. Ativa "Aplicar Otimizações" e ouve a confirmação.
4. Volta à página.

O painel é um *side panel* do Chrome (`manifest.json`, `side_panel`). Ele não fecha com Esc e fica aberto ao lado da página. A tecla que leva o foco ao painel e de volta (provavelmente F6) é fixada no piloto (seção 8).

Comum às duas condições:

- mesma versão do Chrome e do NVDA;
- voz e velocidade habituais da avaliadora;
- janela maximizada (≥ 1280 px) e zoom de 100%;
- banners de cookies fechados antes de cronometrar.

Sites externos ao da tarefa (por exemplo, o site de um patrocinador) não recebem o Accessify.

**Por que o painel, e não o modo automático.** Os dois caminhos não aplicam as mesmas correções:

- o painel, e o gancho que o harness usou no Estudo 1, somam às correções determinísticas os rótulos de último recurso de `panel-fixes.js`;
- o modo automático aplica só as correções determinísticas e os alts do modelo (`background.js:1040`, `buildOptimizationsForApplication`).

Com o painel, a avaliadora encontra o mesmo DOM que o Estudo 1 mediu e ouve o anúncio do fim da análise. O modo automático muda a página sem aviso. O painel também precisa ser avaliado com leitor de tela (a Seção 9.4 do artigo prevê isso). O custo é o tempo de operá-lo, que o formulário separa em **tempo total** e **tempo líquido** (sem o painel).

Se a equipe preferir o modo automático, mais próximo do uso diário, as estimativas com extensão caem cerca de 17 s por página. Nesse caso, o artigo precisa dizer que o DOM avaliado no Estudo 2 difere do Estudo 1.

Não acionar a análise duas vezes na mesma página. A segunda análise recarrega a página para partir do estado original (`background.js:703–715`), e a avaliadora perde a posição.

## 3. Delineamento: variantes A/B e contrabalanceamento

Cada tarefa tem duas variantes equivalentes: mesmo ponto de partida, mesmo caminho e profundidade, mesmo tipo de resposta, alvo diferente. A avaliadora faz a variante A numa condição e a B na outra, de modo que nunca repete uma resposta que já conhece.

As tarefas formam dois grupos. Cada grupo tem 1 controle, 1 tarefa com efeito previsto e 2 tarefas de efeito baixo. O grupo G1 começa sem a extensão, e o G2 começa com ela. A primeira exposição de cada tarefa é sempre a variante A.

| Bloco | Grupo | Condição | Variante | Tarefas do núcleo |
|---|---|---|---|---|
| 1a | G1 | S | A | SOL-1, CAPES-1, IHC-2, CSBC-2 |
| P0 + 1b | G2 | C | A | (treino do painel) SOL-2, CAPES-2, IHC-1, EDU-1 |
| pausa | | | | |
| 2a | G1 | C | B | SOL-1, CAPES-1, IHC-2, CSBC-2 |
| 2b | G2 | S | B | SOL-2, CAPES-2, IHC-1, EDU-1 |

Há duas trocas de perfil na sessão 1: de 1a para P0 e de 2a para 2b. O treino do painel (P0) fica logo antes do primeiro bloco com a extensão. O conjunto complementar segue o mesmo esquema em outra sessão (G1 = JIS-1 e EDU-3; G2 = SBC-1 e SBC-2), também com duas trocas.

**O que o contrabalanceamento resolve e o que não resolve.** A ordem fica balanceada só no agregado. Em cada tarefa, a condição está confundida com a ordem e com a variante: em G1 a aprendizagem favorece C, e em G2 favorece S. Por isso a distribuição foi feita de modo que a ordem jogue **contra** o efeito previsto nas tarefas com efeito:

- CSBC-2 (negativo previsto) está em G1, e a variante mais difícil (A, Scherm, marca pouco conhecida) é feita sem a extensão;
- EDU-1 (positivo previsto) está em G2;
- em CAPES-2, a variante A (Centro-Oeste, 3º botão do mapa) é feita com a extensão, e a B (Sudeste, 4º botão) sem ela, para não somar a vantagem de posição à da aprendizagem;
- no complementar, as duas tarefas da SBC (positivo previsto) estão em G2.

Os controles, um em cada grupo (IHC-2 em G1 e SOL-2 em G2), dão uma estimativa grosseira da aprendizagem no tempo líquido: [(C − S) de SOL-2 − (C − S) de IHC-2] / 2. A aba Resumo calcula esse valor.

Outros limites, que vão para as ameaças à validade:

- a variante A vem sempre primeiro;
- a avaliadora é coautora e pode conhecer os sites (a aba Sessão registra a familiaridade prévia com cada um);
- em C, o painel aberto estreita a área da página.

## 4. Tarefas

O **núcleo** tem 8 tarefas (16 execuções). Ele cobre os três sites sugeridos (SOL, CAPES e IHC) e dois eventos da SBC com efeitos previstos opostos: EduComp (positivo) e CSBC (negativo). O **complementar** tem 4 tarefas (8 execuções) e acrescenta o site da SBC e o JIS.

| ID | Conjunto | Site | Objetivo | Efeito previsto | S (s) | C (s) |
|---|---|---|---|---|---|---|
| SOL-1 | núcleo, G1 | SOL, busca integrada | primeiro autor de um artigo buscado pelo título | baixo | 105 | 145 |
| CAPES-1 | núcleo, G1 | Periódicos CAPES, Lista A–Z | ISSN de um periódico | nulo a levemente negativo | 90 | 150 |
| IHC-2 | núcleo, G1 | IHC 2026, Programação | sessão técnica num dia e horário | controle | 70 | 90 |
| CSBC-2 | núcleo, G1 | CSBC 2026, patrocinadores | empresa patrocinadora de uma categoria | **negativo (alto)** | 50 | 120 |
| SOL-2 | núcleo, G2 | SOL, anais do IHC 2025 | trilha de um artigo | controle | 45 | 65 |
| CAPES-2 | núcleo, G2 | Periódicos CAPES, Suporte regional | e-mail do suporte de uma região | baixo | 110 | 130 |
| IHC-1 | núcleo, G2 | IHC 2026, Sessões Técnicas | dia, horário e sala de um trabalho | baixo, provavelmente negativo | 105 | 165 |
| EDU-1 | núcleo, G2 | EduComp 2026 | quem coordena uma chamada | positivo (baixo) | 55 | 95 |
| JIS-1 | complementar, G1 | JIS, volume 16 | páginas de um artigo | controle | 70 | 130 |
| EDU-3 | complementar, G1 | EduComp 2026, Comitê | instituições dos coordenadores de uma trilha | positivo (baixo) | 35 | 55 |
| SBC-1 | complementar, G2 | SBC, Associe-se | valor da anuidade de uma categoria | positivo (baixo) | 90 | 130 |
| SBC-2 | complementar, G2 | SBC, Secretarias Regionais | secretário regional de um estado | positivo (baixo) | 65 | 105 |

As **reservas** substituem uma tarefa que falhe na conferência ou no piloto, no mesmo grupo e na mesma posição (`python3 eval/tools/estudo2_gerar.py --trocar ID=RESERVA` regenera o formulário):

| Situação | Troca |
|---|---|
| SOL fora do ar | SOL-1 → SOL-4 (ISBN de livro, em outro servidor) e SOL-2 → JIS-2 (controle) |
| NVDA não lê o endereço de links sem nome | CSBC-2 → IHC-3 |
| resposta mudou no site | uma reserva de mesmo tipo: CAPES-3, IHC-4 ou IHC-5 (efeito baixo); CSBC-1 ou JIS-2 (controle) |

Estimativas: tempo de uma usuária experiente de NVDA, revisto pelo verificador de cada tarefa. Com a extensão, soma-se 20 s por página do caminho (operação do painel) e o contorno previsto em CSBC-2.

### Cartões — núcleo

#### SOL-1 — Buscar um artigo na SOL e dizer o primeiro autor

SOL — busca integrada · grupo G1 · início: <https://sol.sbc.org.br/busca/> · 2 página(s) no caminho · estimativa 105 s sem extensão, 145 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | Na busca da biblioteca digital da SBC, a SOL, procure nos Anais de Eventos o artigo "Can AI Judge Usability? A Comparative Analysis of Generative Tools on Climate Conference Websites" e diga o nome do primeiro autor. | Danilo Teixeira Lima (no resultado deve aparecer como "Lima, Danilo Teixeira"; confirmar no piloto) | S: "Danilo Teixeira Lima", "Danilo Lima" ou "Lima". P: chega ao resultado certo, mas diz outro autor do artigo. F: não consegue enviar a busca (a base "Anais de Eventos" é obrigatória e o aviso é só visual), outro nome, desistência. |
| B | Na busca da biblioteca digital da SBC, a SOL, procure nos Anais de Eventos o artigo "Teaching or Manipulating? On the Adoption of Bright and Deceptive Patterns by Duolingo" e diga o nome do primeiro autor. | João Vítor Castro (provavelmente "Castro, João Vítor"; confirmar no piloto) | S: "João Vítor Castro", "João Castro" ou "Castro". P: chega ao resultado certo, mas diz o segundo autor (George Valença). F: não envia a busca, outro nome, desistência. |

- **Caminho esperado:** Busca integrada: marcar a caixa "Anais de Eventos" → campo "Título" → digitar parte do título e Enter → na página de resultados, ler a linha de autores do item.
- **Efeito previsto da extensão:** Baixo. O campo "Título" já tem rótulo. A extensão nomeia o campo sem rótulo e os selects de data pelo atributo name ("Query", "Field 7 from Month") e acrescenta "(abre em nova aba)" aos links de resultado; não trata a base obrigatória com aviso só visual, que é a barreira real.
- **Riscos e cuidados:** As respostas foram conferidas no sumário do IHC 2025 (cópia do Wayback de 22/10/2026), não no resultado da busca ao vivo: o servidor sol.sbc.org.br recusa conexões desta rede desde a exploração. Conferir no piloto que a busca pelo título traz o artigo no topo. Registrar se ela tentou enviar sem marcar a base e se abriu o artigo na nova aba. Espaçar as tarefas da SOL; reserva: SOL-4 (servidor books-sol).

#### SOL-2 — Dizer em que trilha dos anais do IHC 2025 está um artigo

SOL — anais do IHC 2025 · grupo G2 · início: <https://sol.sbc.org.br/index.php/ihc/issue/view/1582> · 1 página(s) no caminho · estimativa 45 s sem extensão, 65 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | Nos anais do IHC 2025, na SOL, diga em qual trilha foi publicado o artigo "Falando, desenhando e avaliando: workshops para a construção de um repositório sobre tecnologias para pessoas idosas". | Relatos de Experiência | S: "Relatos de Experiência" (com ou sem "Trilha"). P: chega ao artigo, mas não identifica a trilha. F: outra trilha (Abertura, Ideias Inovadoras, Prêmio, Artigos de Pesquisa), desistência. |
| B | Nos anais do IHC 2025, na SOL, diga em qual trilha foi publicado o artigo "Diagnóstico da Acessibilidade Digital em Serviços Públicos Prioritários usando a Lei de Acesso à Informação". | Ideias Inovadoras e Resultados Emergentes em IHC | S: "Ideias Inovadoras e Resultados Emergentes em IHC" (aceitar "Ideias Inovadoras"). P: chega ao artigo, mas não identifica a trilha. F: outra trilha, desistência. |

- **Caminho esperado:** Busca do NVDA por parte do título → Shift+H até o cabeçalho de nível 2 da trilha (ou abrir o artigo e ler "Você está aqui").
- **Efeito previsto da extensão:** Nenhum (controle). Trilhas são h2 e títulos são links com texto. A extensão só muda contraste e expõe um link "Buscar" oculto, fora do caminho.
- **Riscos e cuidados:** Mesmo servidor da SOL-1. Posição absoluta diferente (A é o 4º item da página, B o 21º): registrar a estratégia (busca de texto, lista de links, leitura linear).

#### CAPES-1 — Achar o ISSN de um periódico na Lista A–Z

Portal de Periódicos CAPES — Lista A–Z · grupo G1 · início: <https://www.periodicos.capes.gov.br/index.php/acervo/lista-a-z-periodicos.html> · 3 página(s) no caminho · estimativa 90 s sem extensão, 150 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No Portal de Periódicos da CAPES, descubra qual é o ISSN do periódico Journal of the Brazilian Computer Society. | 0104-6500 | S: 0104-6500 (hífen opcional). P: chegou à página do periódico sem ler o ISSN, ou deu um ISSN lido fora do Portal (SciELO). F: ISSN de outro título, desistência. |
| B | No Portal de Periódicos da CAPES, descubra qual é o ISSN do periódico Journal of the Brazilian Chemical Society. | 0103-5053 | S: 0103-5053 (hífen opcional). P: chegou à página do periódico sem ler o ISSN, ou deu um ISSN lido fora do Portal (SciELO). F: ISSN de outro título, desistência. |

- **Caminho esperado:** Campo de busca da lista (anunciado "Olá.") → digitar o título e Enter → link do resultado único → tabela de detalhes, linha "ISSN".
- **Efeito previsto da extensão:** Baixo (nulo a levemente negativo). É a página com a maior queda do axe no Estudo 1 (172 → 40), mas o caminho quase não muda: o rótulo enganoso "Olá." do campo continua e a tabela de detalhes já é acessível. A extensão renomeia botões que tinham bom nome ("Exibir lista", "Página seguinte") para "Acionar botão N", fora do caminho.
- **Riscos e cuidados:** O cabeçalho do detalhe e o botão "Acesse" levam ao SciELO (outro site, outro ISSN). Fechar o banner de cookies antes de cronometrar, nas duas condições.

#### CAPES-2 — E-mail do suporte regional (mapa de botões sem nome)

Portal de Periódicos CAPES — Suporte regional · grupo G2 · início: <https://www.periodicos.capes.gov.br/index.php/ajuda/suporte-regional.html> · 1 página(s) no caminho · estimativa 110 s sem extensão, 130 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No Portal de Periódicos da CAPES, encontre o e-mail de contato do suporte regional para a região Centro-Oeste. | lucianasetubal@unb.br ou seanio.avelino@unb.br (qualquer um) | S: um dos dois e-mails @unb.br. P: abre a região Centro-Oeste, mas dá só o nome ou o telefone, ou soletra o e-mail com 1 caractere errado. F: e-mail de outra região, desistência. |
| B | No Portal de Periódicos da CAPES, encontre o e-mail de contato do suporte regional para a região Sudeste. | cref@sibi.ufrj.br | S: cref@sibi.ufrj.br. P: abre a região Sudeste, mas dá só o nome de uma bibliotecária, ou soletra o e-mail com 1 caractere errado. F: e-mail de outra região, desistência. |

- **Caminho esperado:** Cabeçalho "Atendimento por região" → percorrer os 5 botões do mapa abrindo cada menu até ouvir a região pedida → ler nome e e-mail.
- **Efeito previsto da extensão:** Baixo. Os 5 botões do mapa não têm nome (button-name crítico); a extensão lhes dá "Acionar botão N", sem a região, que continua só dentro do menu fechado. Mede o defeito D-7 numa barreira que a extensão diz corrigir.
- **Riscos e cuidados:** Janela maximizada (≥ 1280 px) e zoom 100%: abaixo de 768 px CSS aparece uma lista alternativa e a barreira some. E-mails pessoais podem mudar: rodar o conferir na véspera. Anotar quantos menus foram abertos. A variante A (Centro-Oeste, 3º botão) fica antes da B (Sudeste, 4º) no mapa e é feita com a extensão, para não somar a vantagem de posição à da aprendizagem, que favorece S neste grupo.

#### IHC-1 — Dia, horário e sala em que um trabalho foi apresentado

IHC 2026 — Sessões Técnicas · grupo G2 · início: <https://ihc.sbc.org.br/2026/> · 3 página(s) no caminho · estimativa 105 s sem extensão, 165 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site do IHC 2026, sem baixar arquivos, descubra em que dia, horário e sala foi apresentado o artigo "Explorando lacunas e oportunidades em aplicativos móveis para suporte ao luto com aplicabilidade profissional". | Quinta-feira, 22/10, das 08h30 às 10h00, sala Algaroba (Sessão Técnica 10) | S: dia (quinta ou 22/10) + início 08h30 + sala Algaroba. P: 2 dos 3 dados, ou só a sessão certa. F: dados de outra sessão, desistência. |
| B | No site do IHC 2026, sem baixar arquivos, descubra em que dia, horário e sala foi apresentado o artigo "Lições Aprendidas sobre a Comunicabilidade da Ferramenta FAKECHECK: Uma Avaliação da Plataforma Web para Detecção de Notícias Falsas". | Quarta-feira, 21/10, das 14h às 15h30, sala Juazeiro (Sessão Técnica 7) | S: dia (quarta ou 21/10) + início 14h + sala Juazeiro. P: 2 dos 3 dados, ou só a sessão certa. F: dados de outra sessão, desistência. |

- **Caminho esperado:** Início → "Programação" → "Sessões Técnicas" → busca do NVDA por uma palavra do título → Shift+H até o tema da sessão → lista Data/Horário/Coordenador/Sala.
- **Efeito previsto da extensão:** Baixo, provavelmente negativo. Os links do caminho já têm texto. A extensão remove o aria-hidden de cerca de 120 ícones decorativos da página Sessões Técnicas, que passam a ser lidos como "gráfico" justamente na lista Data/Horário/Sala (defeito D-6).
- **Riscos e cuidados:** A Programação oferece "Programação Acessível" em DOCX/PDF: a instrução diz "sem baixar arquivos". Títulos longos: permitir repetir a instrução e contar as repetições. Os alvos são o 3º de 4 trabalhos em sessões de mesma estrutura.

#### IHC-2 — Qual sessão técnica aconteceu num dia e horário (abas + tabela)

IHC 2026 — Programação Geral · grupo G1 · início: <https://ihc.sbc.org.br/2026/index.php/programacao/> · 1 página(s) no caminho · estimativa 70 s sem extensão, 90 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | Na página de programação do IHC 2026, sem baixar arquivos, descubra qual sessão técnica aconteceu na terça-feira, 20 de outubro, às 10h30. | Sessão Técnica 2 — Diversidade e Justiça Social (Sala Juazeiro, 10h30–12h) | S: número (2) ou tema (Diversidade e Justiça Social). P: lê a linha certa, mas não diz qual é a sessão técnica. F: outro dia (a aba de segunda abre por padrão), outra linha, desistência. |
| B | Na página de programação do IHC 2026, sem baixar arquivos, descubra qual sessão técnica aconteceu na quarta-feira, 21 de outubro, às 10h30. | Sessão Técnica 6 — Padrões Enganosos e Privacidade (Sala Juazeiro, 10h30–12h) | S: número (6) ou tema (Padrões Enganosos e Privacidade). P: lê a linha certa, mas não diz qual é a sessão técnica. F: outro dia, outra linha, desistência. |

- **Caminho esperado:** Lista de abas → ativar a aba do dia → T até a tabela → linha "10h30 – 12h" → célula da sessão técnica.
- **Efeito previsto da extensão:** Nenhum (controle). Abas ARIA e tabela com cabeçalho já acessíveis; a extensão não as altera. Estima o custo fixo de usar a extensão sem benefício possível.
- **Riscos e cuidados:** A busca do NVDA não acha conteúdo de abas fechadas. Erro previsível de aba (segunda, aberta por padrão) é igual em A e B.

#### CSBC-2 — Qual empresa patrocina uma categoria (logo sem nome)

CSBC 2026 — rodapé de patrocinadores · grupo G1 · início: <https://csbc.sbc.org.br/2026/> · 1 página(s) no caminho · estimativa 50 s sem extensão, 120 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site do CSBC 2026, o Congresso da SBC, descubra qual empresa é a patrocinadora da categoria Cobre. | Scherm (aceitar scherm.com.br, em qualquer pronúncia ou soletrado) | S: "Scherm" ou o domínio. P: chega ao link da categoria Cobre, mas não consegue nomear a empresa. F: empresa de outra categoria, desistência. |
| B | No site do CSBC 2026, o Congresso da SBC, descubra qual empresa é a patrocinadora da categoria Ouro. | Qualcomm (aceitar o endereço qualcomm.com) | S: "Qualcomm" ou o domínio. P: chega ao link da categoria Ouro, mas não consegue nomear a empresa. F: empresa de outra categoria, desistência. |

- **Caminho esperado:** Lista de cabeçalhos → "COBRE" (B: "OURO") → seta para baixo até o link do logo → ouvir o anúncio; se não identificar, NVDA+K ou seguir o link e ouvir o título do site.
- **Efeito previsto da extensão:** Alto, NEGATIVO. O logo é um link com `<img alt="">` e sem nome; sem a extensão o NVDA tende a anunciar o endereço (scherm.com.br, qualcomm.com), o que basta. Com a extensão o link ganha nome genérico ("Abrir link 19" ou "Abrir link 11" pelo painel; o cabeçalho anterior, "COBRE" ou "OURO", no modo automático), que esconde o endereço. Mede o defeito D-7.
- **Riscos e cuidados:** Só usar se o piloto confirmar que o NVDA da avaliadora anuncia o endereço de um link sem nome no Chrome; se não anunciar, trocar pela reserva IHC-3. Assimetria: Qualcomm é marca conhecida, Scherm não; por isso a variante mais difícil (A, Scherm) é feita sem a extensão (grupo G1), e tanto a variante quanto a aprendizagem jogam contra o efeito negativo previsto. Sites externos não recebem o Accessify.

#### EDU-1 — Quem coordena uma chamada (links "Saiba mais")

EduComp 2026 — chamadas · grupo G2 · início: <https://educomp.sbc.org.br/2026/> · 2 página(s) no caminho · estimativa 55 s sem extensão, 95 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site do EduComp 2026, descubra quem coordena a chamada de Minicursos. | Maria Ivanilse Calderon Ribeiro (IFRO) | S: o nome (ao menos prenome e um sobrenome; instituição opcional). P: abre a chamada certa, mas não lê o nome ou dá só o contato; ou responde os ministrantes listados em Programação > Minicursos. F: coordenação de outra chamada, desistência. |
| B | No site do EduComp 2026, descubra quem coordena a chamada de Mesas temáticas. | Jefferson Rodrigo Speck (Faculdade Donaduzzi/Unioeste) | S: o nome (ao menos prenome e um sobrenome). P: abre a chamada certa, mas não lê o nome ou dá só o contato; ou responde os mediadores de uma mesa (Programação > Mesas temáticas). F: coordenação de outra chamada, desistência. |

- **Caminho esperado:** Cabeçalho do cartão da chamada → link "Saiba mais" (ou lista de links) → página da chamada, linha "Coordenação:" logo após o h1.
- **Efeito previsto da extensão:** Baixo, POSITIVO. Os 7 links "Saiba mais" iguais passam a "Saiba mais: Minicursos", "Saiba mais: Mesas temáticas"… Só ajuda se ela usar a lista de links ou o Tab; por cabeçalhos ou pelo menu CHAMADAS a diferença some.
- **Riscos e cuidados:** A página inicial chama o modelo para o logo: com o modelo padrão (qwen3:8b, raciocínio original) o alt gravado pode ser o raciocínio do modelo (D-8). Registrar a estratégia usada.

### Cartões — complementar

#### SBC-1 — Valor da anuidade de uma categoria (tabela sem cabeçalho)

SBC — Associe-se · grupo G2 · início: <https://www.sbc.org.br/> · 2 página(s) no caminho · estimativa 90 s sem extensão, 130 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site da SBC, descubra qual é o valor atual da anuidade para a categoria Associado ou Associada Estudante de Pós-graduação. | R$ 142,00 | S: R$ 142,00. P: chega à tabela de anuidades, mas lê o valor de outra linha. F: valor desatualizado da notícia de 2017 (R$ 70, 75, 175 ou 195), não chega à tabela, desistência. |
| B | No site da SBC, descubra qual é o valor atual da anuidade para a categoria Associado ou Associada Efetivo/Fundador. | R$ 394,00 | S: R$ 394,00. P: chega à tabela, mas lê o valor de outra linha. F: valor desatualizado da notícia de 2017 (R$ 70, 75, 175 ou 195), não chega à tabela, desistência. |

- **Caminho esperado:** Lista de links → "Sua Associação" (ou "Saiba mais" de "Seja Associado(a)") → T até a tabela (10×3) → linha da categoria → coluna 3.
- **Efeito previsto da extensão:** Baixo, POSITIVO. A 1ª linha da tabela vira th, e o NVDA passa a anunciar "Valor da Anuidade" ao mudar de coluna; "Saiba mais" ganha contexto. Do lado negativo: o skip link inserido aponta para o topo da página, o logo vira "Abrir link 1" e a página inicial chama o modelo para imagens.
- **Riscos e cuidados:** A SBC pode publicar os valores de 2027 na campanha de renovação (dezembro, pelo histórico): rodar o conferir na véspera. Registrar se ela usou a busca do site.

#### SBC-2 — Quem é o secretário regional de um estado (tabela sem cabeçalho)

SBC — Secretarias Regionais · grupo G2 · início: <https://www.sbc.org.br/> · 2 página(s) no caminho · estimativa 65 s sem extensão, 105 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site da SBC, descubra quem é o secretário ou a secretária regional da SBC em Pernambuco. | Kiev Gama | S: "Kiev Gama". P: lê outra coluna da linha certa, ou dá a secretária adjunta (Taciana Pontual Falcão, na página do estado). F: nome de outro estado, não chega à tabela, desistência. |
| B | No site da SBC, descubra quem é o secretário ou a secretária regional da SBC em Roraima. | Herbert Rocha | S: "Herbert Rocha". P: lê outra coluna da linha certa. F: nome de outro estado, não chega à tabela, desistência. |

- **Caminho esperado:** Lista de links → "Sobre as Secretarias" → busca do NVDA pelo estado → Ctrl+Alt+seta para a direita (coluna 2).
- **Efeito previsto da extensão:** Baixo, POSITIVO. A 1ª linha vira th e o NVDA anuncia "Secretário (a) Regional" ao entrar na coluna 2. Custos: skip link para o topo, rótulos genéricos no logo e na busca.
- **Riscos e cuidados:** As páginas de cada estado podem divergir da tabela (na Paraíba divergem): a tabela é a referência. Rodar o conferir na véspera.

#### EDU-3 — Instituições dos coordenadores de uma trilha (tabela de dados sem th)

EduComp 2026 — Comitê de programa · grupo G1 · início: <https://educomp.sbc.org.br/2026/educomp/equipes/comite-programa.html> · 1 página(s) no caminho · estimativa 35 s sem extensão, 55 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No comitê de programa do EduComp 2026, descubra de quais instituições são os coordenadores da Trilha 2, Relatos de experiência. | UEA e UFRR (Fernanda Pires — UEA; Luciano Ferreira — UFRR) | S: as duas instituições. P: só uma, ou os nomes sem as instituições. F: instituições de outra trilha, desistência. |
| B | No comitê de programa do EduComp 2026, descubra de quais instituições são os coordenadores da Trilha 4, Recursos e ambientes educacionais. | UFMG e UFJF (Eduardo Figueiredo — UFMG; Ronney Castro — UFJF) | S: as duas instituições. P: só uma, ou os nomes sem as instituições. F: instituições de outra trilha, desistência. |

- **Caminho esperado:** Lista de cabeçalhos → "Trilha 2 - Relatos de experiência" (B: "Trilha 4 - …") → T → ler as duas linhas.
- **Efeito previsto da extensão:** Baixo, POSITIVO. A linha "Nome | Instituição" vira th e o NVDA anuncia "Instituição" ao mudar de coluna. Tabela pequena (3×2): lendo a linha inteira, a diferença some.
- **Riscos e cuidados:** Tarefa curta: a operação do painel pesa proporcionalmente mais.

#### JIS-1 — Páginas de um artigo no volume de 2025 do JIS

JIS — volume 16 (2025) · grupo G1 · início: <https://journals-sol.sbc.org.br/index.php/jis> · 3 página(s) no caminho · estimativa 70 s sem extensão, 130 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No Journal on Interactive Systems, descubra em quais páginas do volume de 2025 está publicado o artigo "Kahoot as a data collection tool to work with school age children". | 227–235 | S: 227 a 235. P: chega ao artigo, mas dá as páginas de um vizinho. F: não chega ao volume de 2025, desistência. |
| B | No Journal on Interactive Systems, descubra em quais páginas do volume de 2025 está publicado o artigo "Evaluating a Serious Game for Math: Is it Useful and Fun?". | 199–212 | S: 199 a 212. P: chega ao artigo, mas dá as páginas de um vizinho. F: não chega ao volume de 2025, desistência. |

- **Caminho esperado:** "Regular Issues" (arquivo) → "Vol. 16 No. 1 (2025)" → busca do NVDA por "Kahoot" (B: "Math") → seta para baixo (autores, páginas).
- **Efeito previsto da extensão:** Nenhum a baixo. A inicial do JIS teve 146 violações no axe, a pior entre as páginas iniciais do estrato D (a Lista A–Z da CAPES, página de tarefa, teve 172), mas para leitor de tela é bem estruturada: o número superestima a barreira. A extensão mexe em contraste, no logo e em métricas da barra lateral, fora do caminho; o logo sem alt vai ao modelo em toda página.
- **Riscos e cuidados:** A busca do JIS leva à SOL (outro servidor). Página em inglês: o NVDA pode trocar de voz, igual nas duas condições.

### Cartões — reservas

#### SOL-4 — ISBN de um livro da série de IHC (substitui SOL-1 se a SOL estiver fora do ar)

SOL Livros — série de IHC · início: <https://books-sol.sbc.org.br/index.php/sbc/catalog/series/ppcihc> · 2 página(s) no caminho · estimativa 60 s sem extensão, 100 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | Na série de livros "Perspectivas e Práticas Contemporâneas em IHC", da SOL, encontre o livro "Minicursos do IHC 2024" e diga o ISBN dele. | 978-85-7669-623-0 | S: o ISBN completo (hífens opcionais). P: página certa, com um dígito trocado, ou o DOI no lugar do ISBN. F: ISBN de outro livro (registrar se seguiu um link de capa), desistência. |
| B | Na série de livros "Perspectivas e Práticas Contemporâneas em IHC", da SOL, encontre o livro "Minicursos do IHC 2023" e diga o ISBN dele. | 978-85-7669-604-9 | S: o ISBN completo. P: página certa, com um dígito trocado, ou o DOI. F: ISBN de outro livro, desistência. |

- **Caminho esperado:** Tecla 3 até o título do livro → página do livro → cabeçalho "ISBN-13 (15)".
- **Efeito previsto da extensão:** Baixo, possivelmente negativo. As capas são links sem nome; a extensão as rotula com nome genérico (painel) ou com o cabeçalho do livro anterior (modo automático), o que pode levar ao livro errado pela lista de links.
- **Riscos e cuidados:** Servidor books-sol, diferente do sol.sbc.org.br. Ler ISBN em voz alta é sujeito a erro de dígito. No modo automático, cada capa herda o título do livro anterior: pela lista de links, "Minicursos do IHC 2023" pode levar ao livro de 2024 (B) e "Minicursos do IHC 2024" a "Práticas de IHC em Sala de Aula" (A); classificar como falha induzida pela extensão.

#### CAPES-3 — Valor de uma bolsa no exterior (tabela)

gov.br/capes — Valores de Bolsas · início: <https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas> · 2 página(s) no caminho · estimativa 110 s sem extensão, 150 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site da CAPES, descubra o valor mensal da bolsa de Professor Visitante Sênior no exterior, em dólar canadense. | 3.060,00 dólares canadenses | S: 3.060 (também vale o mesmo valor lido na seção histórica "Professor/Pesquisador Visitante no Exterior", linha Mensalidade). P: linha certa e coluna vizinha (3.420,00 ou 1.900,00), ou moeda errada. F: valor em reais (bolsa no país), desistência. |
| B | No site da CAPES, descubra o valor mensal da bolsa de Professor Visitante Júnior Pós-Doutorado no exterior, em dólar canadense. | 2.660,00 dólares canadenses | S: 2.660 (também vale o valor lido em "Estágio Pós-Doutoral", linha Mensalidade). P: linha certa e coluna vizinha (3.000,00 ou 1.700,00), ou moeda errada. F: valor em reais, desistência. |

- **Caminho esperado:** "Prestação de Contas" → "Valores de Bolsas" → 2ª tabela ("Valores das bolsas no exterior") → linha → coluna "Dólar Canadense".
- **Efeito previsto da extensão:** Baixo. As tabelas já têm th; o que atrapalha (títulos de seção que não são cabeçalhos, sumário com âncoras quebradas) não é tratado. 5 links vazios viram "Abrir link N".
- **Riscos e cuidados:** Página com 44 tabelas; gov.br devolveu 429 após poucas requisições na exploração.

#### IHC-3 — Dia e hora de início de uma sessão especial (substitui CSBC-2)

IHC 2025 — página inicial · início: <https://ihc.sbc.org.br/2025/> · 2 página(s) no caminho · estimativa 65 s sem extensão, 105 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site do IHC 2025, descubra em que dia e a que horas começou a sessão de apresentações do Prêmio Junia Coutinho Anacleto. | Terça-feira, 09/09/2025, às 8h | S: dia (terça ou 09/09) + início às 8h. P: só o dia ou só a hora. F: outro dia ou hora, desistência. |
| B | No site do IHC 2025, descubra em que dia e a que horas começou a Sessão 1 de Pôsteres e Demonstrações. | Segunda-feira, 08/09/2025, às 15h30 | S: dia (segunda ou 08/09) + início às 15h30. P: só o dia ou só a hora. F: dados da Sessão 2 (09/09), "data a ser definida", desistência. |

- **Caminho esperado:** Cabeçalho do cartão → "Saiba mais" → cabeçalho "Programação" → h4 com dia e hora.
- **Efeito previsto da extensão:** Baixo. Os 3 "Saiba mais" iguais ganham contexto (ajuda pela lista de links); as sobreposições dos cartões viram "Abrir link N".
- **Riscos e cuidados:** Página da amostra do Estudo 1 (axe 19 → 2). Rota alternativa pela Programação dá as mesmas respostas: registrar a rota.

#### IHC-4 — Distância de um hotel recomendado até a UFC

IHC 2026 — Local · início: <https://ihc.sbc.org.br/2026/> · 2 página(s) no caminho · estimativa 70 s sem extensão, 110 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site do IHC 2026, descubra a que distância da UFC fica o Hotel Pedra dos Ventos, segundo a lista de hotéis do evento. | 23 km | S: 23 km. P: acha o hotel, mas não a distância. F: distância de outro hotel, desistência. |
| B | No site do IHC 2026, descubra a que distância da UFC fica o Cedro Palace Hotel, segundo a lista de hotéis do evento. | 5,2 km | S: 5,2 km. P: acha o hotel, mas não a distância, ou arredonda para 5 km. F: distância de outro hotel, desistência. |

- **Caminho esperado:** "Local" → busca do NVDA pelo nome do hotel (ou tecla 4) → lista do cartão, 4º item.
- **Efeito previsto da extensão:** Baixo, provavelmente negativo: ícones decorativos viram "gráfico" no cartão; links de mapa só com ícone viram "Abrir link N".
- **Riscos e cuidados:** A página Local pode ser editada ou sair do menu depois do evento.

#### IHC-5 — Valor de uma categoria de inscrição (somente IHC, 1º prazo)

IHC 2025 — Inscrições · início: <https://ihc.sbc.org.br/2025/> · 2 página(s) no caminho · estimativa 100 s sem extensão, 140 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site do IHC 2025, descubra o valor da inscrição somente no IHC, sem o INTERACT, para a categoria Profissional associado à SBC com anuidade vigente, no prazo até 7 de julho. | R$ 450,00 | S: R$ 450,00. P: categoria certa, outro prazo. F: valor do Combo IHC + INTERACT ou de outra categoria, desistência. |
| B | No site do IHC 2025, descubra o valor da inscrição somente no IHC, sem o INTERACT, para a categoria Estudante de pós-graduação associado à SBC com anuidade vigente, no prazo até 7 de julho. | R$ 290,00 | S: R$ 290,00. P: categoria certa, outro prazo (R$ 320,00, 390,00 ou 440,00). F: Combo (R$ 700,00), outra categoria, desistência. |

- **Caminho esperado:** "Inscrições" → cabeçalho "Somente Inscrição no IHC" → h4 da categoria → h5 "… com anuidade vigente" → "Até 07/07".
- **Efeito previsto da extensão:** Baixo: a dificuldade é de conteúdo (Combo e Somente IHC repetem as categorias). A extensão acrescenta "gráfico" perto dos cartões.
- **Riscos e cuidados:** Instrução com 4 restrições: permitir repetir e contar as repetições.

#### CSBC-1 — Horário de uma atividade na programação (controle)

CSBC 2026 — Programação Geral · início: <https://csbc.sbc.org.br/2026/> · 2 página(s) no caminho · estimativa 75 s sem extensão, 115 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | No site do CSBC 2026, descubra a que horas começou a Cerimônia de Abertura, que aconteceu na segunda-feira, 20 de julho. | 19h (19:00–20:00, Sala Hortênsia Central) | S: 19h. P: lê o horário vizinho (18:30 ou 20:30) ou confunde com o Coquetel de Abertura. F: outro horário sem localizar o item, desistência. |
| B | No site do CSBC 2026, descubra a que horas começou o Jantar do Evento, que aconteceu na quarta-feira, 22 de julho. | 20h | S: 20h (Programação Geral ou página do Jantar). P: lê o horário vizinho, ou 19h da página do WIT (fonte divergente do próprio site). F: outro horário sem localizar o item, desistência. |

- **Caminho esperado:** "Programação" → aba do dia → busca do NVDA por "Cerimônia" (B: "Jantar") → seta para cima até o horário.
- **Efeito previsto da extensão:** Nenhum (controle): abas e itens já têm nome.
- **Riscos e cuidados:** Itens da programação são "botões" que não fazem nada.

#### JIS-2 — Uma regra das diretrizes do JIS (controle; substitui SOL-2 se a SOL estiver fora do ar)

JIS — diretrizes para autores · início: <https://journals-sol.sbc.org.br/index.php/jis> · 2 página(s) no caminho · estimativa 60 s sem extensão, 100 s com extensão

| Variante | Ação (ler em voz alta) | Saída esperada | Critério |
|---|---|---|---|
| A | Nas diretrizes para autores do Journal on Interactive Systems, descubra quantas contribuições originais, no máximo, a carta de apresentação deve listar. | Até cinco | S: "até cinco", depois de a gravação mostrar o NVDA lendo o trecho. P: chega às diretrizes e dá outro número. F: não encontra as diretrizes, desistência. |
| B | Nas diretrizes para autores do Journal on Interactive Systems, descubra por quantos especialistas independentes os manuscritos submetidos costumam ser avaliados. | Três | S: "três", depois de a gravação mostrar o NVDA lendo o trecho. P: chega às diretrizes e dá outro número. F: não encontra as diretrizes, desistência. |

- **Caminho esperado:** Menu "Submissions" → "Authors Guidelines" → cabeçalho "Cover Letter" (B: "Review Process").
- **Efeito previsto da extensão:** Nenhum (controle): cabeçalhos e listas corretos; menu já acessível.
- **Riscos e cuidados:** A coautora pode conhecer as diretrizes: exigir que o trecho seja lido na gravação.

## 5. Medidas e codificação

Cada execução ocupa uma linha da aba Roteiro. As definições abaixo também estão na aba Instruções.

**Tempos**

- **t0**: o(a) facilitador(a) diz "pode começar".
- **t1**: a avaliadora diz a resposta final ("minha resposta é…") ou "desisto". Se ela corrigir a resposta, valem a última resposta e o seu t1.
- As releituras da instrução a pedido ficam dentro do tempo e são contadas em Repetições.
- **Tempo total** = t1 − t0.
- **Tempo no painel** (só em C) = soma dos intervalos entre Alt+Shift+A e a volta do foco à página, isto é, a primeira fala do NVDA vinda da página depois da confirmação.
- **Tempo líquido** = total − painel.

**Teto**: 300 s de tempo líquido nas duas condições. Ao vivo, o(a) facilitador(a) pausa o cronômetro durante o painel e encerra a tarefa aos 300 s. Uma execução encerrada pelo(a) facilitador(a), ou com tempo líquido acima de 300 s no vídeo, conta como F.

**Resultado**

- **S**: resposta correta segundo o critério, sem ajuda e dentro do teto.
- **P**: parcialmente correta, como definido no critério da tarefa.
- **F**: errada, desistência, ajuda ou teto.

Ajuda é indicar caminho, conteúdo ou atalho. Lembrar de acionar o Accessify **não** é ajuda: o(a) facilitador(a) lembra assim que a avaliadora começar a explorar uma página nova sem o painel e registra o lembrete.

**Falha da extensão.** Se o painel mostrar erro ou não anunciar o fim da análise em 60 s, a avaliadora segue sem acionar de novo. A execução é marcada "C degradada" em Observações e entra numa análise de sensibilidade.

**SEQ.** Logo após cada tarefa, perguntar: "No geral, quão fácil ou difícil foi esta tarefa, de 1 (muito difícil) a 7 (muito fácil)?"

**Estratégia**: cabeçalhos, lista de links, busca do NVDA, leitura linear, tabela, menu do site, busca do site ou várias. Em várias tarefas, o efeito da extensão só aparece com uma estratégia (ex.: EDU-1, pela lista de links).

**Barreiras**: trecho literal do NVDA nos pontos de dificuldade, com o tempo no vídeo.

A coluna Conferência do Roteiro aponta inconsistências: t1 antes de t0, falta do tempo no painel em C, execução acima do teto, encerrada ou com ajuda que não foi marcada F. Para cronometrar com precisão, ligar o log do NVDA no nível "Entrada/saída", que registra cada tecla e cada fala com horário. Nenhuma tarefa pede senha ou dado pessoal.

Dois autores codificam os vídeos de forma independente, como prevê a Seção 6 do artigo, e reconciliam as divergências. A aba Resumo calcula as contagens por condição, os pares por tarefa e a estimativa de aprendizagem pelos controles.

## 6. Procedimento da sessão

1. **Preparação (15 min).**
   - Consentimento gravado.
   - Aba Sessão preenchida: versões, configurações do NVDA, familiaridade com cada site.
   - OBS gravando a tela, o áudio do sistema (NVDA) e o microfone (vozes da avaliadora e do facilitador), de preferência em faixas separadas.
   - Log do NVDA ligado.
2. **Regras lidas à avaliadora.**
   - Trabalhar em silêncio e comentar depois da resposta (pensar em voz alta infla o tempo).
   - Dizer "minha resposta é…" ao terminar, ou "desisto".
   - Pode pedir para repetir a instrução.
   - Não baixar arquivos.
   - Na condição C, acionar o Accessify em cada página nova do site da tarefa e não acionar duas vezes na mesma página.
3. **Familiarização** livre no perfil S (≈ 2 min).
4. **Bloco 1a.** Em cada tarefa:
   - o(a) facilitador(a) abre a URL inicial, espera a carga e cala o NVDA (Ctrl);
   - lê a ação e diz "pode começar"; a avaliadora não toca no teclado antes disso;
   - registra a resposta, faz a SEQ e ouve o comentário.
5. **Troca para o perfil C**: P0 (treino medido do painel na página W3C BAD *before*) e bloco 1b.
6. **Pausa de 10 min** e bloco 2a.
7. **Troca para o perfil S** e bloco 2b.
8. **Entrevista final (10 min)**: diferenças percebidas entre as condições, o painel, rótulos ouvidos que ajudaram ou atrapalharam.

O(a) facilitador(a) não ensina atalhos nem indica o caminho.

## 7. Estimativa de tempo

| Etapa | Tempo |
|---|---|
| Preparação da máquina (perfis, build da extensão, Ollama, OBS, log do NVDA), uma vez | 30–45 min |
| Piloto pelo autor vidente com NVDA (seção 8) | ≈ 1 h |
| Conferência das respostas na véspera e no dia (`estudo2_conferir.py`) | 2 min cada |
| **Sessão 1 (núcleo)** | **≈ 1 h 30** (até ≈ 1 h 50 se várias tarefas chegarem perto do teto) |
| **Sessão 2 (complementar)** | **≈ 40 min** |
| Codificação dos vídeos (≈ 4 min por execução por codificador) | núcleo ≈ 65 min por codificador; complementar ≈ 30 min; mais ≈ 20 min de reconciliação |

Composição da sessão 1:

- tarefas: 26,5 min (10,5 min sem a extensão e 16 min com ela);
- leitura da instrução, SEQ e comentário: ≈ 80 s × 16 = 21 min;
- preparação 15 min, familiarização 2 min e P0 ≈ 3 min;
- trocas de perfil 2 min, pausa 10 min e entrevista 10 min.

Composição da sessão 2: tarefas 11,5 min; instrução, SEQ e comentário 11 min; preparação 10 min; trocas 2 min; entrevista 5 min.

Só o tempo de tarefa, por bloco do núcleo: 1a ≈ 5 min, 1b ≈ 7,5 min, 2a ≈ 8,5 min, 2b ≈ 5 min. Se só houver tempo para uma sessão antes da submissão, fazer o núcleo; o complementar pode entrar numa revisão.

## 8. Antes da sessão

**Conferir as respostas** na véspera e no dia: `python3 -I eval/tools/estudo2_conferir.py`.

- Cada checagem tem uma janela própria, medida sobre o texto real.
- Os controles negativos trocam a resposta pela de outra variante ou linha vizinha e precisam falhar. Assim, um OK não deixa passar uma resposta errada.
- Em 28/10/2026, todas as checagens fora da SOL deram OK ao vivo, inclusive os controles negativos. As checagens da SOL deram OK sobre a cópia do Wayback.
- Trocar pela reserva qualquer tarefa que falhe.

**Acesso à SOL.**

- O servidor `sol.sbc.org.br` passou a recusar conexões desta máquina por volta das 11h de 28/10/2026, depois de cerca de 20 carregamentos feitos pela exploração automatizada. Às 12h36 continuava recusando.
- Os servidores `journals-sol` e `books-sol` respondiam normalmente.
- Verificar o acesso pela rede da sessão, ter uma rede de reserva (4G) e espaçar os carregamentos.
- Se a SOL não abrir, aplicar as trocas da seção 4.

**Piloto** pelo autor vidente com NVDA, na máquina e nas versões da sessão:

- **Teclado no painel lateral:** como o foco chega ao painel depois de Alt+Shift+A e volta à página (F6?); se o fim da análise é anunciado com o foco na página; qual a largura útil da página com o painel aberto. O Suporte regional da CAPES (CAPES-2) precisa de pelo menos 768 px CSS, senão troca de layout e a barreira some.
- **CSBC-2:** o NVDA anuncia o endereço de um link sem nome no Chrome? Essa é a condição para usar a tarefa; se não anunciar, trocar por IHC-3.
- **SOL-1:** a busca integrada (Anais de Eventos, campo Título) por "Climate", por "Duolingo" e pelos títulos inteiros traz 1 resultado em cada caso, e o formato do nome do autor confere. Se "Climate" trouxer mais de um resultado, trocar o par.
- **Modelo:** latência nas páginas que o chamam (EduComp, SBC e JIS). No Estudo 1, foi de 1 a 2,5 s por página na GPU; sem GPU, pode passar de 40 s por imagem.
- **EDU-3:** os cabeçalhos das trilhas do comitê do EduComp aparecem na lista de cabeçalhos do NVDA e antecedem a tabela certa.
- **Gravação:** "pode começar" e "minha resposta é…" ficam audíveis.

**gov.br.** O servidor devolveu 429 após poucas requisições na exploração: evitar recarregar em sequência.

## 9. O que esperar e achados laterais

A previsão vem da leitura do código, de simulações das regras da v1.1.0 no DOM ao vivo e dos DOMs finais do Estudo 1, sem carregar a extensão; o piloto confirma. Nos caminhos destas tarefas, a v1.1.0 mais **troca nomes do que acrescenta informação**:

- só quatro tarefas têm efeito positivo previsto, e pequeno: EDU-1, SBC-1, SBC-2 e EDU-3;
- CSBC-2 tem efeito negativo forte (D-7);
- IHC-1 e CAPES-1 tendem a piorar um pouco;
- SOL-1 e CAPES-2 têm efeito previsto baixo;
- IHC-2, SOL-2 e JIS-1 são controles.

O Estudo 2 deve funcionar sobretudo como teste de "não causar dano", com poucos ganhos. Isso é coerente com a tese do artigo de que menos erros nas ferramentas não equivalem a mais acessibilidade.

Achados da preparação que ainda precisam ser confirmados. Se confirmados, entram na tabela de defeitos (pela D18, sem corrigir):

- o modo automático aplica um conjunto de correções diferente do painel (seção 2);
- o painel renomeia botões que já tinham nome acessível ("Pesquisar", "Página seguinte" → "Acionar botão N"), porque `isEmptyButton` ignora `aria-label` e `title`; há evidência nos DOMs do Estudo 1 da CAPES;
- `fixLabelInName` também age sobre landmarks com `aria-label`. Põe o texto visível da região antes do rótulo e corta em 160 caracteres, o que em menus longos apaga o rótulo original (`content.js:1432`). No DOM do Estudo 1 da página inicial do IHC 2025, a navegação ficou com o texto do menu truncado e sem o rótulo original;
- o skip link inserido em páginas sem `main` aponta para o primeiro elemento do documento. Na simulação da regra sobre o site da SBC, o alvo é `div#page-top`, vazio, e a usuária volta ao topo.

## 10. Como as tarefas foram escolhidas e verificadas

Em 28/10/2026, um agente por grupo de sites (SOL; CAPES; IHC; SBC e JIS; sites extras da amostra do Estudo 1) explorou os sites ao vivo. Cada um propôs tarefas com variantes A/B, rodou o axe-core e inspecionou a árvore de acessibilidade das páginas do caminho. Um verificador independente por grupo então:

- refez cada tarefa só a partir da instrução;
- procurou respostas concorrentes no site;
- testou a equivalência das variantes;
- recomendou manter, ajustar ou descartar.

Das 24 tarefas propostas, 19 entraram no banco (12 nas sessões e 7 como reservas), já com os ajustes do verificador:

- instruções com um único objetivo;
- alvos trocados para eliminar assimetria entre A e B;
- critérios que aceitam fontes equivalentes e marcam fontes divergentes do próprio site.

Ficaram de fora:

- CAPES-4 e CAPES-5: atalho, ou respostas de A e B no mesmo parágrafo;
- uma tarefa de data de publicação no JIS: controle redundante, e a data da página difere em 1 dia da do PDF;
- uma segunda tarefa de patrocinadores: mesma barreira de CSBC-2;
- uma de contagem de autores no EduComp: o efeito dependia de a avaliadora entrar na tabela pela linha certa.

Sites considerados e recusados: CBIE, SBRC, CBSoft, BRACIS, SBBD, BDTD, SciELO, CNPq, UTFPR, UFG, UFSB, UFOPA, Senado, Wikipédia, Fundação Dorina e Portal da Transparência. Os motivos foram pouca mudança no caminho de uma usuária de leitor de tela, conteúdo instável ou JavaScript pesado.

Depois, uma revisão independente conferiu o protocolo contra o código, os dados do Estudo 1 e a verificação, e revisou o delineamento e o formulário. Dela vieram:

- a descrição correta do painel lateral;
- a distribuição das tarefas entre os grupos e a troca de variantes em CSBC-2 e CAPES-2;
- o teto em tempo líquido;
- a separação entre lembrete e ajuda;
- as validações e a coluna Conferência do formulário;
- as janelas por checagem e os controles negativos do script de conferência.
