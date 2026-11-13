"use client";

// Backup links of a movie, below the main link. The viewer's player tries the main
// link first, then these in order (and skips links whose audio the browser cannot play).
export default function MovieBackupLinks({ styles, mainUrl, links, onChange, onPreview, onMakeMain }) {
  const list = Array.isArray(links) ? links : [];
  const update = (index, patch) => onChange(list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const remove = (index) => onChange(list.filter((_, i) => i !== index));
  const add = () => onChange([...list, { url: "", label: "backup", is_active: true }]);
  const duplicateOfMain = (url) => {
    const value = String(url || "").trim();
    return value && value === String(mainUrl || "").trim();
  };
  const duplicates = new Set();
  const seen = new Set();
  for (const item of list) {
    const value = String(item?.url || "").trim();
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return (
    <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
      <span>Backup links ({list.length})</span>
      <p className={styles.fieldHint} style={{ margin: "2px 0 6px" }}>
        If the main link does not play, or plays without sound, the player switches to these in order.
      </p>
      {list.map((item, index) => {
        const url = String(item?.url || "");
        const isDup = duplicateOfMain(url) || duplicates.has(url.trim());
        return (
          <div key={index} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ minWidth: 22, fontWeight: 600, opacity: 0.7 }}>{index + 2}.</span>
            <input
              style={{ flex: "1 1 320px", minWidth: 0 }}
              value={url}
              placeholder="https://server/.../movie.mkv"
              onChange={(e) => update(index, { url: e.target.value })}
            />
            <input
              style={{ width: 110 }}
              value={String(item?.label || "")}
              placeholder="Label"
              onChange={(e) => update(index, { label: e.target.value })}
              title="Label (server name)"
            />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={item?.is_active !== false}
                onChange={(e) => update(index, { is_active: e.target.checked })}
              />
              Active
            </label>
            <button type="button" className={styles.ghostBtn} onClick={() => move(index, -1)} disabled={index === 0} title="Move up">
              ↑
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => move(index, 1)}
              disabled={index === list.length - 1}
              title="Move down"
            >
              ↓
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => onPreview(url)} disabled={!url.trim()}>
              Test
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => onMakeMain(index)} disabled={!url.trim()}>
              Make main
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => remove(index)}>
              Remove
            </button>
            {isDup ? (
              <span className={styles.error} style={{ flexBasis: "100%", margin: 0 }}>
                This link is already in the list; duplicates are ignored on save.
              </span>
            ) : null}
          </div>
        );
      })}
      <div>
        <button type="button" className={styles.ghostBtn} onClick={add}>
          + Add backup link
        </button>
      </div>
    </div>
  );
}
