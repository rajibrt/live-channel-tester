import fs from 'node:fs';
const [,, inFile, outFile] = process.argv;
const lines = fs.readFileSync(inFile,'utf8').split(/\r?\n/);
const items=[]; let name=null;
for (const l of lines){ if(l.startsWith('#EXTINF')) name=l.slice(l.indexOf(',')+1).trim(); else if(/^https?:/.test(l)){ items.push({idx:items.length,name,url:l.trim()}); name=null; } }
const UA='VLC/3.0.20 LibVLC/3.0.20';
async function resolve(u){
  let cur=u;
  for(let i=0;i<6;i++){
    const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),12000);
    try{ const r=await fetch(cur,{redirect:'manual',headers:{'user-agent':UA},signal:ac.signal});
      clearTimeout(t);
      if(r.status>=300&&r.status<400&&r.headers.get('location')){ cur=new URL(r.headers.get('location'),cur).href; try{await r.body?.cancel()}catch{}; if(!cur.includes('skym3u.dev')) return {final:cur,status:r.status}; continue; }
      const txt = r.status===200 ? (await r.text()).slice(0,300) : ''; return {final:cur,status:r.status,body:txt};
    }catch(e){ clearTimeout(t); return {final:cur,error:String(e.name||e)}; }
  }
  return {final:cur,error:'too many'};
}
let i=0; const out=[];
async function worker(){ while(i<items.length){ const it=items[i++]; const r=await resolve(it.url); out.push({...it,...r}); if(out.length%100===0) console.error(out.length); } }
await Promise.all(Array.from({length:12},worker));
out.sort((a,b)=>a.idx-b.idx);
fs.writeFileSync(outFile, JSON.stringify(out,null,1));
