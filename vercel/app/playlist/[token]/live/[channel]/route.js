import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { pickBestChannelSource } from "../../../../../lib/channelSourcePick";

// Smart link used in the public M3U for channels that have backup links.
// IPTV apps (TiviMate etc.) open this URL; we answer with a 302 to the best
// link right now: the admin's order, minus links that website viewers have
// recently reported as failing. Players re-request this URL on every live
// playlist refresh, so the choice is deterministic and cached briefly.

const TOKEN_TTL_MS = 60_000;
const CHANNEL_TTL_MS = 30_000;
const tokenCache = new Map(); // token -> { slug, at }
const channelCache = new Map(); // `${slug}:${id}` -> { url, at }

function normalizeToken(raw) {
  const value = String(raw || "").trim().toLowerCase();
  return /^[a-f0-9]{16,128}$/.test(value) ? value : "";
}

function normalizeChannelId(raw) {
  const value = String(raw || "").trim().replace(/\.(m3u8|ts)$/i, "");
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

async function resolveSlug(admin, token) {
  const hit = tokenCache.get(token);
  if (hit && Date.now() - hit.at < TOKEN_TTL_MS) return hit.slug;
  const { data } = await admin.from("playlist_tokens").select("playlist_slug,is_active").eq("token", token).maybeSingle();
  const slug = data?.is_active === true ? String(data.playlist_slug || "") : "";
  tokenCache.set(token, { slug, at: Date.now() });
  return slug;
}

async function resolveUrl(admin, slug, channelId) {
  const key = `${slug}:${channelId}`;
  const hit = channelCache.get(key);
  if (hit && Date.now() - hit.at < CHANNEL_TTL_MS) return hit.url;

  const [{ data: link }, { data: channel }, { data: sources }] = await Promise.all([
    admin.from("playlist_channels").select("channel_id").eq("playlist_slug", slug).eq("channel_id", channelId).maybeSingle(),
    admin.from("channels").select("id,stream_url").eq("id", channelId).maybeSingle(),
    admin
      .from("channel_sources")
      .select("id,stream_url,priority,is_active,failure_count,success_count,last_failure_at,last_success_at")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  let url = "";
  if (link && channel) {
    const best = pickBestChannelSource(sources || []);
    url = String(best?.stream_url || channel.stream_url || "").trim();
  }
  channelCache.set(key, { url, at: Date.now() });
  if (channelCache.size > 5000) channelCache.clear();
  return url;
}

async function handle(_request, context) {
  const params = await context.params;
  const token = normalizeToken(params?.token);
  const channelId = normalizeChannelId(params?.channel);
  if (!token || !channelId) return new Response("Not found", { status: 404 });

  const admin = getSupabaseAdmin();
  const slug = await resolveSlug(admin, token);
  if (!slug) return new Response("Not found", { status: 404 });
  const url = await resolveUrl(admin, slug, channelId);
  if (!/^https?:\/\//i.test(url)) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: { location: url, "cache-control": "no-store" },
  });
}

export const GET = handle;
export const HEAD = handle;
