import json,re,sys,os,collections,csv,datetime
S=sys.argv[1]; sys.path.insert(0,S); sys.path.insert(1,os.path.dirname(os.path.abspath(__file__)))
from newmap import NEW,EXTRA_MATCH,SKIP_HOST_RE
SER=re.compile(r'sport|ten|sony|bein|willow|espn|euro|sky|star|ptv|t sports|gazi|dd |zee|colors|sansad|ptc|9x|b4u|epic|anmol|goldmines|manoranjan|shemaroo|dangal|mh|wow|red bull|tvs|xite|tennis|rakuten')
def base(n):
    n=n.lower(); n=re.sub(r'_\d+$','',n); n=re.sub(r'\(.*?\)|\[.*?\]','',n); n=n.replace('&',' and ')
    n=re.sub(r'[^a-z0-9+ ]',' ',n)
    return [x for x in n.split() if x not in('hd','fhd','sd','uhd','4k','tv','live','channel','television','official')]
def k2(n):
    t=base(n)
    if t and t[-1].isdigit() and not SER.search(' '.join(t)+' '): t=t[:-1]
    return ''.join(t)
db=json.load(open(S+'/work/db.json')); ch={c['id']:c for c in db['chans']}
rows=json.load(open(S+'/work/match2.json'))
grab={g['key']:g for g in json.load(open(S+'/work/grab.json'))}
sp={x['key']:x for x in json.load(open(S+'/work/src_probe.json'))}
BLACK=18
NOFP={x['key']:x for x in json.load(open(S+'/work/nof_probe.json'))}
# keys judged by eye on contact sheets (No signal / colour bars / black / 'off air'): work/slate.json
SLATE=set(json.load(open(S+'/work/slate.json'))) if os.path.exists(S+'/work/slate.json') else set()
AONLY=json.load(open(S+'/work/aonly.json'))
def vis(key):
    if key in SLATE: return 'slate'
    g0=grab.get(key)
    if AONLY.get(key)=='AUDIO-ONLY' and not (g0 and g0['frame'] and g0['yavg'] is not None): return 'audio-only'
    if key in NOFP:
        st=NOFP[key]['streams']
        if st and not any(a[0]=='video' for a in st): return 'audio-only'
        if st and any(a[0]=='video' and a[1]=='h264' for a in st): return 'picture'
        return 'noframe'
    g=grab.get(key)
    if not g: return 'nograb'
    if not g['frame'] or g['yavg'] is None: return 'noframe'
    if g['yavg']<BLACK: return 'black'
    return 'picture'
# --- candidates from sky
cands=collections.defaultdict(list)  # target -> list of rows ; target = int id or 'NEW:name|cat'
skipped=collections.Counter()
for r in rows:
    if r['result']!='ok' or r['known'] or r['key']=='sky0': continue
    if re.search(SKIP_HOST_RE,r['url']): skipped['tokenized']+=1; continue
    v=vis(r['key'])
    if v!='picture': skipped['sky '+v]+=1; continue
    clean=re.sub(r'_\d+$','',r['name'])
    tgt=None
    if clean in EXTRA_MATCH:
        tgt=EXTRA_MATCH[clean]
        if tgt is None: skipped['ambiguous']+=1; continue
    elif r['match']:
        tgt=r['match'][0] if len(r['match'])==1 else None
        if tgt is None: skipped['ambiguous']+=1; continue
    else:
        m=NEW.get(k2(r['name']))
        if not m: skipped['not wanted']+=1; continue
        if m[0].startswith('='):
            tgt=2597 if m[0]=='=RUPASI' else int(m[0][1:])
        else: tgt='NEW:%s|%s'%m
    cands[tgt].append(r)
MAXNEW=3
plan={'add_sources':[], 'new_channels':[], 'reorder':[], 'dead':[], 'skipped':dict(skipped)}
srcs=collections.defaultdict(list)
for s in db['srcs']: srcs[s['channel_id']].append(s)
def srcstate(s):
    p=sp['src%d'%s['id']]['result']
    if p!='ok': return p
    c=ch[s['channel_id']]
    v=vis('src%d'%s['id'])
    if v in('black','audio-only','slate'): return v
    return 'ok'
recent_cut=(datetime.datetime.now(datetime.UTC).replace(tzinfo=None)-datetime.timedelta(days=3)).isoformat()
def viewer_ok(s): return (s.get('last_success_at') or '')>recent_cut and (s.get('last_success_at') or '')>(s.get('last_failure_at') or '')
for cid,c in ch.items():
    ss=sorted(srcs[cid],key=lambda s:(s['priority'],s['id']))
    act=[s for s in ss if s['is_active']]
    st={s['id']:srcstate(s) for s in act}
    good=[s for s in act if st[s['id']]=='ok' or (viewer_ok(s) and st[s['id']] not in('black','audio-only','slate'))]
    bad=[s for s in act if s not in good]
    new=sorted(cands.get(cid,[]),key=lambda r:-(r['height'] or 0))[:MAXNEW]
    for r in new: plan['add_sources'].append({'channel_id':cid,'channel':c['name'],'category':c['category'],'sky_name':r['name'],'url':r['url'],'height':r['height'],'first':not good})
    order=[('src',s['id']) for s in good]+[('new',r['url']) for r in new]+[('src',s['id']) for s in bad]
    old=[('src',s['id']) for s in act]
    if new or order[:len(old)]!=old and len(act)>1:
        plan['reorder'].append({'channel_id':cid,'channel':c['name'],'order':order,'states':{str(k):v for k,v in st.items()},'changed_top': order[0]!=old[0] if old else True})
    if not good and not new and c['status']=='LIVE':
        plan['dead'].append({'channel_id':cid,'channel':c['name'],'category':c['category'],'states':[st[s['id']] for s in act],'n':len(act),'viewer_success':sum(s['success_count'] or 0 for s in act)})
for tgt,rs in cands.items():
    if isinstance(tgt,str):
        name,cat=tgt[4:].split('|')
        rs=sorted(rs,key=lambda r:-(r['height'] or 0))[:MAXNEW+1]
        plan['new_channels'].append({'name':name,'category':cat,'urls':[r['url'] for r in rs],'heights':[r['height'] for r in rs],'sky_names':[r['name'] for r in rs]})
json.dump(plan,open(S+'/work/plan.json','w'),indent=1)
print('skipped',dict(skipped))
print('add_sources',len(plan['add_sources']),'to',len({a['channel_id'] for a in plan['add_sources']}),'channels; placed first',sum(a['first'] for a in plan['add_sources']))
print('new channels',len(plan['new_channels']),'links',sum(len(n['urls']) for n in plan['new_channels']))
print('reorder',len(plan['reorder']),'top changed',sum(r['changed_top'] for r in plan['reorder']))
dc=collections.Counter(d['category'] for d in plan['dead']); print('no working link',len(plan['dead']),dc)
if len(sys.argv)>2:
    nw=sorted({re.sub(r'_\d+$','',r['name'])+' ['+k2(r['name'])+']' for r in rows if r['result']=='ok' and not r['known'] and not r['match'] and not NEW.get(k2(r['name'])) and re.sub(r'_\d+$','',r['name']) not in EXTRA_MATCH})
    print(nw)
