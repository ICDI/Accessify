# Candidatas por estrato. (sigla, home, página de tarefa sugerida ou None, regiao/nota)
SEED = "accessify-jis-2026"

A = [  # originais do SEMISH (confirmar URLs exatas com a tabela do artigo)
 ("CSBC 2026", "https://csbc.sbc.org.br/2026/", None),
 ("CAPES", "https://www.gov.br/capes/pt-br", "https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas"),
 ("IHC 2025", "https://ihc.sbc.org.br/2025/", None),
 ("CBIE 2025", "https://cbie.sbc.org.br/2025/", None),
 ("BRACIS 2026", "https://bracis.sbc.org.br/2026/", None),
 ("SBC OpenLib", "https://sol.sbc.org.br/", "https://sol.sbc.org.br/index.php/indice"),
 ("IBC", "https://www.gov.br/ibc/pt-br", "https://www.gov.br/ibc/pt-br/acesso-a-informacao/institucional"),
 ("Escola Virtual Gov", "https://www.escolavirtual.gov.br/", "https://www.escolavirtual.gov.br/catalogo"),
 ("CBSoft 2026", "https://cbsoft.sbc.org.br/2026/", None),
 ("EduComp 2026", "https://educomp.sbc.org.br/2026/", None),
]
B = [  # ingresso, fomento, serviços
 ("gov.br", "https://www.gov.br/pt-br", "https://www.gov.br/pt-br/servicos"),
 ("MEC", "https://www.gov.br/mec/pt-br", "https://www.gov.br/mec/pt-br/acesso-a-informacao/institucional"),
 ("INEP", "https://www.gov.br/inep/pt-br", "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem"),
 ("Acesso Único MEC", "https://acessounico.mec.gov.br/", "https://acessounico.mec.gov.br/sisu"),
 ("CNPq", "https://www.gov.br/cnpq/pt-br", "https://www.gov.br/cnpq/pt-br/acesso-a-informacao/acoes-e-programas/programas/bolsas-no-pais"),
 ("FNDE", "https://www.gov.br/fnde/pt-br", "https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas"),
 ("Lattes", "https://lattes.cnpq.br/", "https://lattes.cnpq.br/web/plataforma-lattes/sobre-a-plataforma"),
 ("Sucupira", "https://sucupira.capes.gov.br/", None),
 ("INSS", "https://www.gov.br/inss/pt-br", "https://www.gov.br/inss/pt-br/direitos-e-deveres/beneficios-assistenciais/beneficio-assistencial-a-pessoa-com-deficiencia-bpc"),
 ("MDHC", "https://www.gov.br/mdh/pt-br", "https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia"),
 ("Planalto legislação", "https://www.planalto.gov.br/ccivil_03/", "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm"),
 ("Câmara dos Deputados", "https://www.camara.leg.br/", "https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada"),
]
# Universidades federais (quadro: lista de IFES do MEC). (sigla, dominio, regiao)
IFES = [
 ("UFAC","ufac.br","N"),("UFAM","ufam.edu.br","N"),("UFPA","ufpa.br","N"),("UFRA","ufra.edu.br","N"),("UFOPA","ufopa.edu.br","N"),
 ("UNIFESSPA","unifesspa.edu.br","N"),("UFRR","ufrr.br","N"),("UFT","ufnt.edu.br","N"),("UNIR","unir.br","N"),("UNIFAP","unifap.br","N"),("UFT-TO","ufnt.edu.br","N"),
 ("UFAL","ufal.br","NE"),("UFBA","ufba.br","NE"),("UFRB","ufrb.edu.br","NE"),("UFOB","ufob.edu.br","NE"),("UFSB","ufsb.edu.br","NE"),("UFC","ufc.br","NE"),
 ("UFCA","ufca.edu.br","NE"),("UNILAB","unilab.edu.br","NE"),("UFMA","ufma.br","NE"),("UFPB","ufpb.br","NE"),("UFCG","ufcg.edu.br","NE"),("UFPE","ufpe.br","NE"),
 ("UFRPE","ufrpe.br","NE"),("UNIVASF","univasf.edu.br","NE"),("UFAPE","ufape.edu.br","NE"),("UFPI","ufpi.br","NE"),("UFDPar","ufdpar.edu.br","NE"),("UFRN","ufrn.br","NE"),
 ("UFERSA","ufersa.edu.br","NE"),("UFS","ufs.br","NE"),
 ("UnB","unb.br","CO"),("UFG","ufg.br","CO"),("UFCAT","ufcat.edu.br","CO"),("UFJ","ufj.edu.br","CO"),("UFMT","ufmt.br","CO"),("UFR","ufr.edu.br","CO"),("UFMS","ufms.br","CO"),("UFGD","ufgd.edu.br","CO"),
 ("UFES","ufes.br","SE"),("UFMG","ufmg.br","SE"),("UFJF","ufjf.br","SE"),("UFLA","ufla.br","SE"),("UFOP","ufop.br","SE"),("UFSJ","ufsj.edu.br","SE"),("UFTM","uftm.edu.br","SE"),
 ("UFU","ufu.br","SE"),("UFV","ufv.br","SE"),("UFVJM","ufvjm.edu.br","SE"),("UNIFAL","unifal-mg.edu.br","SE"),("UNIFEI","unifei.edu.br","SE"),("UFRJ","ufrj.br","SE"),
 ("UFF","uff.br","SE"),("UFRRJ","ufrrj.br","SE"),("UNIRIO","unirio.br","SE"),("UFABC","ufabc.edu.br","SE"),("UFSCar","ufscar.br","SE"),("UNIFESP","unifesp.br","SE"),
 ("UFPR","ufpr.br","S"),("UTFPR","utfpr.edu.br","S"),("UNILA","unila.edu.br","S"),("UFSC","ufsc.br","S"),("UFFS","uffs.edu.br","S"),("UFRGS","ufrgs.br","S"),
 ("UFSM","ufsm.br","S"),("UFPel","ufpel.edu.br","S"),("FURG","furg.br","S"),("UNIPAMPA","unipampa.edu.br","S"),("UFCSPA","ufcspa.edu.br","S"),
]
D_FIXOS = [
 ("SBC", "https://www.sbc.org.br/", None),
 ("JIS (SOL)", "https://journals-sol.sbc.org.br/index.php/jis", "https://journals-sol.sbc.org.br/index.php/jis/about/submissions"),
 ("SciELO", "https://www.scielo.br/", "https://www.scielo.br/journals/alpha"),
 ("Periódicos CAPES", "https://www.periodicos.capes.gov.br/", None),
 ("BDTD IBICT", "https://bdtd.ibict.br/", "https://bdtd.ibict.br/vufind/Search/Advanced"),
]
D_EVENTOS = [  # eventos SBC 2026 (quadro: calendário SBC); sorteio de 3
 ("SBRC 2026", "https://sbrc.sbc.org.br/2026/"), ("SBBD 2026", "https://sbbd.sbc.org.br/2026/"),
 ("WebMedia 2026", "https://webmedia.sbc.org.br/2026/"), ("SBSI 2026", "https://sbsi.sbc.org.br/2026/"),
 ("SBGames 2026", "https://www.sbgames.org/"), ("SIBGRAPI 2026", "https://sibgrapi.sbc.org.br/2026/"),
 ("SBSeg 2026", "https://sbseg.sbc.org.br/2026/"), ("SBCUP 2026", "https://sbcup.sbc.org.br/2026/"),
 ("ERAD 2026", "https://erad.sbc.org.br/2026/"), ("SBPO", "https://www.sobrapo.org.br/"),
]
E_CAND = [  # conteúdo educacional; sorteio de 4 entre as que respondem
 ("Domínio Público", "http://www.dominiopublico.gov.br/", None),
 ("AVAMEC", "https://avamec.mec.gov.br/", None),
 ("Portal do Professor", "http://portaldoprofessor.mec.gov.br/", None),
 ("BN Digital", "https://bndigital.bn.gov.br/", None),
 ("Wikipédia pt", "https://pt.wikipedia.org/", "https://pt.wikipedia.org/wiki/Acessibilidade"),
 ("Brasil Escola", "https://brasilescola.uol.com.br/", None),
 ("Toda Matéria", "https://www.todamateria.com.br/", None),
 ("InfoEscola", "https://www.infoescola.com/", None),
 ("Mundo Educação", "https://mundoeducacao.uol.com.br/", None),
 ("Khan Academy pt", "https://pt.khanacademy.org/", None),
 ("Educa Mais Brasil", "https://www.educamaisbrasil.com.br/", None),
 ("Nova Escola", "https://novaescola.org.br/", None),
]
F_CAND = [  # referência em acessibilidade; 4 primeiras que respondem
 ("Fundação Dorina Nowill", "https://fundacaodorina.org.br/", None),
 ("Laramara", "https://laramara.org.br/", None),
 ("Web para Todos", "https://mwpt.com.br/", None),
 ("eMAG", "https://emag.governoeletronico.gov.br/", None),
 ("Acessibilidade Brasil", "http://www.acessibilidadebrasil.org.br/", None),
 ("W3C Brasil / Ceweb", "https://www.w3c.br/", None),
 ("Bengala Legal", "http://www.bengalalegal.com/", None),
]
CONTROLE = [
 ("W3C BAD before", "https://www.w3.org/WAI/demos/bad/before/home.html"),
 ("W3C BAD after", "https://www.w3.org/WAI/demos/bad/after/home.html"),
]
