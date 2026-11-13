// Crawl HTML directory listings (Apache/nginx autoindex, h5ai fallback) and list video files.
// usage: node 01-crawl-index.mjs <seeds.json> <out.ndjson> [concurrency]
// seeds.json: [{ "server": "dhakaflix7", "url": "http://172.16.50.7/DHAKA-FLIX-7/English%20Movies/" }, ...]
// Only follows links below each seed URL. Run on a machine inside the BD ISP network.
import fs from 'node:fs';
const [,, seedsF, outF, concArg] = process.argv;
const seeds = JSON.parse(fs.readFileSync(seedsF, 'utf8'));
const CONC = Number(concArg || 6);
const VIDEO = /\.(mkv|mp4|avi|m4v|webm|mov|ts|m3u8)$/i;
const out = fs.createWriteStream(outF, { flags: 'a' });
const seen = new Set();
const queue = [];
let files = 0, pages = 0, errors = 0;
for (const s of seeds) queue.push({ url: s.url, root: s.url, server: s.server, depth: 0 });
async function fetchText(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
    try {
      const r = await fetch(url, { signal: ac.signal, headers: { 'user-agent': 'Mozilla/5.0' } });
      const tx = r.ok ? await r.text() : ''; clearTimeout(t); return tx;
    } catch { clearTimeout(t); }
  }
  errors++; return '';
}
async function work() {
  while (queue.length) {
    const job = queue.shift();
    if (seen.has(job.url)) continue; seen.add(job.url);
    const html = await fetchText(job.url); pages++;
    for (const m of html.matchAll(/href="([^"#?]+)"/gi)) {
      let abs; try { abs = new URL(m[1].replace(/&amp;/g, '&'), job.url).href; } catch { continue; }
      if (!abs.startsWith(job.root) || abs === job.url) continue;
      if (abs.endsWith('/')) { if (job.depth < 6 && !seen.has(abs)) queue.push({ ...job, url: abs, depth: job.depth + 1 }); }
      else if (VIDEO.test(abs) && !seen.has(abs)) { seen.add(abs); files++; out.write(JSON.stringify({ server: job.server, url: abs }) + '\n'); }
    }
    if (pages % 200 === 0) console.error(`pages ${pages} files ${files} queue ${queue.length} errors ${errors}`);
  }
}
// queue grows while workers run; restart workers until both are empty
while (queue.length) await Promise.all(Array.from({ length: CONC }, work));
out.end(); console.error(`done pages ${pages} files ${files} errors ${errors}`);
