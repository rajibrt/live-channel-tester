import json,sys,os
from PIL import Image,ImageDraw,ImageFont
S,prefix,outbase=sys.argv[1],sys.argv[2],sys.argv[3]
g=[x for x in json.load(open(S+'/work/grab.json')) if x['key'].startswith(prefix) and x['frame'] and x['yavg'] is not None]
if len(sys.argv)>4:
    keep=set(json.load(open(sys.argv[4]))); g=[x for x in g if x['key'] in keep]
g.sort(key=lambda x:x['name'].lower())
W,H,C=320,200,6
try: f=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',15)
except: f=ImageFont.load_default()
for p in range(0,len(g),36):
    chunk=g[p:p+36]; rows=(len(chunk)+C-1)//C
    im=Image.new('RGB',(W*C,(H+22)*rows),'white'); d=ImageDraw.Draw(im)
    for i,x in enumerate(chunk):
        try: t=Image.open(os.path.join(S,'frames',x['key']+'.jpg')).convert('RGB'); t.thumbnail((W,H))
        except Exception: continue
        X,Y=(i%C)*W,(i//C)*(H+22); im.paste(t,(X,Y))
        d.text((X+3,Y+H+3),(x['key']+' '+x['name'])[:40],fill='black',font=f)
    im.save('%s-%d.jpg'%(outbase,p//36),quality=70)
    print('%s-%d.jpg'%(outbase,p//36),len(chunk))
