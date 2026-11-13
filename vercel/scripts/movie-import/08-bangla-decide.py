# Decide Bangla (Bangladeshi) vs Kolkata Bangla (Indian) per movie from signals + reviewed overrides.
# usage: python3 -I 08-bangla-decide.py <signals.json> <out.json> <review.csv>
import json, sys, csv, collections
sigf, outf, csvf = sys.argv[1:4]
sig = json.load(open(sigf))
# Reviewed by title (2026-11-13). K = Kolkata/Indian, B = Bangladeshi, BOTH = Indo-Bangladesh co-production.
K = {6273,6832,5883,5940,6627,6836,6422,6367,6838,6239,5894,5951,6372,5899,5956,6180,6183,6722,6886,5915,5972,6845,6794,6930,6326,6589,6651,6288,6653,6154,6735,5935,6056,6593,6737,6852,6292,6518,6452,6082,6678,6342,6468,6228,6762,6937,3169,6104,6108,6479,6206,6410,6706,6485,6272,6123,6234,6928}
B = {6644,6247,6736,6155,6669,6134,6201,6903,5868}
BOTH = {6642,6073}
UNSURE = {6241,6245,6829,6821}   # IMDb says Bangladesh but title/folder suggest Kolkata: left unchanged
FLAG = {}                       # wrong category entirely (not Bangla): reported, not changed
out = {}; rows = []
for k, v in sig.items():
    mid = int(k); cur = set(v['cats'])
    if mid in UNSURE: dec = ''
    elif mid in BOTH: dec = 'both'
    elif mid in K: dec = 'K'
    elif mid in B: dec = 'B'
    elif v['imdb'] == 'bd+in': dec = 'both'
    elif v['imdb'] == 'bd': dec = 'B'
    elif v['imdb'] == 'in' or v['folder'] == 'kolkata': dec = 'K'
    else: dec = ''
    want = {'K': {'Kolkata Bangla'}, 'B': {'Bangla'}, 'both': {'Bangla', 'Kolkata Bangla'}}.get(dec)
    have = cur & {'Bangla', 'Kolkata Bangla'}
    reason = f"imdb={v['imdb']}{'/' + '/'.join(v['countries']) if v['countries'] else ''} folder={v['folder'] or '-'}" + (' reviewed' if mid in K | B | BOTH else '')
    if want is None:
        out[k] = {'action': 'unchanged', 'title': v['title']}
        rows.append([mid, v['title'], v['year'], '+'.join(sorted(have)), '+'.join(sorted(have)), 'unchanged (not sure)', reason])
        continue
    if want == have:
        out[k] = {'action': 'ok', 'title': v['title']}; continue
    out[k] = {'action': 'move', 'title': v['title'], 'from': sorted(have), 'to': sorted(want)}
    rows.append([mid, v['title'], v['year'], '+'.join(sorted(have)), '+'.join(sorted(want)), 'move', reason])
json.dump(out, open(outf, 'w'), ensure_ascii=False)
with open(csvf, 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['movie_id', 'title', 'year', 'now', 'new', 'action', 'evidence']); w.writerows(sorted(rows, key=lambda r: (r[5], r[4], str(r[1]))))
c = collections.Counter((x['action'], '+'.join(x.get('to', []))) for x in out.values())
for k2, n in sorted(c.items()): print(k2, n)
