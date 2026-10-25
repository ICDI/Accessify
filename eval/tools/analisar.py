#!/usr/bin/env python3
"""Análise do Estudo 1 a partir de eval/results (runs.csv + raw/). Uso:
   python3 -I eval/tools/analisar.py <sessao_passada_1> <sessao_variancia> <pasta_saida>
Gera CSVs e um relatório em Markdown reproduzíveis."""
import csv, json, glob, os, re, sys, statistics as st
from collections import defaultdict, Counter
EVAL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'); REPO=os.path.join(EVAL,'..')
S1, S2, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(OUT, exist_ok=True)
IMP=('critical','serious','moderate','minor'); COND=['v1.0.0','v1.1.0','v1.1.0-fix','v1.1.0-vision']
rows=[r for r in csv.DictReader(open(os.path.join(EVAL,'results/runs.csv')))]
r1=[r for r in rows if r['sessao']==S1]; r2=[r for r in rows if r['sessao']==S2]
tot=lambda r: sum(int(r[f'axe_violations_{k}']) for k in IMP)
def raw(r):
    fs=sorted(glob.glob(os.path.join(EVAL,'results/raw',f"{r['run_id']}__{r['sessao']}__a*.json")))
    return json.load(open(fs[-1])) if fs else None
# estratos
src=open(os.path.join(EVAL,'tools/amostra/montar_amostra.py')).read(); blk=src[src.index('SITES=['):src.index('CONTROLE=[')]
est={}; nome={}
for m in re.finditer(r'^\("([A-F])","([^"]*)","[^"]*","([^"]+)","([^"]+)"',blk,re.M):
    est[m.group(3)]=est[m.group(4)]=m.group(1); nome[m.group(3)]=nome[m.group(4)]=m.group(2)
for u in ['https://www.w3.org/WAI/demos/bad/before/home.html','https://www.w3.org/WAI/demos/bad/after/home.html']: est[u]='controle'; nome[u]='W3C BAD'
base={r['url']:r for r in r1 if r['condicao']=='baseline'}; braw={u:raw(r) for u,r in base.items()}
fnum=lambda x: float(x) if x not in ('',None) else None
def w(name, header, lines):
    with open(os.path.join(OUT,name),'w',newline='') as f: c=csv.writer(f,lineterminator='\n'); c.writerow(header); c.writerows(lines)
md=[]
# 1. por condição
lines=[]; md.append('## 1. Resultado por condição (1ª passada, uma execução por página)\n\n| Condição | Páginas | ok | parcial | falha | Violações axe baseline→pós (páginas ok) | Média por página baseline→pós | Críticas baseline→pós | Páginas que pioraram | Novos erros axe (total) | IBM violações baseline→pós | Novos erros IBM (total) | Rótulos genéricos (total) | Tokens in / out | Latência média por página |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for c in ['baseline']+COND:
    v=[r for r in r1 if r['condicao']==c]; ok=[r for r in v if r['status']=='ok']; par=[r for r in v if r['status']=='parcial']; fal=[r for r in v if r['status']=='falha']
    bsum=sum(tot(base[r['url']]) for r in ok); psum=sum(tot(r) for r in ok); bcrit=sum(int(base[r['url']]['axe_violations_critical']) for r in ok); pcrit=sum(int(r['axe_violations_critical']) for r in ok)
    pior=sum(1 for r in ok if tot(r)>tot(base[r['url']])); ne=sum(fnum(r['novos_erros_axe']) or 0 for r in ok)
    ib=sum(fnum(base[r['url']]['ibm_violations']) or 0 for r in ok); ip=sum(fnum(r['ibm_violations']) or 0 for r in ok); nib=sum(fnum(r['novos_erros_ibm']) or 0 for r in ok)
    gen=sum(fnum(r['rotulos_genericos']) or 0 for r in ok); ti=sum(fnum(r['tokens_in']) or 0 for r in ok); to=sum(fnum(r['tokens_out']) or 0 for r in ok); lat=[(fnum(r['latencia_ms']) or 0)/1000 for r in ok]
    n=len(ok) or 1
    md.append(f"| {c} | {len(v)} | {len(ok)} | {len(par)} | {len(fal)} | {bsum}→{psum} | {bsum/n:.1f}→{psum/n:.1f} | {bcrit}→{pcrit} | {pior} | {ne:.0f} | {ib:.0f}→{ip:.0f} | {nib:.0f} | {gen:.0f} | {ti:.0f} / {to:.0f} | {st.mean(lat):.1f} s |" if c!='baseline' else f"| baseline | {len(v)} | {len(ok)} | 0 | 0 | {psum} | {psum/n:.1f} | {pcrit} | — | — | {ip:.0f} | — | — | — | — |")
    lines.append([c,len(v),len(ok),len(par),len(fal),bsum,psum,bcrit,pcrit,pior,ne,ib,ip,nib,gen,ti,to,st.mean(lat) if lat else ''])
w('por_condicao.csv',['condicao','paginas','ok','parcial','falha','axe_baseline','axe_pos','axe_crit_baseline','axe_crit_pos','paginas_pioraram','novos_erros_axe','ibm_baseline','ibm_pos','novos_erros_ibm','rotulos_genericos','tokens_in','tokens_out','latencia_media_s'],lines)
# 2. por estrato
md.append('\n## 2. Redução de violações axe por estrato (média por página, páginas ok; baseline → pós)\n\n| Estrato | Páginas | baseline | v1.0.0 | v1.1.0 | v1.1.0-fix | v1.1.0-vision |\n|---|---|---|---|---|---|---|')
lines=[]
for e in ['A','B','C','D','E','F','controle']:
    urls=[u for u in base if est.get(u)==e]; cells=[]
    bm=st.mean(tot(base[u]) for u in urls)
    for c in COND:
        ok=[r for r in r1 if r['condicao']==c and r['status']=='ok' and r['url'] in urls]
        cells.append(f"{st.mean(tot(r) for r in ok):.1f} (n={len(ok)})" if ok else '—')
    md.append(f"| {e} | {len(urls)} | {bm:.1f} | "+' | '.join(cells)+' |'); lines.append([e,len(urls),bm]+cells)
w('por_estrato.csv',['estrato','paginas','axe_baseline_media','v1.0.0','v1.1.0','v1.1.0-fix','v1.1.0-vision'],lines)
# 3. regras corrigidas e introduzidas
md.append('\n## 3. Regras do axe-core mais corrigidas e mais introduzidas (soma de nós nas páginas ok)\n')
corr=[]; intro=[]
for c in COND:
    dec=Counter(); inc=Counter(); newr=Counter()
    for r in r1:
        if r['condicao']!=c or r['status']!='ok': continue
        d=raw(r); b=braw[r['url']]
        if not d or not b: continue
        pr=d['axe']['post']['rules']; brr=b['axe']['post']['rules']
        for rule in set(pr)|set(brr):
            diff=pr.get(rule,0)-brr.get(rule,0)
            (inc if diff>0 else dec)[rule]+=abs(diff)
        for rule,n in (d['axe'].get('newViolations',{}).get('byRule') or {}).items(): newr[rule]+=n
    md.append(f"**{c}** — corrigidas: "+', '.join(f"{k} −{v}" for k,v in dec.most_common(6))+"; aumentaram: "+(', '.join(f"{k} +{v}" for k,v in inc.most_common(5)) or 'nenhuma')+"; novos erros por regra: "+(', '.join(f"{k} {v}" for k,v in newr.most_common(5)) or 'nenhum')+'\n')
    for k,v in dec.most_common(): corr.append([c,k,v])
    for k,v in inc.most_common(): intro.append([c,k,v,newr.get(k,0)])
w('regras_corrigidas.csv',['condicao','regra','nos_reduzidos'],corr); w('regras_aumentaram.csv',['condicao','regra','nos_aumentados','novos_erros_byRule'],intro)
# 4. falhas
md.append('\n## 4. Falhas por causa (1ª passada)\n\n| Condição | Causa | Páginas |\n|---|---|---|')
lines=[]
def causa(o):
    o=o or ''
    if 'tag name provided' in o: return 'aplicação: nome de tag inválido (replaceWith sem validação, C5)'
    if 'startsWith is not a function' in o: return 'aplicação: element.id não é texto (formulário com campo "id")'
    if 'waitForFunction' in o: return 'painel da v1.0.0 não respondeu (página gigante)'
    if 'não terminou' in o and 'automacao' in o: return 'análise da v1.1.0 não terminou (página gigante)'
    if 'sem resposta em' in o or '290000' in o: return 'timeout do modelo/análise (D8)'
    return o[:60]
for c in COND:
    by=defaultdict(list)
    for r in r1:
        if r['condicao']==c and r['status']!='ok': by[causa(r['observacoes'])].append(nome.get(r['url'],r['url']))
    for k,v in by.items(): md.append(f"| {c} | {k} | {', '.join(v)} ({len(v)}) |"); lines.append([c,k,len(v),'; '.join(v)])
w('falhas.csv',['condicao','causa','n','paginas'],lines)
# 5. variância
md.append('\n## 5. Variância entre 3 execuções (10 páginas do estrato `variancia`)\n\n| Condição | Páginas com 3 ok | Violações axe idênticas nas 3 | Maior amplitude | Rótulos genéricos idênticos | Maior amplitude de tokens de saída | Status diferente entre execuções |\n|---|---|---|---|---|---|---|')
lines=[]
for c in COND:
    by=defaultdict(list)
    for r in r2:
        if r['condicao']==c: by[r['url']].append(r)
    n=ident=gid=incons=0; amp=[]; tamp=[]
    for u,l in by.items():
        incons+= len({r['status'] for r in l})>1; ok=[r for r in l if r['status']=='ok']
        if len(ok)==3:
            n+=1; v=[tot(r) for r in ok]; g=[r['rotulos_genericos'] for r in ok]; t=[fnum(r['tokens_out']) or 0 for r in ok]
            ident+=len(set(v))==1; gid+=len(set(g))==1; amp.append(max(v)-min(v)); tamp.append(max(t)-min(t))
    md.append(f"| {c} | {n} de {len(by)} | {ident} | {max(amp) if amp else '—'} | {gid} | {max(tamp) if tamp else '—':.0f} | {incons} |"); lines.append([c,len(by),n,ident,max(amp) if amp else '',gid,max(tamp) if tamp else '',incons])
w('variancia.csv',['condicao','paginas','com_3_ok','axe_identico','amplitude_axe_max','genericos_identicos','amplitude_tokens_out','status_inconsistente'],lines)
# 6. alts da visão × fix
md.append('\n## 6. Textos alternativos gerados (estrato `visao`): condição de visão × v1.1.0-fix\n')
lines=[]; cnt=Counter()
for c in ['v1.1.0-vision','v1.1.0-fix']:
    for r in r1:
        if r['condicao']!=c or r['status']!='ok' or 'visao' not in r['estrato']: continue
        d=raw(r); rl=(d or {}).get('driver',{}).get('runLog') or {}
        for a in rl.get('altTexts') or []:
            lines.append([c,nome.get(r['url'],''),r['url'],a.get('selector'),a.get('source'),a.get('vision'),a.get('visionSource'),a.get('reasoningAsAlt'),a.get('applied'),a.get('finalAlt') or a.get('alt'),a.get('tokensOut'),a.get('latencyMs'),a.get('error') or a.get('visionError')])
            cnt[(c,a.get('source'),bool(a.get('vision')))]+=1
w('alts_visao.csv',['condicao','site','url','selector','origem','visao','fonte_imagem','raciocinio_como_alt','aplicado','alt_final','tokens_out','latencia_ms','erro'],lines)
md.append('| Condição | Origem | Com imagem | Alts |\n|---|---|---|---|'); [md.append(f"| {k[0]} | {k[1]} | {'sim' if k[2] else 'não'} | {v} |") for k,v in sorted(cnt.items())]
md.append(f"\nLista completa (alt final, seletor, origem, latência) em `alts_visao.csv` ({len(lines)} linhas), para a avaliação da coautora.")
# 7. custo
md.append('\n## 7. Custo por condição (1ª passada, páginas ok)\n\n| Condição | Páginas que chamaram o modelo | Tokens de entrada | Tokens de saída | Latência total do modelo | Latência média por página | Páginas com timeout |\n|---|---|---|---|---|---|---|')
for c in COND:
    ok=[r for r in r1 if r['condicao']==c and r['status']=='ok']; ti=sum(fnum(r['tokens_in']) or 0 for r in ok); to=sum(fnum(r['tokens_out']) or 0 for r in ok); lat=sum(fnum(r['latencia_ms']) or 0 for r in ok)/1000
    tmo=sum(1 for r in r1 if r['condicao']==c and r['status']!='ok' and ('290000' in r['observacoes'] or 'sem resposta' in r['observacoes']))
    chamou=sum(1 for r in ok if (fnum(r['tokens_in']) or 0)>0)
    md.append(f"| {c} | {chamou} de {len(ok)} | {ti:.0f} | {to:.0f} | {lat/60:.1f} min | {lat/max(len(ok),1):.1f} s | {tmo} |")
# relatório
hdr=f"""# Estudo 1 — análise do lote de 24/10/2026

Sessões: 1ª passada `{S1}` (baseline, v1.0.0, v1.1.0, v1.1.0-fix em 100 páginas; v1.1.0-vision em 19), variância `{S2}` (3 execuções × 10 páginas). Build `v1.1.0-jis_submission`; modelo `qwen3:8b` (visão: `gemma3:4b`), temperatura 0, contexto 4096, máquina do lote com GPU em clock travado (D10). Amostra: `docs/pesquisa/criterio_amostragem.md`. Reproduzir: `python3 -I eval/tools/analisar.py {S1} {S2} docs/analise/estudo1-2026-10-24`.

Leitura: "violações axe" = pares (regra, nó) com violação WCAG 2.1 A/AA; "novos erros" = violações no pós sem par na baseline do mesmo snapshot; "rótulos genéricos" = rótulos de fallback novos no DOM ("Abrir link N", alt "Imagem"); falha é dado do estudo.
"""
open(os.path.join(OUT,'..','estudo1-2026-10-24.md'),'w').write(hdr+'\n'+'\n'.join(md)+'\n')
print('ok:',OUT)
