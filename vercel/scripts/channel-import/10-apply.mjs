import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const [,,S,BK]=process.argv;
const sb=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const plan=JSON.parse(fs.readFileSync(S+'/work/plan.json'));
async function all(t,sel,f){ let o=[],p=0; for(;;){ let q=sb.from(t).select(sel).range(p*1000,p*1000+999); if(f) q=f(q); const {data,error}=await q; if(error) throw error; o=o.concat(data); if(data.length<1000) break; p++; } return o; }
function must(r,what){ if(r.error){ throw new Error(what+': '+r.error.message); } return r.data; }
// ---- backup
const links=await all('playlist_channels','*',q=>q.eq('playlist_slug','bdix'));
const ids=links.map(l=>l.channel_id); let chans=[],srcs=[],other=[];
for(let i=0;i<ids.length;i+=200){ const part=ids.slice(i,i+200);
  chans=chans.concat(await all('channels','*',q=>q.in('id',part)));
  srcs=srcs.concat(await all('channel_sources','*',q=>q.in('channel_id',part)));
  other=other.concat(await all('playlist_channels','*',q=>q.in('channel_id',part).neq('playlist_slug','bdix'))); }
const groups=await all('playlist_groups','*',q=>q.eq('playlist_slug','bdix'));
fs.writeFileSync(BK,JSON.stringify({at:new Date().toISOString(),links,chans,srcs,otherPlaylistLinks:other,groups}));
console.log('backup',links.length,chans.length,srcs.length);
const chanById=new Map(chans.map(c=>[c.id,c])); const srcById=new Map(srcs.map(s=>[s.id,s]));
const log={addedSources:[],newChannels:[],priorityChanges:[],deactivated:[],dead:[],removedFromBdix:[],deletedChannels:[],streamUrlUpdates:[],errors:[]};
const now=new Date().toISOString();
// ---- reorder + add sources to existing channels
for(const r of plan.reorder){
  if(!chanById.has(r.channel_id)) continue;
  let pr=0;
  for(const [kind,v] of r.order){
    if(kind==='src'){
      const s=srcById.get(v); if(!s) continue;
      const st=r.states[String(v)]||'ok';
      const patch={priority:pr};
      if(['audio-only','slate','black'].includes(st)){ patch.is_active=false; log.deactivated.push(v); }
      if(s.priority!==pr||patch.is_active===false){ must(await sb.from('channel_sources').update({...patch,updated_at:now}).eq('id',v),'upd src'); log.priorityChanges.push([v,s.priority,pr]); }
    } else {
      const res=await sb.from('channel_sources').insert({channel_id:r.channel_id,stream_url:v,label:'sky',priority:pr,is_active:true}).select('id');
      if(res.error){ log.errors.push(['add',r.channel_id,v,res.error.message]); continue; }
      log.addedSources.push({id:res.data[0].id,channel_id:r.channel_id,url:v,priority:pr});
    }
    pr++;
  }
}
// ---- new channels
let pos=Math.max(...links.map(l=>l.position))+1;
for(const n of plan.new_channels){
  const ins=await sb.from('channels').insert({playlist_slug:'bdix',name:n.name,category:n.category,logo_url:'',stream_url:n.urls[0],status:'LIVE',include_on_home:true,updated_at:now}).select('id');
  if(ins.error){ log.errors.push(['newch',n.name,ins.error.message]); continue; }
  const id=ins.data[0].id;
  must(await sb.from('playlist_channels').insert({playlist_slug:'bdix',channel_id:id,position:pos++}),'link');
  const rows=n.urls.map((u,i)=>({channel_id:id,stream_url:u,label:'sky',priority:i,is_active:true}));
  must(await sb.from('channel_sources').insert(rows),'src new');
  log.newChannels.push({id,name:n.name,category:n.category,urls:n.urls});
}
// ---- dead / delete
for(const x of plan.dead){
  if(!chanById.has(x.channel_id)) continue;
  if(x.action==='mark DEAD'){ must(await sb.from('channels').update({status:'DEAD',updated_at:now}).eq('id',x.channel_id),'dead'); log.dead.push(x.channel_id); }
  else {
    must(await sb.from('playlist_channels').delete().eq('playlist_slug','bdix').eq('channel_id',x.channel_id),'unlink');
    log.removedFromBdix.push(x.channel_id);
    const o=other.filter(l=>l.channel_id===x.channel_id);
    if(!o.length){ must(await sb.from('channels').delete().eq('id',x.channel_id),'delch'); log.deletedChannels.push(x.channel_id); }
  }
}
// ---- channels.stream_url = top active source
const touched=new Set([...plan.reorder.map(r=>r.channel_id)]);
for(const cid of touched){
  if(!chanById.has(cid)||log.deletedChannels.includes(cid)) continue;
  const top=await sb.from('channel_sources').select('stream_url').eq('channel_id',cid).eq('is_active',true).order('priority').order('id').limit(1);
  const u=top.data?.[0]?.stream_url; const c=chanById.get(cid);
  if(u&&u!==c.stream_url){ const r=await sb.from('channels').update({stream_url:u,updated_at:now}).eq('id',cid); if(r.error) log.errors.push(['streamurl',cid,r.error.message]); else log.streamUrlUpdates.push([cid,c.stream_url,u]); }
}
const {count}=await sb.from('playlist_channels').select('*',{count:'exact',head:true}).eq('playlist_slug','bdix');
await sb.from('playlists').update({channel_count:count,updated_at:now}).eq('slug','bdix');
log.bdixCount=count;
fs.writeFileSync(BK.replace('before','applied'),JSON.stringify(log,null,1));
console.log({added:log.addedSources.length,newCh:log.newChannels.length,prio:log.priorityChanges.length,deact:log.deactivated.length,dead:log.dead.length,unlinked:log.removedFromBdix.length,deleted:log.deletedChannels.length,urlUpd:log.streamUrlUpdates.length,errors:log.errors.length,bdix:count});
console.log(log.errors.slice(0,10));
