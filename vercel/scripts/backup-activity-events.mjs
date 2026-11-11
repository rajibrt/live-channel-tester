// Back up public.client_activity_events to gzipped NDJSON (one row per line).
// Usage (from vercel/): node --env-file=.env.local scripts/backup-activity-events.mjs ../backups
import { createClient } from "@supabase/supabase-js";
import { createWriteStream, writeFileSync } from "node:fs";
import { createGzip } from "node:zlib";
import path from "node:path";

const outDir = path.resolve(process.argv[2] || "../backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(outDir, `client_activity_events-${stamp}.ndjson.gz`);
const admin = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { count: expected } = await admin.from("client_activity_events").select("id", { count: "exact", head: true });
const gz = createGzip();
const out = createWriteStream(file);
gz.pipe(out);

let lastId = 0, written = 0, minAt = null, maxAt = null;
const byType = {};
for (;;) {
  let attempt = 0, res;
  do {
    res = await admin.from("client_activity_events")
      .select("id,user_id,event_type,event_data,created_at")
      .gt("id", lastId).order("id", { ascending: true }).limit(1000);
    if (res.error) await new Promise((r) => setTimeout(r, 1000 * ++attempt));
  } while (res.error && attempt < 5);
  if (res.error) throw new Error(res.error.message);
  const rows = res.data || [];
  if (!rows.length) break;
  for (const row of rows) {
    if (!gz.write(JSON.stringify(row) + "\n")) await new Promise((r) => gz.once("drain", r));
    byType[row.event_type] = (byType[row.event_type] || 0) + 1;
    if (!minAt || row.created_at < minAt) minAt = row.created_at;
    if (!maxAt || row.created_at > maxAt) maxAt = row.created_at;
  }
  written += rows.length;
  lastId = rows[rows.length - 1].id;
  if (written % 50000 < 1000) console.log(`backed up ${written}/${expected}`);
}
gz.end();
await new Promise((r) => out.on("finish", r));
const manifest = { table: "client_activity_events", file: path.basename(file), expected_count_at_start: expected, written, last_id: lastId, min_created_at: minAt, max_created_at: maxAt, by_event_type: byType, created_at: new Date().toISOString() };
writeFileSync(file.replace(/\.ndjson\.gz$/, ".manifest.json"), JSON.stringify(manifest, null, 2));
console.log("DONE", JSON.stringify({ file, expected, written, lastId }));
