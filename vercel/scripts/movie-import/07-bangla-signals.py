# Signals for Bangladeshi vs Kolkata (Indian) Bengali movies: IMDb country, Kolkata folders on BDIX servers.
# usage: python3 -I 07-bangla-signals.py <cats.json> <index.ndjson> <out.json>
import json, sys, re, collections, urllib.parse
catsf, idxf, outf = sys.argv[1:4]
d = json.load(open(catsf))
STOP = {'the','a','an','and','of','movie','full','hd','bangla','bengali','hindi','dubbed','dual','audio','org','uncut','dvd','dvdrip','webrip','web','dl','hdrip','rip'}
def norm(t):
    t = urllib.parse.unquote(t).lower().replace('&', ' and ')
    t = re.sub(r"['’`]", '', t); t = re.sub(r'[^a-z0-9]+', ' ', t)
    return ' '.join(x for x in t.split() if x not in STOP)
YEAR = re.compile(r'(?<!\d)(19[3-9]\d|20[0-3]\d)(?!\d)')
def title_year(raw, year=None):
    s = re.sub(r'\.(mkv|mp4|avi|m4v|webm|mov|ts)$', '', urllib.parse.unquote(raw), flags=re.I)
    s = re.sub(r'[._-]+', ' ', s)
    m = next((mm for mm in YEAR.finditer(s) if mm.start() > 0), None)
    if m: return norm(s[:m.start()]), year or int(m.group(1))
    return norm(s), year
kolkata = set(); kolkata_t = set()
for line in open(idxf):
    u = urllib.parse.unquote(json.loads(line)['url'])
    if not re.search(r'kolkata|indianbangla', u, re.I): continue
    for seg in u.split('/')[-2:]:
        t, y = title_year(seg)
        if t: kolkata_t.add(t)
        if t and y: kolkata.add((t, y))
cat = collections.defaultdict(set); cname = {c['id']: c['name'] for c in d['cats']}
for r in d['map']: cat[r['movie_id']].add(cname[r['category_id']])
out = {}
for m in d['movies']:
    cs = cat[m['id']]
    if not m.get('is_published') or not (cs & {'Bangla', 'Kolkata Bangla'}): continue
    t, y = title_year(m['title'], m.get('release_year'))
    co = set(m.get('imdb_countries') or [])
    imdb = 'bd+in' if {'Bangladesh', 'India'} <= co else 'bd' if 'Bangladesh' in co else 'in' if co == {'India'} or (co and 'India' in co) else ('other' if co else 'none')
    folder = 'kolkata' if (t, y) in kolkata or (not y and t in kolkata_t) else ''
    out[str(m['id'])] = {'title': m['title'], 'year': m.get('release_year'), 'cats': sorted(cs), 'imdb': imdb, 'countries': sorted(co), 'folder': folder}
json.dump(out, open(outf, 'w'), ensure_ascii=False)
c = collections.Counter((v['imdb'], v['folder']) for v in out.values()); print(len(out)); [print(k, n) for k, n in c.most_common()]
