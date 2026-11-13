import json,re,sys,collections
S=sys.argv[1]
db=json.load(open(S+'/work/db.json')); sky=json.load(open(S+'/work/sky_probe.json'))
def norm(n):
    n=n.lower(); n=re.sub(r'_\d+$','',n); n=re.sub(r'\(.*?\)|\[.*?\]','',n)
    n=re.sub(r'[^a-z0-9&+ ]',' ',n)
    toks=[t for t in n.split() if t not in('hd','fhd','sd','uhd','4k','tv','channel','live','bd','bangla')]
    return ' '.join(toks)
def norm_keep(n):
    n=n.lower(); n=re.sub(r'_\d+$','',n); n=re.sub(r'\(.*?\)|\[.*?\]','',n); n=re.sub(r'[^a-z0-9&+ ]',' ',n)
    return ' '.join(t for t in n.split() if t not in ('hd','fhd','sd','uhd','4k','tv','live'))
chans={c['id']:c for c in db['chans']}
byn=collections.defaultdict(list)
for c in db['chans']: byn[norm_keep(c['name'])].append(c['id'])
known=set(db['allSrcUrls'])|{c['stream_url'] for c in db['allChanUrls']}
srcby=collections.defaultdict(set)
for s in db['srcs']: srcby[s['channel_id']].add(s['stream_url'])
rows=[]
for x in sky:
    k=norm_keep(x['name'])
    m=byn.get(k,[])
    rows.append(dict(key=x['key'],name=x['name'],nk=k,url=x['url'],result=x['result'],height=x.get('height',0),known=x['url'] in known,match=m))
json.dump(rows,open(S+'/work/match.json','w'))
ok=[r for r in rows if r['result']=='ok']
print('ok',len(ok),'known',sum(r['known'] for r in ok),'matched-new-url',sum(1 for r in ok if r['match'] and not r['known']),'unmatched-new',sum(1 for r in ok if not r['match'] and not r['known']))
um=collections.Counter(r['nk'] for r in ok if not r['match'] and not r['known'])
print(len(um)); print(sorted(um))
