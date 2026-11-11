// Shared helpers for the playlist workspace.

export function normalizeGroup(value) {
  return String(value || "").trim() || "Uncategorized";
}

// Ordered group list: saved order first, then groups only seen on channels.
export function buildGroups(channels, savedGroups) {
  const counts = new Map();
  for (const c of channels) {
    const key = normalizeGroup(c.category);
    const entry = counts.get(key) || { total: 0, dead: 0 };
    entry.total += 1;
    if (String(c.status || "").toUpperCase() === "DEAD") entry.dead += 1;
    counts.set(key, entry);
  }
  const ordered = [];
  const seen = new Set();
  for (const name of savedGroups || []) {
    const key = normalizeGroup(name);
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push({ name: key, ...(counts.get(key) || { total: 0, dead: 0 }) });
  }
  for (const [name, entry] of counts) {
    if (seen.has(name)) continue;
    seen.add(name);
    ordered.push({ name, ...entry });
  }
  return ordered;
}
