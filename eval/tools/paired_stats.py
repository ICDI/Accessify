#!/usr/bin/env python3
"""Paired comparison of v1.0 (tag v1.0.0-semish) and v1.1 (build v1.1.0-jis_submission)
on the pages both versions completed in the first pass of Study 1.

Pure Python (no SciPy). Run with:  python3 -I paired_stats.py [path/to/Accessify]

Data: eval/results/runs.csv, first-pass session 20261024-203955404-d8a9 (the session
docs/analise/estudo1-comparacao-versoes.md and eval/tools/analisar.py use).
Per page: axe-core violations = sum of the four impact columns (critical, serious,
moderate, minor), as in analisar.py; IBM Equal Access violations = column ibm_violations.
Baseline of each page = baseline row of the same session (same snapshot).

Tests: Wilcoxon signed-rank on the paired differences d = second - first
(v1.1 - v1.0; after repair - baseline), zeros discarded (Wilcoxon's method, as SciPy's
zero_method='wilcox'), tied |d| given average ranks.  Two-sided p reported two ways:
  * exact: exact permutation (sign-flip) distribution of W+ conditional on the observed
    tied ranks, computed by dynamic programming over doubled ranks (exact integer counts);
  * normal approximation with tie correction, without continuity correction.
Effect size: matched-pairs rank-biserial correlation r = (W+ - W-)/(W+ + W-) (Kerby 2014),
so r < 0 means the second member of the pair has fewer violations.
Bootstrap: percentile 95% CI of the median paired difference, 10,000 resamples of pages
with replacement, random.Random(SEED); quantiles by linear interpolation (numpy default).

The complementary session with an extended time limit (eval/results-prazo-ampliado, D17)
is not study data for axe/IBM (first-pass failures remain the study result); it is used
only in a sensitivity check that adds the three v1.0 pages it recovered.
"""
import csv, math, os, random, re, statistics as st, sys
from itertools import product

REPO = sys.argv[1] if len(sys.argv) > 1 else '/home/marlon-marcon/workspace/Accessify'
RUNS = os.path.join(REPO, 'eval', 'results', 'runs.csv')
RUNS_EXT = os.path.join(REPO, 'eval', 'results-prazo-ampliado', 'runs.csv')
S1 = '20261024-203955404-d8a9'
SEED = 20261024
B = 10_000
IMP = ('critical', 'serious', 'moderate', 'minor')


# ---------------------------------------------------------------- statistics
def avg_ranks(values):
    """Ranks 1..n of values, ties receive the average rank."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        r = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = r
        i = j + 1
    return ranks


def wilcoxon(d):
    """Wilcoxon signed-rank test on differences d (zeros discarded)."""
    nz = [x for x in d if x != 0]
    n0 = len(d) - len(nz)
    n = len(nz)
    ranks = avg_ranks([abs(x) for x in nz])
    wp = sum(r for r, x in zip(ranks, nz) if x > 0)
    wm = sum(r for r, x in zip(ranks, nz) if x < 0)
    T = min(wp, wm)
    # normal approximation with tie correction, no continuity correction
    mu = n * (n + 1) / 4
    ties = {}
    for r in ranks:
        ties[r] = ties.get(r, 0) + 1
    tie_term = sum(t ** 3 - t for t in ties.values())
    var = n * (n + 1) * (2 * n + 1) / 24 - tie_term / 48
    z = (wp - mu) / math.sqrt(var) if var > 0 else 0.0
    p_norm = math.erfc(abs(z) / math.sqrt(2))
    # exact conditional distribution of 2*W+ (doubled ranks are integers)
    r2 = [int(round(2 * r)) for r in ranks]
    total = sum(r2)
    counts = [0] * (total + 1)
    counts[0] = 1
    for v in r2:
        for s in range(total, v - 1, -1):
            if counts[s - v]:
                counts[s] += counts[s - v]
    N = 2 ** n
    k = int(round(2 * T))
    # by symmetry of W+ around total/2, P(W+ <= T) = P(W+ >= total - T)
    lower = sum(counts[: k + 1])
    p_exact = min(1.0, 2 * lower / N)
    r_rb = (wp - wm) / (wp + wm) if (wp + wm) else 0.0
    return dict(n_pairs=len(d), n_zero=n0, n_nonzero=n, n_pos=sum(1 for x in nz if x > 0),
                n_neg=sum(1 for x in nz if x < 0), W_plus=wp, W_minus=wm, T=T, z=z,
                p_normal=p_norm, p_exact=p_exact, r_rb=r_rb, tie_groups=sum(1 for t in ties.values() if t > 1))


def quantile(sorted_x, q):
    """Linear interpolation between order statistics (numpy 'linear', R type 7)."""
    h = (len(sorted_x) - 1) * q
    lo = math.floor(h)
    hi = min(lo + 1, len(sorted_x) - 1)
    return sorted_x[lo] + (h - lo) * (sorted_x[hi] - sorted_x[lo])


def boot_ci_median(d, b=B, seed=SEED):
    rng = random.Random(seed)
    n = len(d)
    meds = sorted(st.median(rng.choices(d, k=n)) for _ in range(b))
    return quantile(meds, 0.025), quantile(meds, 0.975)


def holm(ps):
    order = sorted(range(len(ps)), key=lambda i: ps[i])
    adj = [0.0] * len(ps)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(ps) - rank) * ps[i]))
        adj[i] = running
    return adj


# ---------------------------------------------------------------- validation
def brute_force_p(d):
    """Exact two-sided p by enumerating every sign assignment of the nonzero |d| ranks."""
    nz = [x for x in d if x != 0]
    ranks = avg_ranks([abs(x) for x in nz])
    wp = sum(r for r, x in zip(ranks, nz) if x > 0)
    wm = sum(r for r, x in zip(ranks, nz) if x < 0)
    T = min(wp, wm)
    tot = sum(ranks)
    hits = 0
    for signs in product((0, 1), repeat=len(ranks)):
        s = sum(r for r, g in zip(ranks, signs) if g)
        if min(s, tot - s) <= T + 1e-9:
            hits += 1
    return hits / 2 ** len(ranks)


def validate():
    out = []
    # (1) Darwin's Zea mays data (Fisher 1935), the example in SciPy's wilcoxon docs:
    #     statistic = 24, exact two-sided p = 0.041259765625.
    darwin = [6, 8, 14, 16, 23, 24, 28, 29, 41, -48, 49, 56, 60, -67, 75]
    w = wilcoxon(darwin)
    ok1 = w['T'] == 24 and abs(w['p_exact'] - 0.041259765625) < 1e-12 and abs(w['r_rb'] - 0.6) < 1e-12
    out.append(f"Darwin/Fisher (n=15): T={w['T']}, W+={w['W_plus']}, exact p={w['p_exact']:.12f} "
               f"(expected 24, 0.041259765625), r_rb={w['r_rb']:.3f} (expected 0.6) -> {'PASS' if ok1 else 'FAIL'}")
    # (2) Wikipedia 'Wilcoxon signed-rank test' example: 10 pairs, one zero, one tie;
    #     W+ = 27, W- = 18, signed-rank sum W = 9.  Normal approx with tie correction by hand:
    #     mu = 22.5, var = 9*10*19/24 - (2^3-2)/48 = 71.125, z = 4.5/sqrt(71.125) = 0.5336, p = 0.5936.
    x2 = [125, 115, 130, 140, 140, 115, 140, 125, 140, 135]
    x1 = [110, 122, 125, 120, 140, 124, 123, 137, 135, 145]
    dw = [a - b for a, b in zip(x2, x1)]
    w2 = wilcoxon(dw)
    zhand = 4.5 / math.sqrt(71.125)
    phand = math.erfc(zhand / math.sqrt(2))
    bf = brute_force_p(dw)
    ok2 = (w2['W_plus'], w2['W_minus'], w2['n_zero']) == (27, 18, 1) and abs(w2['p_normal'] - phand) < 1e-12 \
        and abs(w2['p_exact'] - bf) < 1e-12
    out.append(f"Wikipedia example (n=10, 1 zero, 1 tie): W+={w2['W_plus']}, W-={w2['W_minus']}, zeros={w2['n_zero']}, "
               f"z={w2['z']:.4f}, normal p={w2['p_normal']:.4f} (hand {phand:.4f}), exact p={w2['p_exact']:.6f} "
               f"(brute force over 2^9 signs {bf:.6f}) -> {'PASS' if ok2 else 'FAIL'}")
    # (3) random cross-check of the DP against brute-force enumeration with many ties
    rng = random.Random(1)
    ok3 = True
    for _ in range(200):
        d = [rng.randint(-4, 4) for _ in range(rng.randint(3, 12))]
        if all(x == 0 for x in d):
            continue
        if abs(wilcoxon(d)['p_exact'] - brute_force_p(d)) > 1e-12:
            ok3 = False
    out.append(f"DP vs brute force on 200 random tied samples (n<=12): {'PASS' if ok3 else 'FAIL'}")
    return out, ok1 and ok2 and ok3


# ---------------------------------------------------------------- data
def load():
    rows = [r for r in csv.DictReader(open(RUNS, newline='')) if r['sessao'] == S1]
    by = {}
    for r in rows:
        by.setdefault(r['condicao'], {})[r['url']] = r
    return rows, by


axe = lambda r: sum(int(r[f'axe_violations_{k}']) for k in IMP)
ibm = lambda r: int(float(r['ibm_violations']))
INSTR = [('axe-core', axe), ('IBM Equal Access', ibm)]


def main():
    lines, ok = validate()
    print('== Validation of the Wilcoxon implementation')
    for l in lines:
        print('  ' + l)
    if not ok:
        sys.exit('validation failed')

    rows, by = load()
    base = by['baseline']
    print('\n== Consistency checks against the manuscript / analisar.py (first pass, session ' + S1 + ')')
    for c in ('baseline', 'v1.0.0', 'v1.1.0', 'v1.1.0-fix'):
        okr = [r for r in by[c].values() if r['status'] == 'ok']
        n = len(okr)
        ab = sum(axe(base[r['url']]) for r in okr); ap = sum(axe(r) for r in okr)
        ib = sum(ibm(base[r['url']]) for r in okr); ip = sum(ibm(r) for r in okr)
        cb = sum(int(base[r['url']]['axe_violations_critical']) for r in okr); cp = sum(int(r['axe_violations_critical']) for r in okr)
        worse = sum(1 for r in okr if axe(r) > axe(base[r['url']]))
        print(f"  {c:11s} pages={len(by[c])} ok={n}  axe {ab}->{ap} ({ab/n:.1f}->{ap/n:.1f}/page)  "
              f"critical {cb}->{cp}  IBM {ib}->{ip} ({ib/n:.1f}->{ip/n:.1f}/page)  axe-worse pages={worse}")
    ok10 = {u for u, r in by['v1.0.0'].items() if r['status'] == 'ok'}
    ok11 = {u for u, r in by['v1.1.0'].items() if r['status'] == 'ok'}
    common = sorted(ok10 & ok11)
    print(f"  completed by v1.0: {len(ok10)}; by v1.1: {len(ok11)}; by both: {len(common)}; "
          f"by neither: {len(set(base) - ok10 - ok11)}; v1.1 only: {len(ok11 - ok10)}; v1.0 only: {len(ok10 - ok11)}")
    print('  v1.0 only:', [u for u in ok10 - ok11])
    print('  neither:', [u for u in set(base) - ok10 - ok11])
    fx = all(axe(by['v1.1.0'][u]) == axe(by['v1.1.0-fix'][u]) and ibm(by['v1.1.0'][u]) == ibm(by['v1.1.0-fix'][u])
             for u in ok11)
    print(f"  v1.1 (no reasoning) identical to v1.1 on axe and IBM for all {len(ok11)} pages: {fx}")

    print(f'\n== Paired analysis on the {len(common)} pages both versions completed')
    results = []
    for name, f in INSTR:
        b = [f(base[u]) for u in common]; a10 = [f(by['v1.0.0'][u]) for u in common]; a11 = [f(by['v1.1.0'][u]) for u in common]
        print(f"\n-- {name}: totals baseline {sum(b)}, v1.0 {sum(a10)}, v1.1 {sum(a11)}; means "
              f"{st.mean(b):.2f}, {st.mean(a10):.2f}, {st.mean(a11):.2f}; medians {st.median(b)}, {st.median(a10)}, {st.median(a11)}")
        for label, x, y in (('v1.1 - v1.0', a10, a11), ('v1.0 - baseline', b, a10), ('v1.1 - baseline', b, a11)):
            d = [yy - xx for xx, yy in zip(x, y)]
            w = wilcoxon(d)
            lo, hi = boot_ci_median(d)
            res = dict(instrument=name, comparison=label, n=len(d), median_a=st.median(x), median_b=st.median(y),
                       median_diff=st.median(d), mean_diff=st.mean(d), ci=(lo, hi), **w)
            results.append(res)
    adj = holm([r['p_exact'] for r in results])
    for r, pa in zip(results, adj):
        r['p_holm'] = pa
        print(f"  {r['instrument']:16s} {r['comparison']:16s} n={r['n']} medians {r['median_a']} vs {r['median_b']}; "
              f"median diff {r['median_diff']} (mean {r['mean_diff']:.2f}), boot95 [{r['ci'][0]}, {r['ci'][1]}]; "
              f"lower/higher/equal {r['n_neg']}/{r['n_pos']}/{r['n_zero']}; W+={r['W_plus']} W-={r['W_minus']} T={r['T']}; "
              f"z={r['z']:.3f}; p_exact={r['p_exact']:.3e} p_normal={r['p_normal']:.3e} p_holm={r['p_holm']:.3e}; "
              f"r_rb={r['r_rb']:.3f}; tie groups={r['tie_groups']}")

    # sensitivity: add the three v1.0 pages recovered by the extended-time-limit session (D17)
    if os.path.exists(RUNS_EXT):
        ext = {r['url']: r for r in csv.DictReader(open(RUNS_EXT, newline='')) if r['condicao'] == 'v1.0.0' and r['status'] == 'ok'}
        add = [u for u in ext if u in ok11 and u not in ok10]
        same_snap = all(ext[u]['snapshot_sha256'] == base[u]['snapshot_sha256'] for u in add)
        pages = common + add
        print(f"\n== Sensitivity: {len(pages)} pages = {len(common)} + {len(add)} v1.0 pages recovered with the extended "
              f"time limit (same snapshot as the first-pass baseline: {same_snap})")
        for name, f in INSTR:
            v10 = lambda u: f(by['v1.0.0'][u]) if u in ok10 else f(ext[u])
            d = [f(by['v1.1.0'][u]) - v10(u) for u in pages]
            w = wilcoxon(d); lo, hi = boot_ci_median(d)
            print(f"  {name:16s} v1.1 - v1.0  median diff {st.median(d)} boot95 [{lo}, {hi}]  lower/higher/equal "
                  f"{w['n_neg']}/{w['n_pos']}/{w['n_zero']}  T={w['T']} p_exact={w['p_exact']:.3e} r_rb={w['r_rb']:.3f}")

    # sensitivity: pages are nested in sites (home page + task page of each site)
    src = open(os.path.join(REPO, 'eval', 'tools', 'amostra', 'montar_amostra.py')).read()
    blk = src[src.index('SITES=['):src.index('CONTROLE=[')]
    site = {}
    for m in re.finditer(r'^\("([A-F])","([^"]*)","[^"]*","([^"]+)","([^"]+)"', blk, re.M):
        site[m.group(3)] = site[m.group(4)] = m.group(2)
    for u in common:
        site.setdefault(u, 'W3C BAD' if 'w3.org/WAI/demos/bad' in u else u)
    clusters = {}
    for u in common:
        clusters.setdefault(site[u], []).append(u)
    sizes = {}
    for v in clusters.values():
        sizes[len(v)] = sizes.get(len(v), 0) + 1
    print(f"\n== Sensitivity: {len(common)} pages nested in {len(clusters)} sites (pages per site: {sizes})")
    keys = sorted(clusters)
    for name, f in INSTR:
        dd = {u: f(by['v1.1.0'][u]) - f(by['v1.0.0'][u]) for u in common}
        rng = random.Random(SEED)
        meds = sorted(st.median([dd[u] for s in rng.choices(keys, k=len(keys)) for u in clusters[s]]) for _ in range(B))
        ds = [st.mean(dd[u] for u in clusters[s]) for s in keys]
        w = wilcoxon(ds)
        print(f"  {name:16s} v1.1 - v1.0  site-cluster bootstrap 95% CI of the page-level median diff "
              f"[{quantile(meds, .025)}, {quantile(meds, .975)}]; site-level Wilcoxon on per-site mean diff: "
              f"n={w['n_pairs']} lower/higher/equal {w['n_neg']}/{w['n_pos']}/{w['n_zero']} T={w['T']} "
              f"p_exact={w['p_exact']:.3e} r_rb={w['r_rb']:.3f}")

    # per-page table for the replication package
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'paired_per_page.csv')
    with open(out, 'w', newline='') as fh:
        c = csv.writer(fh, lineterminator='\n')
        c.writerow(['url', 'axe_baseline', 'axe_v1.0', 'axe_v1.1', 'ibm_baseline', 'ibm_v1.0', 'ibm_v1.1'])
        for u in common:
            c.writerow([u, axe(base[u]), axe(by['v1.0.0'][u]), axe(by['v1.1.0'][u]),
                        ibm(base[u]), ibm(by['v1.0.0'][u]), ibm(by['v1.1.0'][u])])
    print('\nper-page table:', out)


if __name__ == '__main__':
    main()
