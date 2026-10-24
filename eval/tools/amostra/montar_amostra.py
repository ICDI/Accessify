import re, subprocess, html, csv, os, hashlib
from concurrent.futures import ThreadPoolExecutor
REPO="/home/marlon-marcon/workspace/Accessify"; SEED="accessify-jis-2026"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36"
def fetch(url):
    r=subprocess.run(["curl","-sL","-A",UA,"--max-time","40","--http1.1","-o","-","-w","\n@@%{http_code}@@%{url_effective}@@","-H","Accept-Language: pt-BR,pt;q=0.9",url],capture_output=True,text=True,errors="replace")
    body,_,tail=r.stdout.rpartition("\n@@"); p=tail.split("@@"); return p[0] or "000",(p[1] if len(p)>1 else ""),body
def texto(b):
    b=re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>","",b,flags=re.S|re.I); return len(html.unescape(re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",b))).strip())
# (estrato, sigla, nome, home, tarefa, nota)
SITES=[
("A","CSBC 2026","Congresso da SBC 2026","https://csbc.sbc.org.br/2026/","https://csbc.sbc.org.br/2026/inscricoes/",""),
("A","CAPES","Portal da CAPES","https://www.gov.br/capes/pt-br","https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas",""),
("A","IHC 2025","Simpósio IHC 2025","https://ihc.sbc.org.br/2025/","https://ihc.sbc.org.br/2025/index.php/inscricoes/",""),
("A","CBIE 2025","Congresso Brasileiro de Informática na Educação 2025","https://cbie.sbc.org.br/2025/","https://cbie.sbc.org.br/2025/inscricoes/",""),
("A","BRACIS 2026","Brazilian Conference on Intelligent Systems 2026","https://bracis.sbc.org.br/2026/","https://bracis.sbc.org.br/2026/bracis/",""),
("A","SOL","SBC OpenLib","https://sol.sbc.org.br/","https://sol.sbc.org.br/index.php/semish","a inicial redireciona para /index.php/indice"),
("A","IBC","Instituto Benjamin Constant","https://www.gov.br/ibc/pt-br","https://www.gov.br/ibc/pt-br/acesso-a-informacao/institucional",""),
("A","CBSoft 2026","Congresso Brasileiro de Software 2026","https://cbsoft.sbc.org.br/2026/","https://cbsoft.sbc.org.br/2026/pt/registration",""),
("A","EduComp 2026","Simpósio Brasileiro de Educação em Computação 2026","https://educomp.sbc.org.br/2026/","https://educomp.sbc.org.br/2026/educomp/inscricoes/index.html",""),
("B","gov.br","Portal gov.br","https://www.gov.br/pt-br","https://www.gov.br/pt-br/servicos",""),
("B","MEC","Ministério da Educação","https://www.gov.br/mec/pt-br/","https://www.gov.br/mec/pt-br/assuntos","sem a barra final o servidor devolve página vazia"),
("B","INEP","INEP","https://www.gov.br/inep/pt-br","https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem",""),
("B","CNPq","CNPq","https://www.gov.br/cnpq/pt-br","https://www.gov.br/cnpq/pt-br/chamadas/abertas-para-submissao",""),
("B","FNDE","FNDE","https://www.gov.br/fnde/pt-br","https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas",""),
("B","INSS","INSS","https://www.gov.br/inss/pt-br","https://www.gov.br/inss/pt-br/direitos-e-deveres/beneficios-assistenciais",""),
("B","MDHC","Ministério dos Direitos Humanos e da Cidadania","https://www.gov.br/mdh/pt-br","https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia",""),
("B","Planalto","Legislação federal (Planalto)","https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm","https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm","a página inicial do portal de legislação é um índice em frames com pouco texto; usam-se duas leis (LBI e Constituição)"),
("B","Câmara","Câmara dos Deputados","https://www.camara.leg.br/","https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada",""),
("B","ProUni","Portal do ProUni","https://prouniportal.mec.gov.br/","https://prouniportal.mec.gov.br/tire-suas-duvidas-pesquisa/processo-seletivo",""),
("B","Transparência","Portal da Transparência","https://portaldatransparencia.gov.br/","https://portaldatransparencia.gov.br/transferencias",""),
("B","Senado","Senado Federal","https://www12.senado.leg.br/hpsenado","https://www12.senado.leg.br/institucional/biblioteca",""),
("B","BN","Biblioteca Nacional","https://www.gov.br/bn/pt-br","https://www.gov.br/bn/pt-br/servicos","1ª reserva do estrato B, incluída para fechar 100 páginas"),
("C","UNIFAP","Universidade Federal do Amapá (N, 2º no sorteio)","https://www.unifap.br/","https://www.unifap.br/graduacao/",""),
("C","UFOPA","Universidade Federal do Oeste do Pará (N, 3º)","https://www.ufopa.edu.br/","https://www.ufopa.edu.br/ufopa/institucional/pro-reitorias/proen/",""),
("C","UFSB","Universidade Federal do Sul da Bahia (NE, 1º)","https://www.ufsb.edu.br/","https://www.ufsb.edu.br/ensino/graduacao",""),
("C","UFRB","Universidade Federal do Recôncavo da Bahia (NE, 2º)","https://ufrb.edu.br/portal/","https://ufrb.edu.br/portal/curso-de-graduacao",""),
("C","UnB","Universidade de Brasília (CO, 2º)","https://unb.br/","https://unb.br/vida-academica/graduacao",""),
("C","UFG","Universidade Federal de Goiás (CO, 3º)","https://www.ufg.br/","https://sistemas.institutoverbena.ufg.br/2026/vestibular-ufg/","página de tarefa em subdomínio da própria UFG (ingresso)"),
("C","UFES","Universidade Federal do Espírito Santo (SE, 1º)","https://www.ufes.br/","https://www.ufes.br/cursos-de-graduacao",""),
("C","UFJF","Universidade Federal de Juiz de Fora (SE, 2º)","https://www2.ufjf.br/","https://www2.ufjf.br/ufjf/ensino/graduacao/",""),
("C","UFSM","Universidade Federal de Santa Maria (S, 1º)","https://www.ufsm.br/","https://www.ufsm.br/graduacao",""),
("C","UNILA","Universidade Federal da Integração Latino-Americana (S, 2º)","https://portal.unila.edu.br/","https://portal.unila.edu.br/graduacao","unila.edu.br sem 'portal.' responde 404"),
("C","UTFPR","Universidade Tecnológica Federal do Paraná (fixa: instituição dos autores)","https://www.utfpr.edu.br/","https://www.utfpr.edu.br/cursos/graduacao",""),
("D","SBC","Sociedade Brasileira de Computação","https://www.sbc.org.br/","https://www.sbc.org.br/eventos/",""),
("D","JIS","Journal on Interactive Systems (SOL)","https://journals-sol.sbc.org.br/index.php/jis","https://journals-sol.sbc.org.br/index.php/jis/about/submissions",""),
("D","SciELO","SciELO Brasil","https://www.scielo.br/","https://www.scielo.br/journals/alpha",""),
("D","Periódicos CAPES","Portal de Periódicos da CAPES","https://www.periodicos.capes.gov.br/","https://www.periodicos.capes.gov.br/index.php/acervo/lista-a-z-periodicos.html",""),
("D","BDTD","Biblioteca Digital Brasileira de Teses e Dissertações","https://bdtd.ibict.br/vufind/","https://bdtd.ibict.br/vufind/about/home","bdtd.ibict.br redireciona por script; a inicial real é /vufind/"),
("D","SBRC 2026","Simpósio Brasileiro de Redes de Computadores 2026 (evento, 3º no sorteio)","https://sbrc.sbc.org.br/2026/","https://sbrc.sbc.org.br/2026/inscricoes/",""),
("D","SBPO","Sociedade Brasileira de Pesquisa Operacional (evento, 7º)","https://www.sobrapo.org.br/","https://www.sobrapo.org.br/modalidades-e-beneficios",""),
("D","SBSI 2026","Simpósio Brasileiro de Sistemas de Informação 2026 (evento, 8º)","https://sbsi.sbc.org.br/2026/","https://sbsi.sbc.org.br/2026/chamada-pesquisa.php",""),
("E","Toda Matéria","Toda Matéria (1º no sorteio)","https://www.todamateria.com.br/","https://www.todamateria.com.br/matematica/",""),
("E","Nova Escola","Nova Escola (2º)","https://novaescola.org.br/","https://novaescola.org.br/planos-de-aula/recursoseducacionaisdigitais",""),
("E","Mundo Educação","Mundo Educação (6º)","https://mundoeducacao.uol.com.br/","https://vestibular.mundoeducacao.uol.com.br","página de tarefa em subdomínio do próprio site"),
("E","Brasil Escola","Brasil Escola (8º)","https://brasilescola.uol.com.br/","https://vestibular.brasilescola.uol.com.br","página de tarefa em subdomínio do próprio site"),
("F","Dorina","Fundação Dorina Nowill para Cegos","https://fundacaodorina.org.br/","https://fundacaodorina.org.br/servicos-de-apoio-a-inclusao/",""),
("F","Laramara","Laramara","https://laramara.org.br/","https://laramara.org.br/e-books/",""),
("F","Web para Todos","Movimento Web para Todos","https://mwpt.com.br/","https://mwpt.com.br/biblioteca/",""),
("F","eMAG","Modelo de Acessibilidade em Governo Eletrônico","https://emag.governoeletronico.gov.br/","https://emag.governoeletronico.gov.br/recomendacao-002.php",""),
]
CONTROLE=[("controle","W3C BAD before","Demo W3C Before and After, versão inacessível","https://www.w3.org/WAI/demos/bad/before/home.html"),
          ("controle","W3C BAD after","Demo W3C Before and After, versão corrigida","https://www.w3.org/WAI/demos/bad/after/home.html")]
EXCLUIDAS=[  # (estrato, sigla, url, motivo)
("A","Escola Virtual Gov","https://www.escolavirtual.gov.br/","conteúdo só por JavaScript (20 caracteres de texto sem scripts); o replay roda sem scripts"),
("B","Acesso Único MEC (Sisu/ProUni/Fies)","https://acessounico.mec.gov.br/","aplicação de página única (41 caracteres sem scripts)"),
("B","Sisu","https://sisu.mec.gov.br/","aplicação de página única (96 caracteres)"),("B","FIES","https://fies.mec.gov.br/","sem resposta (DNS/TLS)"),
("B","Lattes","https://lattes.cnpq.br/","conteúdo só por JavaScript (97 caracteres)"),("B","Sucupira","https://sucupira.capes.gov.br/","aplicação de página única (19 caracteres)"),
("B","ENEM (enem.inep.gov.br)","https://enem.inep.gov.br/","redireciona para a página do ENEM no INEP, já na amostra"),("B","IBGE","https://www.ibge.gov.br/","403 (bloqueio anti-bot)"),
("C","UFRA (N, 1º)","https://www.ufra.edu.br/","página inicial sem texto fora de scripts"),("C","UFPA (N, 4º, reserva)","https://www.ufpa.br/","sem resposta no domínio principal; portal.ufpa.br responde (reserva)"),
("C","UFCAT (CO, 1º)","https://www.ufcat.edu.br/","conteúdo só por JavaScript (472 caracteres)"),("C","UFJ (CO, 4º)","https://www.ufj.edu.br/","conteúdo só por JavaScript (118 caracteres)"),
("D","SBSeg 2026 (1º)","https://sbseg.sbc.org.br/2026/","404"),("D","SIBGRAPI 2026 (2º)","https://sibgrapi.sbc.org.br/2026/","página inicial sem conteúdo (13 caracteres)"),
("D","ERAD 2026 (4º)","https://erad.sbc.org.br/2026/","sem resposta"),("D","WebMedia 2026 (5º)","https://webmedia.sbc.org.br/2026/","403"),
("D","SBGames (6º)","https://www.sbgames.org/","sem página de tarefa identificável pela regra (único link interno candidato devolve 404)"),
("E","Educa Mais Brasil (3º)","https://www.educamaisbrasil.com.br/","conteúdo só por JavaScript (60 caracteres)"),("E","Domínio Público (4º)","http://www.dominiopublico.gov.br/","403 (bloqueio anti-bot)"),
("E","AVAMEC (5º)","https://avamec.mec.gov.br/","aplicação de página única (40 caracteres)"),("E","BN Digital (7º)","https://bndigital.bn.gov.br/","403 (bloqueio anti-bot)"),
]
RESERVAS=[("B","Receita Federal","https://www.gov.br/receitafederal/pt-br"),("C","UFPA (N) portal","https://portal.ufpa.br/"),("C","UFOB (NE, 3º)","https://ufob.edu.br/"),("C","UFMS (CO, 5º)","https://www.ufms.br/"),("C","UNIFEI (SE, 3º)","https://unifei.edu.br/"),("C","UFPel (S, 3º)","https://portal.ufpel.edu.br/"),("D","SBBD 2026 (9º)","https://sbbd.org.br/2026/"),("E","InfoEscola (11º)","https://www.infoescola.com/"),("E","Wikipédia pt (10º)","https://pt.wikipedia.org/"),("F","Acessibilidade Brasil (5º)","http://www.acessibilidadebrasil.org.br/"),("F","W3C Brasil / Ceweb (6º)","https://www.w3c.br/")]
# verificação final de todas as 100 URLs
paginas=[]
for e,sig,nome,home,tarefa,nota in SITES: paginas+= [(e,sig,"inicial",home),(e,sig,"tarefa",tarefa)]
for e,sig,nome,url in CONTROLE: paginas.append((e,sig,"controle",url))
assert len(paginas)==100, len(paginas)
assert len({p[3] for p in paginas})==100
with ThreadPoolExecutor(8) as ex: res=list(ex.map(lambda p: fetch(p[3]), paginas))
os.makedirs(f"{REPO}/docs/evidencias/amostra",exist_ok=True)
with open(f"{REPO}/docs/evidencias/amostra/2026-10-24-verificacao.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["estrato","sigla","papel","url","status_http","url_final","texto_sem_scripts_chars","html_bytes","decisao"])
    for (e,sig,papel,url),(s,fin,b) in zip(paginas,res): w.writerow([e,sig,papel,url,s,fin,texto(b),len(b.encode('utf-8','replace')),"incluída"])
    for e,sig,url,motivo in EXCLUIDAS: w.writerow([e,sig,"candidata",url,"","","","",f"excluída: {motivo}"])
    for e,sig,url in RESERVAS: w.writerow([e,sig,"reserva",url,"","","","","reserva"])
ruins=[(p,s) for p,(s,_,_) in zip(paginas,res) if not s.startswith("2")]
print("não-2xx na verificação final:", ruins)
# urls.csv
smoke={"https://www.w3.org/WAI/demos/bad/before/home.html","https://www.utfpr.edu.br/","https://www.gov.br/pt-br"}
with open(f"{REPO}/eval/urls.csv","w",newline="") as f:
    w=csv.writer(f,lineterminator="\n"); w.writerow(["url","estrato"])
    for e,sig,papel,url in paginas:
        w.writerow([url,"amostra"])
        if e=="controle": w.writerow([url,"controle"])
        if url in smoke: w.writerow([url,"smoke"])
# tabelas markdown para o protocolo
def tab_sites():
    out=["| Estrato | Site | Página inicial | Página de tarefa | Observação |","|---|---|---|---|---|"]
    for e,sig,nome,home,tarefa,nota in SITES: out.append(f"| {e} | {nome} | {home} | {tarefa} | {nota} |")
    for e,sig,nome,url in CONTROLE: out.append(f"| controle | {nome} | {url} | — | controle do harness, sem página de tarefa |")
    return "\n".join(out)
def tab_exc(): return "\n".join(["| Estrato | Candidata | URL | Motivo |","|---|---|---|---|"]+[f"| {e} | {s} | {u} | {m} |" for e,s,u,m in EXCLUIDAS])
def tab_res(): return "\n".join(["| Estrato | Reserva (ordem) | URL |","|---|---|---|"]+[f"| {e} | {s} | {u} |" for e,s,u in RESERVAS])
open("/tmp/claude-1000/-home-marlon-marcon-workspace-Accessify/60fb8943-d2a7-4d41-aa8b-6d6e0bf7b8f5/scratchpad/amostra/tabelas.md","w").write(tab_sites()+"\n\n@@EXC@@\n"+tab_exc()+"\n\n@@RES@@\n"+tab_res())
from collections import Counter; print(Counter(p[0] for p in paginas)); print("sites:",len(SITES))
