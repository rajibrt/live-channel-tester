// usage: node probe.mjs in.json out.json  (in: [{key,url}])
import fs from 'node:fs';
const [,, inF, outF, concArg] = process.argv;
const items = JSON.parse(fs.readFileSync(inF,'utf8'));
const UA='VLC/3.0.20 LibVLC/3.0.20';
async function get(u, ms=10000, bytes=false){
  const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),ms);
  try{ const r=await fetch(u,{headers:{'user-agent':UA},signal:ac.signal,redirect:'follow'});
    if(!bytes){ const tx=await r.text(); clearTimeout(t); return {status:r.status,url:r.url,text:tx,cors:r.headers.get('access-control-allow-origin')}; }
    const rd=r.body.getReader(); let n=0; const st=Date.now();
    while(n<120000 && Date.now()-st<ms){ const {done,value}=await rd.read(); if(done)break; n+=value.length; }
    try{ac.abort()}catch{} clearTimeout(t); return {status:r.status,bytes:n,ctype:r.headers.get('content-type')};
  }catch(e){ clearTimeout(t); return {error:String(e.name||e.code||e)}; }
}
async function probe(url){
  const isHls=/\.m3u8|m3u8/i.test(url);
  const m=await get(url);
  if(m.error) return {result:'unreachable',why:m.error};
  if(m.status!==200) return {result: (m.status===403||m.status===401)?'blocked':'gone', why:'http '+m.status};
  if(!m.text.startsWith('#EXTM3U')){ // maybe raw TS
    if(isHls) return {result:'gone',why:'not m3u8'};
    return {result:'ok',why:'non-hls',cors:m.cors};
  }
  let txt=m.text, base=m.url, height=0;
  if(/#EXT-X-STREAM-INF/.test(txt)){
    const ls=txt.split(/\r?\n/); let best=null;
    for(let i=0;i<ls.length;i++) if(ls[i].startsWith('#EXT-X-STREAM-INF')){ const h=+(ls[i].match(/RESOLUTION=\d+x(\d+)/)||[])[1]||0; let j=i+1; while(j<ls.length&&(!ls[j]||ls[j].startsWith('#')))j++; if(ls[j]&&(!best||h>best.h)) best={h,u:ls[j].trim()}; }
    if(!best) return {result:'gone',why:'empty master'};
    height=best.h; base=new URL(best.u,base).href;
    const v=await get(base); if(v.error) return {result:'unreachable',why:'variant '+v.error}; if(v.status!==200) return {result:'gone',why:'variant http '+v.status};
    txt=v.text; base=v.url;
  }
  const segs=txt.split(/\r?\n/).filter(l=>l&&!l.startsWith('#'));
  if(!segs.length) return {result:'gone',why:'no segments',height};
  if(/#EXT-X-ENDLIST/.test(txt)&&segs.length<4) return {result:'gone',why:'vod/slate',height};
  const seg=new URL(segs[segs.length-1],base).href;
  const s=await get(seg,12000,true);
  if(s.error) return {result:'unreachable',why:'seg '+s.error,height};
  if(s.status!==200&&s.status!==206) return {result:'gone',why:'seg http '+s.status,height};
  if(s.bytes<2000) return {result:'gone',why:'seg tiny',height};
  return {result:'ok',height,cors:m.cors};
}
let i=0; const out=[];
async function w(){ while(i<items.length){ const it=items[i++]; const r=await probe(it.url); out.push({...it,...r}); if(out.length%100===0) console.error(out.length); } }
await Promise.all(Array.from({length:+(concArg||16)},w));
fs.writeFileSync(outF, JSON.stringify(out,null,1));
const c={}; for(const x of out) c[x.result]=(c[x.result]||0)+1; console.log(c);
