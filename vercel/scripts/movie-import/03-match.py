# Match crawled movie files to our movies by normalised title + year.
# usage: python3 -I 03-match.py <db.json> <index.ndjson> <out.json>
import json, re, sys, collections, urllib.parse
dbf, idxf, outf = sys.argv[1:4]
db = json.load(open(dbf))
STOP = {'the','a','an','and','of','movie','full','hd','bangla','hindi','dubbed','dual','audio','org','uncut','extended','remastered','directors','cut','unrated','imax','edition'}
def norm_title(t):
    t = t.lower().replace('&', ' and ')
    t = re.sub(r"['’`]", '', t)
    t = re.sub(r'[^a-z0-9]+', ' ', t)
    toks = [x for x in t.split() if x not in STOP]
    return ' '.join(toks)
YEAR = re.compile(r'(?<!\d)(19[3-9]\d|20[0-3]\d)(?!\d)')
JUNK = re.compile(r'\b(sample|trailer|teaser|featurette|behind the scenes|making of)\b', re.I)
EPISODE = re.compile(r'\bS\d{1,2}\s?E\d{1,3}\b|\bEpisode\s?\d+\b|\bEP\s?\d{1,3}\b', re.I)
def parse_name(seg):
    seg = urllib.parse.unquote(seg)
    seg = re.sub(r'\.(mkv|mp4|avi|m4v|webm|mov|ts|m3u8)$', '', seg, flags=re.I)
    s = re.sub(r'[._]+', ' ', seg)
    m = None
    for mm in YEAR.finditer(s):
        if mm.start() > 0: m = mm; break
    if not m: return None, None
    title = s[:m.start()]
    title = re.sub(r'[\(\[\{\-\s]+$', '', title)
    return norm_title(title), int(m.group(1))
def candidates_for(url):
    parts = urllib.parse.urlsplit(url).path.split('/')
    out = []
    for seg in (parts[-1], parts[-2] if len(parts) > 1 else ''):
        if not seg: continue
        t, y = parse_name(seg)
        if t and y: out.append((t, y))
    return out
movies = {m['id']: m for m in db['movies']}
key2movies = collections.defaultdict(list)
for m in db['movies']:
    if not m.get('release_year'): continue
    t = norm_title(re.sub(r'\(\d{4}\)', '', m['title']))
    if t: key2movies[(t, int(m['release_year']))].append(m['id'])
known = {s['source_url'] for s in db['sources']}
known_unq = {urllib.parse.unquote(u) for u in known}
matches = collections.defaultdict(list)
unmatched = 0
for line in open(idxf):
    r = json.loads(line); url = r['url']
    path = urllib.parse.unquote(url)
    if JUNK.search(path) or EPISODE.search(path): continue
    if url in known or path in known_unq: continue
    hit = None
    for t, y in candidates_for(url):
        for yy in (y,):
            if (t, yy) in key2movies: hit = key2movies[(t, yy)]; break
        if hit: break
    if not hit: unmatched += 1; continue
    if len(hit) > 1: continue  # ambiguous title+year
    matches[hit[0]].append({'server': r['server'], 'url': url})
pub = {m['id'] for m in db['movies'] if m['is_published']}
res = {str(k): v for k, v in matches.items() if k in pub}
json.dump(res, open(outf, 'w'))
c = collections.Counter(len(v) for v in res.values())
print('movies with new candidates', len(res), 'of', len(pub), '| candidate links', sum(len(v) for v in res.values()), '| unmatched files', unmatched)
print('per-server', collections.Counter(x['server'] for v in res.values() for x in v))
