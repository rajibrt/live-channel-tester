// Per-link playback counters for TV channels (supabase/channel_sources.sql).
// Called from the activity APIs when the player reports that a channel source
// started playing or failed. Never throws: analytics must not break playback.

export const PLAYBACK_STARTED_EVENT = "playback_started";

export function channelSourceResultFromEvent(eventType, eventData) {
  const sourceId = Number(eventData?.source_id);
  if (!Number.isSafeInteger(sourceId) || sourceId <= 0) return null;
  if (eventType === PLAYBACK_STARTED_EVENT) return { sourceId, ok: true };
  if (eventType === "playback_failed") return { sourceId, ok: false };
  return null;
}

export async function recordChannelSourceResult(admin, eventType, eventData) {
  const result = channelSourceResultFromEvent(eventType, eventData);
  if (!result) return;
  try {
    await admin.rpc("record_channel_source_result", { p_source_id: result.sourceId, p_ok: result.ok });
  } catch {
    // table/function not installed yet or transient error: ignore
  }
}
