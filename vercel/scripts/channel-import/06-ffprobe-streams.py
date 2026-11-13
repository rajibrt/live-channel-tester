import json,subprocess,sys,concurrent.futures as cf
inF,outF=sys.argv[1:3]
items=json.load(open(inF))
def p(it):
    cmd=['ffprobe','-v','error','-user_agent','VLC/3.0.20 LibVLC/3.0.20','-rw_timeout','15000000','-extension_picky','0','-allowed_extensions','ALL','-show_entries','stream=codec_type,codec_name,width,height','-of','json',it['url']]
    try:
        r=subprocess.run(cmd,capture_output=True,text=True,timeout=45)
        st=json.loads(r.stdout or '{}').get('streams',[])
        return {**it,'streams':[(s.get('codec_type'),s.get('codec_name'),s.get('height')) for s in st],'perr':r.stderr[-150:]}
    except Exception as e: return {**it,'streams':None,'perr':str(e)[:80]}
with cf.ThreadPoolExecutor(12) as ex: out=list(ex.map(p,items))
json.dump(out,open(outF,'w'))
