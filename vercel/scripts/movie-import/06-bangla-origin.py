# Bangladeshi vs Indian (Kolkata) Bengali film check via the Wikipedia API.
# usage: python3 -I 06-bangla-origin.py <cats.json> <out.json>   (resumable)
import json, sys, os, re, time, urllib.parse, urllib.request, ssl, concurrent.futures as cf
catsf, outf = sys.argv[1:3]
d = json.load(open(catsf))
done = json.load(open(outf)) if os.path.exists(outf) else {}
cat = {}
for r in d['map']: cat.setdefault(r['movie_id'], set()).add(r['category_id'])
movies = [m for m in d['movies'] if m.get('is_published') and (cat.get(m['id'], set()) & {1, 95}) and str(m['id']) not in done]
UA = {'User-Agent': 'catalog-check/1.0 (movie category check)'}
CTX = ssl.create_default_context()
try:
    import certifi; CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = ssl._create_unverified_context()
def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20, context=CTX) as r:
                return json.loads(r.read().decode())
        except Exception:
            time.sleep(2 + i * 3)
    return {}
def norm(t): return re.sub(r'[^a-z0-9]+', ' ', t.lower()).strip()
def classify(text):
    t = text.lower()
    bd = bool(re.search(r'bangladeshi|dhallywood|dhaka-based|produced in bangladesh|jaaz multimedia|impress telefilm', t))
    ind = bool(re.search(r'indian bengali|indian bangla|tollywood|kolkata|west bengal|svf|shree venkatesh|eskay', t))
    if bd and ind: return 'both'
    return 'bd' if bd else 'in' if ind else ''
def year_in(text, year):
    return not year or any(str(y) in text for y in (year, year - 1, year + 1))
def check(m):
    title, year = m['title'], m.get('release_year') or 0
    nt = norm(title)
    for q in (f'{title} {year} film', f'{title} Bengali film', f'{title} film'):
        s = get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'list': 'search', 'srsearch': q, 'srlimit': 6, 'format': 'json'}))
        hits = s.get('query', {}).get('search') or []
        for hit in hits:
            ht = norm(re.sub(r'\(.*?\)', '', hit['title']))
            if not ht or not (ht == nt or (len(nt) > 4 and (ht.startswith(nt) or nt.startswith(ht)))):
                continue
            e = get('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'prop': 'extracts', 'exintro': 1, 'explaintext': 1, 'titles': hit['title'], 'format': 'json'}))
            text = ' '.join(p.get('extract', '') for p in e.get('query', {}).get('pages', {}).values())[:1500]
            if 'film' not in text.lower() or not year_in(text[:600], year):
                continue
            return str(m['id']), {'wiki': hit['title'], 'origin': classify(text), 'extract': text[:300]}
    return str(m['id']), {'wiki': '', 'origin': ''}
with cf.ThreadPoolExecutor(3) as ex:
    for n, (k, v) in enumerate(ex.map(check, movies), 1):
        done[k] = v
        if n % 50 == 0: json.dump(done, open(outf, 'w')); print(n, len(movies), flush=True)
json.dump(done, open(outf, 'w'))
import collections; print('done', collections.Counter(v['origin'] or ('nowiki' if not v['wiki'] else 'unclear') for v in done.values()))
