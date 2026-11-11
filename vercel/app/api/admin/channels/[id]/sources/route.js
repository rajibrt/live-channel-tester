import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { normalizeStreamUrl } from "../../../../../../lib/streamUrl";

// Manage the ordered failover links of one TV channel
// (table from supabase/channel_sources.sql).

const MAX_SOURCES = 20;

function isMissingTable(error) {
  const msg = String(error?.message || "").toLowerCase();
  return error?.code === "PGRST205" || (msg.includes("channel_sources") && msg.includes("schema cache"));
}

function parseChannelId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function loadState(admin, channelId) {
  const { data: channel, error: channelError } = await admin
    .from("channels")
    .select("id,name,stream_url,status,category,logo_url")
    .eq("id", channelId)
    .maybeSingle();
  if (channelError) throw new Error(channelError.message);
  if (!channel) return { channel: null, sources: [] };

  const { data: rows, error } = await admin
    .from("channel_sources")
    .select("id,stream_url,label,priority,is_active,success_count,failure_count,last_success_at,last_failure_at")
    .eq("channel_id", channelId)
    .order("priority", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    if (isMissingTable(error)) {
      const err = new Error("channel_sources table is missing. Run vercel/supabase/channel_sources.sql in Supabase first.");
      err.status = 503;
      throw err;
    }
    throw new Error(error.message);
  }

  let sources = Array.isArray(rows) ? rows : [];
  // Channels created after the backfill may have no rows yet: show the primary URL.
  if (!sources.length && channel.stream_url) {
    sources = [{ id: null, stream_url: channel.stream_url, label: "primary", priority: 0, is_active: true, success_count: 0, failure_count: 0 }];
  }
  return { channel, sources };
}

export async function GET(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channelId = parseChannelId(id);
  if (!channelId) return NextResponse.json({ error: "Invalid channel id." }, { status: 400 });

  try {
    const state = await loadState(getSupabaseAdmin(), channelId);
    if (!state.channel) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load sources." }, { status: error.status || 500 });
  }
}

// Body: { sources: [{ stream_url, label, is_active }] } in the desired order.
// Replaces the channel's source list and keeps channels.stream_url = first active link.
export async function PUT(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channelId = parseChannelId(id);
  if (!channelId) return NextResponse.json({ error: "Invalid channel id." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const input = Array.isArray(body?.sources) ? body.sources : [];
  const cleaned = [];
  const seen = new Set();
  for (const item of input) {
    const url = normalizeStreamUrl(item?.stream_url);
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: `Only http/https links are allowed: ${url.slice(0, 80)}` }, { status: 400 });
    }
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      stream_url: url,
      label: String(item?.label || "").trim().slice(0, 60),
      is_active: item?.is_active !== false,
    });
  }
  if (!cleaned.length) return NextResponse.json({ error: "At least one link is required." }, { status: 400 });
  if (cleaned.length > MAX_SOURCES) {
    return NextResponse.json({ error: `A channel can have at most ${MAX_SOURCES} links.` }, { status: 400 });
  }
  if (!cleaned.some((s) => s.is_active)) {
    return NextResponse.json({ error: "Keep at least one link active." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  try {
    const before = await loadState(admin, channelId);
    if (!before.channel) return NextResponse.json({ error: "Channel not found." }, { status: 404 });

    const now = new Date().toISOString();
    const rows = cleaned.map((s, index) => ({
      channel_id: channelId,
      stream_url: s.stream_url,
      label: s.label,
      is_active: s.is_active,
      priority: index,
      updated_at: now,
    }));
    const { error: upsertError } = await admin
      .from("channel_sources")
      .upsert(rows, { onConflict: "channel_id,stream_url" });
    if (upsertError) throw new Error(upsertError.message);

    const keep = new Set(cleaned.map((s) => s.stream_url));
    const removeIds = before.sources.filter((s) => s.id && !keep.has(s.stream_url)).map((s) => s.id);
    if (removeIds.length) {
      const { error: deleteError } = await admin.from("channel_sources").delete().in("id", removeIds);
      if (deleteError) throw new Error(deleteError.message);
    }

    // Keep the legacy primary column aligned with the first active link.
    const warnings = [];
    const primary = cleaned.find((s) => s.is_active)?.stream_url || "";
    if (primary && primary !== before.channel.stream_url) {
      const { error: primaryError } = await admin
        .from("channels")
        .update({ stream_url: primary, updated_at: now })
        .eq("id", channelId);
      if (primaryError) {
        const msg = String(primaryError.message || "").toLowerCase();
        if (msg.includes("duplicate") || msg.includes("unique")) {
          warnings.push(
            "The first link is also the main link of another channel, so this channel's main link (used by the public M3U and imports) was not changed. Viewers still get the new order."
          );
        } else {
          throw new Error(primaryError.message);
        }
      }
    }

    const after = await loadState(admin, channelId);
    return NextResponse.json({ ok: true, warnings, ...after });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to save sources." }, { status: error.status || 500 });
  }
}
