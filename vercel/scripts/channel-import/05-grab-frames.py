import json,subprocess,sys,os,re,concurrent.futures as cf
inF,outF,fd=sys.argv[1:4]
items=json.load(open(inF))
def g(it):
    p=os.path.join(fd,it['key']+'.jpg')
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-user_agent','VLC/3.0.20 LibVLC/3.0.20','-rw_timeout','15000000','-i',it['url'],'-ss','3','-t','4','-vf','fps=1,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-,scale=320:-2','-update','1','-frames:v','4',p]
    try:
        r=subprocess.run(cmd,capture_output=True,text=True,timeout=35)
        ys=[float(x) for x in re.findall(r'YAVG=([\d.]+)',r.stdout)]
        ok=os.path.exists(p) and os.path.getsize(p)>0
        # audio presence
        return {**it,'frame':ok,'yavg':(max(ys) if ys else None),'ymin':(min(ys) if ys else None),'err':r.stderr[-200:] if not ok else ''}
    except subprocess.TimeoutExpired:
        return {**it,'frame':os.path.exists(p),'yavg':None,'err':'timeout'}
out=[]
with cf.ThreadPoolExecutor(12) as ex:
    for i,r in enumerate(ex.map(g,items)):
        out.append(r)
        if i%50==0: print(i,flush=True)
json.dump(out,open(outF,'w'))
print('done',sum(1 for x in out if x['frame']),len(out))
