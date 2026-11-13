import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const [,,urlsF,newLogF,outF,mode]=process.argv;
const sb=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const urls=JSON.parse(fs.readFileSync(urlsF)); const newIds=new Set((JSON.parse(fs.readFileSync(newLogF)).newChannels||[]).map(n=>n.id));
const {data:rows,error}=await sb.from('channel_sources').select('*').in('stream_url',urls).eq('is_active',true); if(error) throw error;
const log={deactivated:rows.map(r=>r.id),channels:[]};
const cids=[...new Set(rows.map(r=>r.channel_id))];
for(const cid of cids){
  const {data:ch}=await sb.from('channels').select('id,name,stream_url,status').eq('id',cid).single();
  const {data:others}=await sb.from('channel_sources').select('id,stream_url,priority').eq('channel_id',cid).eq('is_active',true).not('stream_url','in','('+urls.map(u=>'"'+u+'"').join(',')+')').order('priority').order('id');
  let action='keep';
  if(!others.length) action=newIds.has(cid)?'delete':'DEAD';
  log.channels.push({id:cid,name:ch.name,action,newTop:others[0]?.stream_url||null});
  if(mode!=='apply') continue;
  if(action==='delete'){ await sb.from('playlist_channels').delete().eq('playlist_slug','bdix').eq('channel_id',cid); const {count}=await sb.from('playlist_channels').select('*',{count:'exact',head:true}).eq('channel_id',cid); if(!count) await sb.from('channels').delete().eq('id',cid); else log.channels.at(-1).keptForOtherPlaylist=true; continue; }
  await sb.from('channel_sources').update({is_active:false,updated_at:new Date().toISOString()}).eq('channel_id',cid).in('stream_url',urls);
  if(action==='DEAD') await sb.from('channels').update({status:'DEAD'}).eq('id',cid);
  else if(others[0].stream_url!==ch.stream_url){ const r=await sb.from('channels').update({stream_url:others[0].stream_url}).eq('id',cid); if(r.error) log.channels.at(-1).err=r.error.message; }
}
fs.writeFileSync(outF,JSON.stringify(log,null,1)); console.log(JSON.stringify(log.channels));
