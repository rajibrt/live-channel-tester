import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const sb=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function all(t,sel,f){ let o=[],p=0; for(;;){ let q=sb.from(t).select(sel).range(p*1000,p*1000+999); if(f) q=f(q); const {data,error}=await q; if(error) throw error; o=o.concat(data); if(data.length<1000) break; p++; } return o; }
const pls=await all('playlists','*');
const bd=pls.find(p=>p.slug==='bdix');
const links=await all('playlist_channels','*',q=>q.eq('playlist_slug','bdix'));
const ids=links.map(l=>l.channel_id);
let chans=[],srcs=[];
for(let i=0;i<ids.length;i+=200){ chans=chans.concat(await all('channels','*',q=>q.in('id',ids.slice(i,i+200)))); srcs=srcs.concat(await all('channel_sources','*',q=>q.in('channel_id',ids.slice(i,i+200)))); }
const groups=await all('playlist_groups','*',q=>q.eq('playlist_slug','bdix'));
const allSrcUrls=(await all('channel_sources','stream_url')).map(x=>x.stream_url);
const allChanUrls=(await all('channels','id,name,stream_url'));
fs.writeFileSync(process.argv[2],JSON.stringify({playlist:bd,links,chans,srcs,groups,allSrcUrls,allChanUrls}));
console.log(Object.keys(bd), links.length, chans.length, srcs.length, groups.length, Object.keys(chans[0]), Object.keys(srcs[0]), Object.keys(links[0]));
