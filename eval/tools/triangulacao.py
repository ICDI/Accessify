#!/usr/bin/env python3
"""Triangulação por página: WAVE (leitura manual, D16/D17) × axe-core × IBM Equal Access,
nas condições baseline, v1.0.0 e v1.1.0. Uso:
   python3 -I eval/tools/triangulacao.py <sessao_1a_passada> <pasta_saida>
Gera triangulacao_por_pagina.csv e triangulacao.md (tabela e concordância)."""
import csv, os, re, sys, statistics as st
EVAL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'); REPO=os.path.join(EVAL,'..')
S1, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
IMP=('critical','serious','moderate','minor'); CONDS=['baseline','v1.0.0','v1.1.0']
# estratos e nomes
src=open(os.path.join(EVAL,'tools/amostra/montar_amostra.py')).read(); blk=src[src.index('SITES=['):src.index('CONTROLE=[')]
est={}; nome={}; ordem=[]
for m in re.finditer(r'^\("([A-F])","([^"]*)","[^"]*","([^"]+)","([^"]+)"',blk,re.M):
    for u,papel in ((m.group(3),'inicial'),(m.group(4),'tarefa')): est[u]=m.group(1); nome[u]=f"{m.group(2)} — {papel}"; ordem.append(u)
for u,p in (('https://www.w3.org/WAI/demos/bad/before/home.html','before'),('https://www.w3.org/WAI/demos/bad/after/home.html','after')): est[u]='controle'; nome[u]=f'W3C BAD — {p}'; ordem.append(u)
ordem.sort(key=lambda u: (0 if est[u]=='A' else 1 if est[u]=='B' else 2 if est[u]=='C' else 3 if est[u]=='D' else 4 if est[u]=='E' else 5 if est[u]=='F' else 6))
# harness
runs=[r for r in csv.DictReader(open(os.path.join(EVAL,'results/runs.csv'))) if r['sessao']==S1]
H={(r['url'],r['condicao']):r for r in runs}
axe=lambda r: sum(int(r[f'axe_violations_{k}']) for k in IMP)
ibm=lambda r: int(float(r['ibm_violations'])) if r['ibm_violations'] not in ('',None) else None
# wave
W={(r['url'],r['condicao']):r for r in csv.DictReader(open(os.path.join(REPO,'docs/evidencias/wave/wave.csv')))}
def wv(r,k):
    return int(r[k]) if r and r.get(k,'')!='' else None
linhas=[]; md=['# Triangulação por página: WAVE × axe-core × IBM Equal Access\n',
 f'Sessão do harness `{S1}`; WAVE lida à mão (D16; três páginas da v1.0.0 com DOM de prazo ampliado, D17). Por página e condição: erros + erros de contraste da WAVE, violações do axe (A/AA, pares regra×nó) e violações do IBM. "—" = run falhou (sem DOM) ou leitura indisponível.\n',
 '| Estrato | Página | WAVE base | axe base | IBM base | WAVE v1.0.0 | axe v1.0.0 | IBM v1.0.0 | WAVE v1.1.0 | axe v1.1.0 | IBM v1.1.0 |','|---|---|---|---|---|---|---|---|---|---|---|']
for u in ordem:
    cel=[]; row=[est[u],nome[u],u]
    for c in CONDS:
        h=H.get((u,c)); w=W.get((u,c))
        hv= (axe(h), ibm(h)) if h and h['status']=='ok' else (None,None)
        we=wv(w,'erros'); wc=wv(w,'erros_contraste')
        wave = f"{we}+{wc}" if we is not None and wc is not None else '—'
        cel += [wave, '—' if hv[0] is None else str(hv[0]), '—' if hv[1] is None else str(hv[1])]
        row += [we, wc, hv[0], hv[1], (w or {}).get('aim_score','')]
    md.append(f"| {est[u]} | {nome[u]} | "+' | '.join(cel)+' |'); linhas.append(row)
with open(os.path.join(OUT,'triangulacao_por_pagina.csv'),'w',newline='') as f:
    w=csv.writer(f,lineterminator='\n'); w.writerow(['estrato','pagina','url']+[f'{c}_{k}' for c in CONDS for k in ('wave_erros','wave_contraste','axe','ibm','aim')]); w.writerows(linhas)
# concordância: direção da mudança baseline→condição por instrumento (melhorou / piorou / igual)
md.append('\n## Concordância entre instrumentos\n\nPara cada página e versão, a direção da mudança em relação à baseline (menos, igual, mais problemas), com WAVE = erros + erros de contraste. Páginas com as três medidas em baseline e na versão.\n')
md.append('| Versão | Páginas | 3 instrumentos concordam | WAVE e axe concordam | WAVE e IBM concordam | axe e IBM concordam | Pioram no axe mas não na WAVE | Pioram na WAVE mas não no axe |')
md.append('|---|---|---|---|---|---|---|---|')
def dirc(a,b): return None if a is None or b is None else (-1 if b<a else 1 if b>a else 0)
corr=[]
for c in CONDS[1:]:
    n=t3=wa=wi=ai=ax_n=wv_n=0; pares=[]
    for u in ordem:
        hb=H.get((u,'baseline')); hc=H.get((u,c)); wb=W.get((u,'baseline')); wc_=W.get((u,c))
        if not(hb and hc and hc['status']=='ok' and wb and wc_ and wv(wb,'erros') is not None and wv(wc_,'erros') is not None and wv(wb,'erros_contraste') is not None and wv(wc_,'erros_contraste') is not None): continue
        dW=dirc(wv(wb,'erros')+wv(wb,'erros_contraste'), wv(wc_,'erros')+wv(wc_,'erros_contraste')); dA=dirc(axe(hb),axe(hc)); dI=dirc(ibm(hb),ibm(hc))
        if None in (dW,dA,dI): continue
        n+=1; t3+= dW==dA==dI; wa+= dW==dA; wi+= dW==dI; ai+= dA==dI; ax_n+= (dA==1 and dW!=1); wv_n+= (dW==1 and dA!=1)
        pares.append((axe(hb)-axe(hc), (wv(wb,'erros')+wv(wb,'erros_contraste'))-(wv(wc_,'erros')+wv(wc_,'erros_contraste')), (ibm(hb)-ibm(hc))))
    md.append(f"| {c} | {n} | {t3} ({100*t3//n}%) | {wa} ({100*wa//n}%) | {wi} ({100*wi//n}%) | {ai} ({100*ai//n}%) | {ax_n} | {wv_n} |")
    corr.append((c,pares))
# correlação de Spearman entre reduções (sem scipy): postos
def spearman(x,y):
    def ranks(v):
        s=sorted(range(len(v)),key=lambda i:v[i]); r=[0]*len(v); i=0
        while i<len(s):
            j=i
            while j+1<len(s) and v[s[j+1]]==v[s[i]]: j+=1
            for k in range(i,j+1): r[s[k]]=(i+j)/2+1
            i=j+1
        return r
    rx,ry=ranks(x),ranks(y); mx,my=st.mean(rx),st.mean(ry)
    num=sum((a-mx)*(b-my) for a,b in zip(rx,ry)); den=(sum((a-mx)**2 for a in rx)*sum((b-my)**2 for b in ry))**0.5
    return num/den if den else float('nan')
md.append('\nCorrelação de Spearman entre as reduções por página (baseline − pós):\n\n| Versão | axe × WAVE | axe × IBM | WAVE × IBM |\n|---|---|---|---|')
for c,p in corr:
    a=[x[0] for x in p]; w_=[x[1] for x in p]; i=[x[2] for x in p]
    md.append(f"| {c} | {spearman(a,w_):.2f} | {spearman(a,i):.2f} | {spearman(w_,i):.2f} |")
md.append('\nLeitura: "concordam" = mesma direção (melhorou, piorou ou igual). A WAVE conta erros e contraste como categorias separadas e não inclui alertas; o axe conta pares regra×nó em A/AA; o IBM conta violações por regra, elemento e motivo. As três escalas não são comparáveis em valor absoluto, só em direção e ordem.')
open(os.path.join(OUT,'triangulacao.md'),'w').write('\n'.join(md)+'\n'); print('ok')
