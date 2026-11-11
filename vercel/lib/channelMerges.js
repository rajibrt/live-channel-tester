import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "./supabaseAdmin";

// When duplicate channels are merged, the removed ids are recorded in
// admin_settings.channel_merges as { map: { "<oldId>": <keptId> } } so old
// /watch links, favorites and IPTV links keep working.
export const CHANNEL_MERGES_KEY = "channel_merges";

async function loadMergeMap() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("admin_settings").select("value_json").eq("key", CHANNEL_MERGES_KEY).maybeSingle();
  if (error || !data?.value_json?.map || typeof data.value_json.map !== "object") return {};
  return data.value_json.map;
}

const getCachedMergeMap = unstable_cache(loadMergeMap, ["channel-merge-map"], { revalidate: 300 });

// Follows chains (a -> b -> c) and returns the surviving id, or 0 when the id was never merged.
export async function resolveMergedChannelId(id) {
  const map = await getCachedMergeMap().catch(() => ({}));
  let current = String(Number(id) || "");
  let hops = 0;
  while (current && map[current] && hops < 5) {
    current = String(map[current]);
    hops += 1;
  }
  return hops > 0 ? Number(current) : 0;
}
