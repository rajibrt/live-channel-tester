// Choose the link an IPTV app should get for a channel with several links.
// Keeps the admin's order (priority, id) but moves a link to the back when
// website viewers recently reported it failing: at least 3 failures in total,
// the most recent report was a failure, and that failure is under 6 hours old.

const RECENT_FAILURE_MS = 6 * 60 * 60 * 1000;

export function isSourceRecentlyFailing(source, now = Date.now()) {
  const failures = Number(source?.failure_count || 0);
  if (failures < 3) return false;
  const lastFailure = Date.parse(source?.last_failure_at || "") || 0;
  const lastSuccess = Date.parse(source?.last_success_at || "") || 0;
  return lastFailure > lastSuccess && now - lastFailure < RECENT_FAILURE_MS;
}

export function pickBestChannelSource(sources, now = Date.now()) {
  const active = (Array.isArray(sources) ? sources : [])
    .filter((s) => s && s.is_active !== false && String(s.stream_url || "").trim())
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0) || Number(a.id || 0) - Number(b.id || 0));
  return active.find((s) => !isSourceRecentlyFailing(s, now)) || active[0] || null;
}
