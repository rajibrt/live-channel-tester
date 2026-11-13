import fs from 'node:fs';
const S=process.argv[2];
const d=JSON.parse(fs.readFileSync(S+'/work/db.json')); const m=JSON.parse(fs.readFileSync(S+'/work/match2.json'));
const items=[...d.srcs.filter(s=>s.is_active).map(s=>['src'+s.id,s.stream_url]),...m.filter(r=>r.result==='ok'&&!r.known).map(r=>[r.key,r.url])];
const res={}; let i=0;
async function f([k,u]){ const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),10000);
  try{ const r=await fetch(u,{headers:{'user-agent':'VLC/3.0.20'},signal:ac.signal}); const tx=(await r.text()).slice(0,30000); clearTimeout(t);
    const infs=[...tx.matchAll(/#EXT-X-STREAM-INF:([^\n]*)/g)].map(x=>x[1]); if(!infs.length) return 'media';
    const cod=infs.map(x=>(x.match(/CODECS="([^"]*)"/)||[])[1]);
    if(cod.every(c=>c&&!/avc|hvc|hev|vp9|av01/.test(c))) return 'AUDIO-ONLY';
    if(cod.some(c=>c&&/hvc|hev/.test(c))&&!cod.some(c=>c&&/avc/.test(c))) return 'HEVC';
    return 'video'; }catch{ clearTimeout(t); return null; } }
async function w(){ while(i<items.length){ const it=items[i++]; res[it[0]]=await f(it);} }
await Promise.all(Array.from({length:16},w));
fs.writeFileSync(S+'/work/aonly.json',JSON.stringify(res));
const c={}; for(const v of Object.values(res)) c[v]=(c[v]||0)+1; console.log(c);
console.log(Object.entries(res).filter(([k,v])=>v==='AUDIO-ONLY'||v==='HEVC').map(x=>x.join(':')).join(' '));
