import sys, json, hashlib, re, subprocess, html
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, sys.argv[1]); import candidatas as C
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36"
def fetch(url):
    try:
        r=subprocess.run(["curl","-sL","-A",UA,"--max-time","25","-o","-","-w","\n@@%{http_code}@@%{url_effective}@@","-H","Accept-Language: pt-BR,pt;q=0.9",url],capture_output=True,text=True,errors="replace")
        body,_,tail=r.stdout.rpartition("\n@@"); parts=tail.split("@@")
        return {"status":parts[0] if parts[0] else "000","final":parts[1] if len(parts)>1 else "","body":body}
    except Exception as e: return {"status":"000","final":"","body":"","erro":str(e)}
PRIO=[r"gradua", r"ingress|vestibular|sele[çc][ãa]o|inscri", r"edital|editais", r"biblioteca", r"submiss|chamada|call", r"curso", r"servi[çc]o", r"sobre|institucional|quem somos"]
def discover(home, body):
    links=re.findall(r'<a\s[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', body, re.I|re.S)
    from urllib.parse import urljoin, urlparse
    hd=urlparse(home).netloc.replace("www.","")
    cands=[]
    for href,txt in links:
        u=urljoin(home,href); t=re.sub(r"<[^>]+>","",html.unescape(txt)).strip()
        if urlparse(u).netloc.replace("www.","")!=hd or u.rstrip("/")==home.rstrip("/") or re.search(r"\.(pdf|jpg|png|zip|docx?)$",u,re.I) or "mailto:" in u: continue
        cands.append((u,t))
    for p in PRIO:
        for u,t in cands:
            if re.search(p,t+" "+u,re.I): return u
    return cands[0][0] if cands else None
def check_site(sigla, home, task, estrato, extra=None):
    h=fetch(home); out={"estrato":estrato,"sigla":sigla,"home":home,"home_status":h["status"],"home_final":h["final"],"home_bytes":len(h["body"])}
    if extra: out.update(extra)
    sus = bool(re.search(r"cloudflare|cf-chl|captcha|just a moment|verifique que você", h["body"][:20000], re.I))
    out["desafio"]=sus
    t=task
    if t:
        tr=fetch(t)
        if not tr["status"].startswith("2"): t=None
        else: out.update({"task":t,"task_status":tr["status"],"task_final":tr["final"]})
    if not t and h["status"].startswith("2"):
        d=discover(h["final"] or home, h["body"])
        if d:
            tr=fetch(d); out.update({"task":d,"task_status":tr["status"],"task_final":tr["final"],"task_descoberta":True})
    return out
def rank(seed, key): return hashlib.sha256(f"{seed}|{key}".encode()).hexdigest()
jobs=[]
for s,h,t in C.A: jobs.append((s,h,t,"A"))
for s,h,t in C.B: jobs.append((s,h,t,"B"))
# C: 2 por região por ordem de sha256(seed|sigla), + UTFPR fixa
porreg={}
for sig,dom,reg in C.IFES:
    if sig=="UTFPR": continue
    porreg.setdefault(reg,[]).append((rank(C.SEED,sig),sig,dom))
ordemC={}
for reg,l in porreg.items():
    l.sort(); ordemC[reg]=[(sig,dom) for _,sig,dom in l]
    for sig,dom in ordemC[reg][:4]:  # 2 titulares + 2 reservas verificadas
        jobs.append((sig,f"https://www.{dom}/",None,"C",{"regiao":reg,"ordem":ordemC[reg].index((sig,dom))+1}))
jobs.append(("UTFPR","https://www.utfpr.edu.br/",None,"C",{"regiao":"S","ordem":0,"fixa":True}))
for s,h,t in C.D_FIXOS: jobs.append((s,h,t,"D"))
ev=sorted(C.D_EVENTOS,key=lambda e: rank(C.SEED,e[0]))
for i,(s,h) in enumerate(ev): jobs.append((s,h,None,"D-evento",{"ordem":i+1}))
ec=sorted(C.E_CAND,key=lambda e: rank(C.SEED,e[0]))
for i,(s,h,t) in enumerate(ec): jobs.append((s,h,t,"E",{"ordem":i+1}))
for i,(s,h,t) in enumerate(C.F_CAND): jobs.append((s,h,t,"F",{"ordem":i+1}))
for s,h in C.CONTROLE: jobs.append((s,h,None,"controle"))
def run(j): return check_site(*j) if len(j)==5 else check_site(*j[:4])
with ThreadPoolExecutor(8) as ex: res=list(ex.map(run,jobs))
json.dump(res,open(sys.argv[2],"w"),ensure_ascii=False,indent=1)
for r in res:
    print(f"{r['estrato']:9} {r.get('ordem','-')!s:>2} {r['sigla'][:22]:22} home={r['home_status']} {'DESAFIO ' if r['desafio'] else ''}{r['home_bytes']//1000}kB task={r.get('task_status','-')} {('(desc) ' if r.get('task_descoberta') else '')}{(r.get('task') or '')[:70]}")
