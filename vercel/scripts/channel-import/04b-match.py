import json,re,sys,collections
S=sys.argv[1]
db=json.load(open(S+'/work/db.json')); rows=json.load(open(S+'/work/match.json'))
SER=re.compile(r'sport|ten|sony|bein|willow|espn|euro|sky|star|ptv|t sports|gazi|dd |zee|colors|sansad|ptc|9x|b4u|epic|anmol|goldmines|manoranjan|shemaroo|dangal|mh|wow|red bull|tvs|xite|tennis|rakuten')
def base(n):
    n=n.lower(); n=re.sub(r'_\d+$','',n); n=re.sub(r'\(.*?\)|\[.*?\]','',n); n=n.replace('&',' and ')
    n=re.sub(r'[^a-z0-9+ ]',' ',n)
    t=[x for x in n.split() if x not in('hd','fhd','sd','uhd','4k','tv','live','channel','television','official')]
    return t
def k1(n): return ''.join(base(n))
def k2(n):
    t=base(n)
    if t and t[-1].isdigit() and not SER.search(' '.join(t)+' '): t=t[:-1]
    return ''.join(t)
A=collections.defaultdict(set);B=collections.defaultdict(set)
for c in db['chans']:
    A[k1(c['name'])].add(c['id']); B[k2(c['name'])].add(c['id'])
ALIAS={'banglavision':'banglavision','bangla vision':'banglavision'}
for r in rows:
    a=A.get(k1(r['name'])) or B.get(k2(r['name'])) or B.get(k2(r['name'].replace(' ','')))
    r['match']=sorted(a or [])
json.dump(rows,open(S+'/work/match2.json','w'))
ok=[r for r in rows if r['result']=='ok' and not r['known']]
print('matched',sum(1 for r in ok if r['match']),'unmatched',sum(1 for r in ok if not r['match']))
ch={c['id']:c for c in db['chans']}
multi=[r for r in ok if len(r['match'])>1]
for r in multi: print('MULTI',r['name'],[ch[i]['name'] for i in r['match']])
um=sorted({k2(r['name']) for r in ok if not r['match']}); print(len(um)); print(um)
