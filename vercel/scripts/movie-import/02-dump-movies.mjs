// Dump movies + all movie_sources (+ media info) to JSON. Run from vercel/ with --env-file=.env.local
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function all(t, sel) { let o = [], p = 0; for (;;) { const { data, error } = await sb.from(t).select(sel).range(p * 1000, p * 1000 + 999); if (error) throw error; o = o.concat(data); if (data.length < 1000) break; p++; } return o; }
const movies = await all('movies', 'id,title,release_year,is_published,imdb_id');
const sources = await all('movie_sources', 'id,movie_id,label,source_url,is_active,sort_order');
const media = await all('movie_source_media_info', 'source_url,status,audio_codecs,browser_audio_ok').catch(() => []);
fs.writeFileSync(process.argv[2], JSON.stringify({ movies, sources, media }));
console.log(movies.length, sources.length, media.length);
