# Critério de amostragem das páginas do Estudo 1 (JIS 2026)

Versão de 24/10/2026. Define como as 100 páginas de `eval/urls.csv` foram escolhidas, para que a seleção seja reproduzível e defensável no artigo. Evidência da verificação: `docs/evidencias/amostra/2026-10-24-verificacao.csv`. Scripts: `eval/tools/amostra/`.

## 1. Objetivo e população

A extensão Accessify é dirigida a estudantes cegos e com baixa visão. A população de interesse são as páginas públicas brasileiras que esses estudantes precisam usar na vida acadêmica: ingresso e financiamento, portais de universidades, bibliotecas e periódicos, inscrição e submissão em eventos científicos, serviços públicos ligados à pessoa com deficiência e conteúdo de estudo.

## 2. Critérios de inclusão

Uma página entra na amostra se atende aos quatro filtros:

1. **Relevância para a população** (seção 1): pertence a um dos estratos da seção 3.
2. **Dever legal de acessibilidade**: sítios de órgãos públicos e de empresas com sede no Brasil estão obrigados pela Lei Brasileira de Inclusão (Lei 13.146/2015, art. 63). Isso torna a avaliação um recorte justo e verificável, e não uma escolha de "sites ruins".
3. **Viabilidade técnica no harness**: a página precisa renderizar seu conteúdo no servidor, sem login, sem CAPTCHA ou desafio anti-bot, porque o replay do harness roda com scripts desligados (`eval/README.md`, seção Snapshots). Pré-filtro reproduzível: resposta HTTP 2xx a uma requisição `curl` com User-Agent de navegador e **pelo menos 1 000 caracteres de texto visível fora de `<script>`, `<style>` e `<noscript>`** na página inicial. O árbitro final é a captura: um snapshot marcado `suspeito` no `index.csv` exclui a página.
4. **Diversidade tecnológica**: a amostra como um todo deve conter ao menos um representante das famílias comuns no setor (Plone do padrão gov.br, WordPress, Joomla, Drupal, OJS/SOL, VuFind, sistemas próprios). Verificado após a seleção, sem substituições dirigidas.

## 3. Estratos, quadros de referência e regra de seleção

| Estrato | Quadro de referência | Regra |
|---|---|---|
| A. Originais do SEMISH | os 10 sites avaliados no artigo original | todos, por comparabilidade com a v1 |
| B. Ingresso, fomento e serviços | órgãos federais de educação, ciência e assistência (gov.br, MEC, INEP, CNPq, FNDE, INSS, MDHC, legislação federal, Câmara, Senado, ProUni, Transparência) | todos os que passam no filtro 3; reservas na ordem listada |
| C. Universidades federais | lista das universidades federais (quadro em `eval/tools/amostra/candidatas.py`, `IFES`, com região) | 2 por região geográfica, na ordem de `sha256("accessify-jis-2026|SIGLA")`, mais a UTFPR (instituição dos autores, fixa) |
| D. Ciência e publicação | SBC, JIS, SciELO, Portal de Periódicos CAPES, BDTD (fixos) + eventos da SBC em 2026 | fixos todos; 3 eventos na ordem do mesmo sorteio |
| E. Conteúdo de estudo | portais educacionais de alcance nacional | 4 na ordem do mesmo sorteio |
| F. Referência em acessibilidade | organizações da área (Dorina Nowill, Laramara, Web para Todos, eMAG, ...) | os 4 primeiros da lista que passam no filtro 3 |
| Controle | demo "Before and After" da W3C | as duas versões, como controle positivo e negativo do harness |

Semente do sorteio: `accessify-jis-2026`. A ordem de cada candidata é o SHA-256 da string `semente|nome`, em ordem crescente, o que qualquer pessoa reproduz sem software específico.

**Duas páginas por site**: a inicial e uma página de tarefa. A página de tarefa é o primeiro link interno da inicial cujo texto casa, nesta prioridade, com graduação; ingresso, vestibular, processo seletivo ou inscrição; editais; biblioteca, acervo ou catálogo; chamada ou submissão; cursos ou disciplinas; serviços ou benefícios; institucional. Links de notícias, agenda, login e arquivos são ignorados, e a página precisa responder 2xx com ao menos 1 000 caracteres de texto. Quando a regra não encontra nada, ou encontra uma página claramente fora do propósito (por exemplo, uma notícia), a escolha manual fica registrada na coluna Observação da tabela da seção 5 e no CSV de evidência.

**Tamanho**: 49 sites × 2 páginas + 2 páginas de controle = 100. Quando um estrato não fecha a cota por exclusões, a primeira reserva do estrato B completa, depois C, D, E, F.

## 4. Exclusão e reposição

Uma candidata é excluída quando falha no filtro 3 (sem resposta, 403/404, conteúdo só por JavaScript) ou quando não tem página de tarefa pela regra. A próxima da lista de reserva do mesmo estrato, na ordem do sorteio, entra no lugar. Toda exclusão fica registrada com o motivo (seção 6), e as exclusões viram parte da seção de ameaças à validade: a amostra sub-representa aplicações de página única, que o harness e a POC não tratam.

## 5. Páginas selecionadas (100)

| Estrato | Site | Página inicial | Página de tarefa | Observação |
|---|---|---|---|---|
| A | Congresso da SBC 2026 | https://csbc.sbc.org.br/2026/ | https://csbc.sbc.org.br/2026/inscricoes/ |  |
| A | Portal da CAPES | https://www.gov.br/capes/pt-br | https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas |  |
| A | Simpósio IHC 2025 | https://ihc.sbc.org.br/2025/ | https://ihc.sbc.org.br/2025/index.php/inscricoes/ |  |
| A | Congresso Brasileiro de Informática na Educação 2025 | https://cbie.sbc.org.br/2025/ | https://cbie.sbc.org.br/2025/inscricoes/ |  |
| A | Brazilian Conference on Intelligent Systems 2026 | https://bracis.sbc.org.br/2026/ | https://bracis.sbc.org.br/2026/bracis/ |  |
| A | SBC OpenLib | https://sol.sbc.org.br/ | https://sol.sbc.org.br/index.php/semish | a inicial redireciona para /index.php/indice |
| A | Instituto Benjamin Constant | https://www.gov.br/ibc/pt-br | https://www.gov.br/ibc/pt-br/acesso-a-informacao/institucional |  |
| A | Congresso Brasileiro de Software 2026 | https://cbsoft.sbc.org.br/2026/ | https://cbsoft.sbc.org.br/2026/pt/registration |  |
| A | Simpósio Brasileiro de Educação em Computação 2026 | https://educomp.sbc.org.br/2026/ | https://educomp.sbc.org.br/2026/educomp/inscricoes/index.html |  |
| B | Portal gov.br | https://www.gov.br/pt-br | https://www.gov.br/pt-br/servicos |  |
| B | Ministério da Educação | https://www.gov.br/mec/pt-br/ | https://www.gov.br/mec/pt-br/assuntos | sem a barra final o servidor devolve página vazia |
| B | INEP | https://www.gov.br/inep/pt-br | https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem |  |
| B | CNPq | https://www.gov.br/cnpq/pt-br | https://www.gov.br/cnpq/pt-br/chamadas/abertas-para-submissao |  |
| B | FNDE | https://www.gov.br/fnde/pt-br | https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas |  |
| B | INSS | https://www.gov.br/inss/pt-br | https://www.gov.br/inss/pt-br/direitos-e-deveres/beneficios-assistenciais |  |
| B | Ministério dos Direitos Humanos e da Cidadania | https://www.gov.br/mdh/pt-br | https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia |  |
| B | Legislação federal (Planalto) | https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm | https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm | a página inicial do portal de legislação é um índice em frames com pouco texto; usam-se duas leis (LBI e Constituição) |
| B | Câmara dos Deputados | https://www.camara.leg.br/ | https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada |  |
| B | Portal do ProUni | https://prouniportal.mec.gov.br/ | https://prouniportal.mec.gov.br/tire-suas-duvidas-pesquisa/processo-seletivo |  |
| B | Portal da Transparência | https://portaldatransparencia.gov.br/ | https://portaldatransparencia.gov.br/transferencias |  |
| B | Senado Federal | https://www12.senado.leg.br/hpsenado | https://www12.senado.leg.br/institucional/biblioteca |  |
| B | Receita Federal (2ª reserva de B) | https://www.gov.br/receitafederal/pt-br | https://www.gov.br/receitafederal/pt-br/assuntos/meu-cpf | entrou na reposição pós-captura (seção 11) |
| B | Biblioteca Nacional | https://www.gov.br/bn/pt-br | https://www.gov.br/bn/pt-br/servicos | 1ª reserva do estrato B, incluída para fechar 100 páginas |
| C | Universidade Federal do Pará, portal (N, 4º; reserva) | https://portal.ufpa.br/ | https://portal.ufpa.br/index.php/editais-e-bolsas | entrou no lugar da UNIFAP (seção 11) |
| C | Universidade Federal do Oeste do Pará (N, 3º) | https://www.ufopa.edu.br/ | https://www.ufopa.edu.br/ufopa/institucional/pro-reitorias/proen/ |  |
| C | Universidade Federal do Sul da Bahia (NE, 1º) | https://www.ufsb.edu.br/ | https://www.ufsb.edu.br/ensino/graduacao |  |
| C | Universidade Federal do Recôncavo da Bahia (NE, 2º) | https://ufrb.edu.br/portal/ | https://ufrb.edu.br/portal/curso-de-graduacao |  |
| C | Universidade de Brasília (CO, 2º) | https://unb.br/ | https://unb.br/vida-academica/graduacao |  |
| C | Universidade Federal de Goiás (CO, 3º) | https://www.ufg.br/ | https://sistemas.institutoverbena.ufg.br/2026/vestibular-ufg/ | página de tarefa em subdomínio da própria UFG (ingresso) |
| C | Universidade Federal do Espírito Santo (SE, 1º) | https://www.ufes.br/ | https://www.ufes.br/cursos-de-graduacao |  |
| C | Universidade Federal de Juiz de Fora (SE, 2º) | https://www2.ufjf.br/ | https://www2.ufjf.br/ufjf/ensino/graduacao/ |  |
| C | Universidade Federal de Santa Maria (S, 1º) | https://www.ufsm.br/ | https://www.ufsm.br/graduacao |  |
| C | Universidade Federal da Integração Latino-Americana (S, 2º) | https://portal.unila.edu.br/ | https://portal.unila.edu.br/graduacao | unila.edu.br sem 'portal.' responde 404 |
| C | Universidade Tecnológica Federal do Paraná (fixa: instituição dos autores) | https://www.utfpr.edu.br/ | https://www.utfpr.edu.br/cursos/graduacao |  |
| D | Sociedade Brasileira de Computação | https://www.sbc.org.br/ | https://www.sbc.org.br/eventos/ |  |
| D | Journal on Interactive Systems (SOL) | https://journals-sol.sbc.org.br/index.php/jis | https://journals-sol.sbc.org.br/index.php/jis/about/submissions |  |
| D | SciELO Brasil | https://www.scielo.br/ | https://www.scielo.br/journals/alpha |  |
| D | Portal de Periódicos da CAPES | https://www.periodicos.capes.gov.br/ | https://www.periodicos.capes.gov.br/index.php/acervo/lista-a-z-periodicos.html |  |
| D | Biblioteca Digital Brasileira de Teses e Dissertações | https://bdtd.ibict.br/vufind/ | https://bdtd.ibict.br/vufind/about/home | bdtd.ibict.br redireciona por script; a inicial real é /vufind/ |
| D | Simpósio Brasileiro de Redes de Computadores 2026 (evento, 3º no sorteio) | https://sbrc.sbc.org.br/2026/ | https://sbrc.sbc.org.br/2026/inscricoes/ |  |
| D | Sociedade Brasileira de Pesquisa Operacional (evento, 7º) | https://www.sobrapo.org.br/ | https://www.sobrapo.org.br/modalidades-e-beneficios |  |
| D | Simpósio Brasileiro de Banco de Dados 2026 (evento, 9º; reserva) | https://sbbd.org.br/2026/ | https://sbbd.org.br/2026/inscricoes/ | entrou na reposição pós-captura (seção 11) |
| D | Simpósio Brasileiro de Sistemas de Informação 2026 (evento, 8º) | https://sbsi.sbc.org.br/2026/ | https://sbsi.sbc.org.br/2026/chamada-pesquisa.php |  |
| E | Wikipédia em português (10º; reserva) | https://pt.wikipedia.org/ | https://pt.wikipedia.org/wiki/Acessibilidade | página de tarefa manual: a regra casou "Recursos livres" por "cursos" |
| E | Toda Matéria (1º no sorteio) | https://www.todamateria.com.br/ | https://www.todamateria.com.br/matematica/ |  |
| F | Fundação Dorina Nowill para Cegos | https://fundacaodorina.org.br/ | https://fundacaodorina.org.br/servicos-de-apoio-a-inclusao/ |  |
| F | Laramara | https://laramara.org.br/ | https://laramara.org.br/e-books/ |  |
| F | Movimento Web para Todos | https://mwpt.com.br/ | https://mwpt.com.br/biblioteca/ |  |
| F | Modelo de Acessibilidade em Governo Eletrônico | https://emag.governoeletronico.gov.br/ | https://emag.governoeletronico.gov.br/recomendacao-002.php |  |
| controle | Demo W3C Before and After, versão inacessível | https://www.w3.org/WAI/demos/bad/before/home.html | — | controle do harness, sem página de tarefa |
| controle | Demo W3C Before and After, versão corrigida | https://www.w3.org/WAI/demos/bad/after/home.html | — | controle do harness, sem página de tarefa |

## 6. Candidatas excluídas

| Estrato | Candidata | URL | Motivo |
|---|---|---|---|
| A | Escola Virtual Gov | https://www.escolavirtual.gov.br/ | conteúdo só por JavaScript (20 caracteres de texto sem scripts); o replay roda sem scripts |
| B | Acesso Único MEC (Sisu/ProUni/Fies) | https://acessounico.mec.gov.br/ | aplicação de página única (41 caracteres sem scripts) |
| B | Sisu | https://sisu.mec.gov.br/ | aplicação de página única (96 caracteres) |
| B | FIES | https://fies.mec.gov.br/ | sem resposta (DNS/TLS) |
| B | Lattes | https://lattes.cnpq.br/ | conteúdo só por JavaScript (97 caracteres) |
| B | Sucupira | https://sucupira.capes.gov.br/ | aplicação de página única (19 caracteres) |
| B | ENEM (enem.inep.gov.br) | https://enem.inep.gov.br/ | redireciona para a página do ENEM no INEP, já na amostra |
| B | IBGE | https://www.ibge.gov.br/ | 403 (bloqueio anti-bot) |
| C | UFRA (N, 1º) | https://www.ufra.edu.br/ | página inicial sem texto fora de scripts |
| C | UFPA (N, 4º, reserva) | https://www.ufpa.br/ | sem resposta no domínio principal; portal.ufpa.br responde (reserva) |
| C | UFCAT (CO, 1º) | https://www.ufcat.edu.br/ | conteúdo só por JavaScript (472 caracteres) |
| C | UFJ (CO, 4º) | https://www.ufj.edu.br/ | conteúdo só por JavaScript (118 caracteres) |
| D | SBSeg 2026 (1º) | https://sbseg.sbc.org.br/2026/ | 404 |
| D | SIBGRAPI 2026 (2º) | https://sibgrapi.sbc.org.br/2026/ | página inicial sem conteúdo (13 caracteres) |
| D | ERAD 2026 (4º) | https://erad.sbc.org.br/2026/ | sem resposta |
| D | WebMedia 2026 (5º) | https://webmedia.sbc.org.br/2026/ | 403 |
| D | SBGames (6º) | https://www.sbgames.org/ | sem página de tarefa identificável pela regra (único link interno candidato devolve 404) |
| E | Educa Mais Brasil (3º) | https://www.educamaisbrasil.com.br/ | conteúdo só por JavaScript (60 caracteres) |
| E | Domínio Público (4º) | http://www.dominiopublico.gov.br/ | 403 (bloqueio anti-bot) |
| E | AVAMEC (5º) | https://avamec.mec.gov.br/ | aplicação de página única (40 caracteres) |
| E | BN Digital (7º) | https://bndigital.bn.gov.br/ | 403 (bloqueio anti-bot) |

## 7. Reservas (ordem de entrada em caso de snapshot `suspeito`)

| Estrato | Reserva (ordem) | URL |
|---|---|---|
| B | Receita Federal | https://www.gov.br/receitafederal/pt-br |
| C | UFPA (N) portal | https://portal.ufpa.br/ |
| C | UFOB (NE, 3º) | https://ufob.edu.br/ |
| C | UFMS (CO, 5º) | https://www.ufms.br/ |
| C | UNIFEI (SE, 3º) | https://unifei.edu.br/ |
| C | UFPel (S, 3º) | https://portal.ufpel.edu.br/ |
| D | SBBD 2026 (9º) | https://sbbd.org.br/2026/ |
| E | InfoEscola (11º) | https://www.infoescola.com/ |
| E | Wikipédia pt (10º) | https://pt.wikipedia.org/ |
| F | Acessibilidade Brasil (5º) | http://www.acessibilidadebrasil.org.br/ |
| F | W3C Brasil / Ceweb (6º) | https://www.w3c.br/ |

## 8. Subestratos definidos após a coleta

- `visao`: páginas em que a baseline do axe-core acusa **ao menos 1 violação de `image-alt`**. É medido, não escolhido, e é nele que roda a condição `v1.1.0-vision`. Adicionar as linhas `url,visao` ao `urls.csv` depois da baseline, antes das condições com modelo. (Versão inicial do protocolo: ≥ 5. Alterado para ≥ 1 em 24/10/2026, antes de qualquer execução da condição: com ≥ 5 sobravam 6 páginas, e como a extensão descreve no máximo 2 imagens por página no provedor local, o número de descrições avaliáveis depende do número de páginas, não de imagens por página. Resultado: 19 páginas, 110 imagens sem alt.)
- `variancia`: 10 páginas da amostra, sorteadas com a mesma semente dentro de três faixas de tamanho do DOM (`html_bytes` do `index.csv`: terços, 3 + 3 + 4), onde rodam 3 execuções. Adicionar as linhas `url,variancia` após a captura. (Aplicado em 24/10/2026: limites dos terços 123 458 e 273 269 bytes.)

## 9. Ameaças à validade da amostra

- Viés de disponibilidade: sites que bloqueiam robôs ou dependem de JavaScript ficaram de fora (seção 6); o artigo deve dizer isso e não generalizar para SPAs.
- Páginas de tarefa escolhidas por regra textual podem não ser a tarefa mais frequente do estudante; a regra é uniforme entre sites, o que importa para a comparação entre condições.
- Snapshots congelados em uma data: o estudo mede as páginas como estavam em outubro de 2026.
- A UTFPR entra como escolha fixa dos autores; está marcada como tal.

## 10. Reprodução

```bash
python3 -I eval/tools/amostra/verificar_candidatas.py eval/tools/amostra /tmp/relatorio.json   # pré-filtro e sorteio
python3 -I eval/tools/amostra/montar_amostra.py                                                # verificação final, urls.csv e CSV de evidência
```

## 11. Resultado da captura (24/10/2026) e aceite manual

Captura dos 100 snapshots na máquina do lote, com uma retentativa para cada página que falhou ou ficou `suspeito`. Evidência: `docs/evidencias/amostra/2026-10-24-captura.csv`.

| Resultado | Páginas | Decisão |
|---|---|---|
| `ok` na 1ª ou 2ª tentativa | 93 | mantidas |
| timeout de carregamento (45 s) nas duas tentativas: Nova Escola (2), Mundo Educação (2), Brasil Escola (inicial), InfoEscola (tarefa, 1ª reserva de E) | 5 sites | sites excluídos; o estrato E ficou só com a Wikipédia. Os portais comerciais de estudo, carregados de anúncios, não atingem o estado "carregado" no prazo do harness: limitação a declarar |
| `suspeito` por divergência visual com texto idêntico: CSBC 2026 inicial (78% dos pixels: vídeo/imagem de fundo ausente no replay), UNIFAP graduação (28%: cabeçalho não encolhe sem o script), UFOB inicial (41%, reserva) | 3 | CSBC: **aceite manual** (abaixo). UNIFAP: site excluído, entra o portal da UFPA (4º do Norte). UFOB: não usada |

Reposição aplicada, na ordem do protocolo: Wikipédia (E, 10º), Receita Federal (B, reserva), portal da UFPA (C, Norte), SBBD 2026 (D, 9º). Composição final: 49 sites × 2 + 2 controles = 100.

**Aceite manual (decisão D12).** O harness só usa capturas `ok`. Para a página inicial do CSBC 2026, site original do SEMISH, a divergência de 78% dos pixels vem só do fundo do bloco inicial (vídeo ou imagem carregada por script), com 0% de diferença de texto e DOM idêntico. Como axe-core e IBM medem DOM e CSS computado, a captura foi aceita por revisão manual, registrada em `eval/snapshots/aceitos.csv` (URL, sha256 da pasta, justificativa, revisor, data); o run grava o aceite em `observacoes`. Limitação declarada: o contraste calculado pela v1.1.0 sobre imagem de fundo pode diferir nessa página. Nenhum outro suspeito foi aceito.
