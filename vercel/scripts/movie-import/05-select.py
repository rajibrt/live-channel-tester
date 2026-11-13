# Choose which probed candidates to add to each movie and in what order.
# usage: python3 -I 05-select.py <db.json> <match.json> <probe.json> <plan.json> <review.csv>
import json, sys, csv, collections, urllib.parse
dbf, matchf, probef, planf, csvf = sys.argv[1:6]
catsf = sys.argv[6] if len(sys.argv) > 6 else None
db = json.load(open(dbf)); match = json.load(open(matchf)); probe = json.load(open(probef))
MAX_NEW, MAX_HEIGHT = 4, 1600          # skip 4K (heavy for streaming) and keep at most 4 new links
media = {m['source_url']: m for m in db['media']}
movies = {str(m['id']): m for m in db['movies']}
# Language check: a link must come from a folder/file in the movie's language (same title + year
# can be a different film, e.g. Kolkata "Boss" 2013 vs Hindi "Boss" 2013; Hindi-category movies are
# often Hindi-dubbed copies of English films).
movie_langs = collections.defaultdict(set)
if catsf:
    cd = json.load(open(catsf)); cname = {c['id']: c['name'] for c in cd['cats']}
    for r in cd['map']:
        n = cname.get(r['category_id'], '')
        movie_langs[str(r['movie_id'])].add({'Bangla': 'bn', 'Kolkata Bangla': 'bn', 'Hindi': 'hi', 'English': 'en'}.get(n, ''))
import re as _re
def path_langs(url):
    u = urllib.parse.unquote(url).lower(); out = set()
    if _re.search(r'bangla|kolkata|bengali', u): out.add('bn')
    if _re.search(r'/hindi|bollywood|hindi[ ._-]|\bhin\b|dual|multi', u): out.add('hi')
    if _re.search(r'english|hollywood|imdb|dual|multi|eng\b', u): out.add('en')
    if _re.search(r'hindi[ ._-]?dub', u) and not _re.search(r'dual|multi|eng', u): out.discard('en')
    return out
def lang_ok(mid, url):
    want = movie_langs.get(mid, set()) - {''}
    if not want: return True
    return bool(want & path_langs(url))
src_by_movie = collections.defaultdict(list)
for s in db['sources']: src_by_movie[str(s['movie_id'])].append(s)
def host_group(url, server=None):
    if server: return server
    h = urllib.parse.urlsplit(url).hostname or ''
    if 'discoveryftp' in h: return 'discovery'
    if 'ftpbd' in h: return 'ftpbd'
    if h.startswith('172.16.50.'): return 'dhakaflix' + h.split('.')[-1]
    return h
def score(c, p):
    s = 0
    if p.get('audio_ok'): s += 8
    if p.get('vcodec') == 'h264': s += 4
    h = p.get('height') or 0
    if 900 <= h <= 1100: s += 2
    elif 650 <= h < 900: s += 1
    if c['url'].endswith('_reencoded.mp4'): s += 1   # ftpbd re-encodes: h264 + aac, fast start
    return s
plan = []; rows = []
stats = collections.Counter()
for mid, cands in match.items():
    m = movies.get(mid)
    if not m or not m['is_published']: continue
    existing = sorted([s for s in src_by_movie[mid] if s['is_active']], key=lambda s: (s['sort_order'], s['id']))
    used_groups = {host_group(s['source_url']) for s in existing}
    ok = []
    for c in cands:
        p = probe.get(c['url'])
        if not p: stats['not probed'] += 1; continue
        if p['status'] != 'ok': stats['probe ' + p['status']] += 1; continue
        if not lang_ok(mid, c['url']): stats['skip language mismatch'] += 1; continue
        if (p.get('height') or 0) > MAX_HEIGHT: stats['skip 4K'] += 1; continue
        # duration sanity: a file far shorter than a feature film is probably a part/sample
        if p.get('duration') and p['duration'] < 40 * 60: stats['skip short'] += 1; continue
        ok.append((score(c, p), c, p))
    ok.sort(key=lambda x: -x[0])
    chosen = []; groups = set(used_groups)
    for sc, c, p in ok:                      # first pass: one per new server
        g = host_group(c['url'], c['server'])
        if g in groups: continue
        chosen.append((sc, c, p)); groups.add(g)
        if len(chosen) >= MAX_NEW: break
    for sc, c, p in ok:                      # second pass: fill with best remaining
        if len(chosen) >= MAX_NEW: break
        if any(c['url'] == x[1]['url'] for x in chosen): continue
        if sc < 8: continue                  # extra copies on a used server only if audio plays in browsers
        chosen.append((sc, c, p))
    if not chosen: continue
    stats['movies'] += 1; stats['links'] += len(chosen)
    # order: existing links with playable/unknown audio, new browser-audio links, other new links, existing bad-audio links
    def ex_bad(s): mi = media.get(s['source_url']); return bool(mi and (mi.get('browser_audio_ok') is False or mi.get('status') != 'ok'))
    ex_good = [s for s in existing if not ex_bad(s)]; ex_badl = [s for s in existing if ex_bad(s)]
    new_good = [x for x in chosen if x[2].get('audio_ok')]; new_other = [x for x in chosen if not x[2].get('audio_ok')]
    order = [('src', s['id']) for s in ex_good] + [('new', x[1]['url']) for x in new_good] + [('new', x[1]['url']) for x in new_other] + [('src', s['id']) for s in ex_badl]
    if ex_badl and new_good: stats['movies where a browser-audio link now plays before a bad-audio one'] += 1
    plan.append({'movie_id': int(mid), 'title': m['title'], 'year': m['release_year'], 'order': order,
                 'new': [{'url': x[1]['url'], 'server': x[1]['server'], 'label': host_group(x[1]['url'], x[1]['server']), 'probe': x[2]} for x in chosen]})
    for x in chosen:
        p = x[2]
        rows.append([mid, m['title'], m['release_year'], x[1]['server'], p.get('vcodec'), p.get('height'), '+'.join(p.get('acodecs') or []), 'yes' if p.get('audio_ok') else 'no', urllib.parse.unquote(x[1]['url'])])
json.dump(plan, open(planf, 'w'))
with open(csvf, 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['movie_id', 'title', 'year', 'server', 'video', 'height', 'audio', 'browser_audio', 'url']); w.writerows(rows)
print(dict(stats))
print('per server', collections.Counter(x['label'] for p in plan for x in p['new']))
print('new links with browser audio', sum(1 for p in plan for x in p['new'] if x['probe'].get('audio_ok')))
