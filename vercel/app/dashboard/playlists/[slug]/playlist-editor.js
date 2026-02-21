"use client";

import { useMemo, useState } from "react";
import styles from "../../page.module.css";

const PLACEHOLDER_LOGO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='10' fill='%23e2e8f0'/><circle cx='32' cy='24' r='9' fill='%2394a3b8'/><rect x='16' y='38' width='32' height='10' rx='5' fill='%2394a3b8'/></svg>";

function cloneChannels(channels) {
  const groupBuckets = new Map();
  channels.forEach((c) => {
    const key = (c.category || "").trim() || "Uncategorized";
    if (!groupBuckets.has(key)) groupBuckets.set(key, []);
    groupBuckets.get(key).push(c);
  });
  const result = [];
  groupBuckets.forEach((list, key) => {
    list
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      .forEach((c, idx) => {
        result.push({
          id: c.id,
          name: c.name || "Stream",
          category: key,
          logo_url: c.logo_url || "",
          stream_url: c.stream_url || "",
          status: c.status || "LIVE",
          order: idx + 1,
          originalCategory: key,
          originalName: c.name || "Stream",
          originalLogo: c.logo_url || "",
        });
      });
  });
  return result;
}

export default function PlaylistEditor({ playlistSlug, playlistName, initialChannels, initialGroups = [] }) {
  const [channels, setChannels] = useState(() => cloneChannels(initialChannels));
  const [initial] = useState(() => cloneChannels(initialChannels));
  const [groupOrder, setGroupOrder] = useState(() => {
    const seen = new Set();
    const arr = [];
    initialGroups.forEach((g) => {
      const name = String(g || "").trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      arr.push(name);
    });
    initialChannels
      .slice()
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
      .forEach((c) => {
        const key = (c.category || "").trim() || "Uncategorized";
        if (!seen.has(key)) {
          seen.add(key);
          arr.push(key);
        }
      });
    return arr;
  });
  const [selectedGroup, setSelectedGroup] = useState(groupOrder[0] || "Uncategorized");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [channelToolsOpen, setChannelToolsOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadingLogoId, setUploadingLogoId] = useState(null);

  const groupsWithCount = useMemo(() => {
    const counts = new Map();
    channels.forEach((c) => {
      const key = c.category || "Uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const merged = [...groupOrder];
    counts.forEach((_v, k) => {
      if (!merged.includes(k)) merged.push(k);
    });
    return merged.map((name) => ({ name, count: counts.get(name) || 0 }));
  }, [channels, groupOrder]);

  const channelsInSelected = useMemo(() => {
    return channels
      .filter((c) => c.category === selectedGroup)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }, [channels, selectedGroup]);

  const changeChannel = (id, patch) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const moveGroup = (groupName, dir) => {
    setGroupOrder((prev) => {
      const idx = prev.indexOf(groupName);
      if (idx < 0) return prev;
      const to = dir === "up" ? idx - 1 : idx + 1;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  const moveChannel = (id, dir) => {
    const list = channelsInSelected;
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (to < 0 || to >= list.length) return;
    const current = list[idx];
    const target = list[to];
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === current.id) return { ...c, order: target.order };
        if (c.id === target.id) return { ...c, order: current.order };
        return c;
      })
    );
  };

  const sortGroupsAZ = () => {
    setGroupOrder((prev) => [...prev].sort((a, b) => a.localeCompare(b)));
  };

  const createGroup = () => {
    const name = String(newGroupName || "").trim();
    if (!name) return;
    setGroupOrder((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSelectedGroup(name);
    setNewGroupName("");
  };

  const sortChannelsAZ = () => {
    const sorted = channelsInSelected.slice().sort((a, b) => a.name.localeCompare(b.name));
    setChannels((prev) =>
      prev.map((c) => {
        const idx = sorted.findIndex((x) => x.id === c.id);
        if (idx >= 0) return { ...c, order: idx + 1 };
        return c;
      })
    );
  };

  const uploadLogo = async (channelId, file) => {
    try {
      if (!file) return;
      setError("");
      setSuccess("");
      setUploadingLogoId(channelId);
      const form = new FormData();
      form.append("file", file);
      form.append("playlist_slug", playlistSlug);
      const res = await fetch("/api/admin/media/logo-upload", {
        method: "POST",
        body: form,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to upload logo.");
      changeChannel(channelId, { logo_url: String(payload.url || "") });
      setSuccess("Logo uploaded and URL filled.");
    } catch (e) {
      setError(e?.message || "Failed to upload logo.");
    } finally {
      setUploadingLogoId(null);
    }
  };

  const resetAll = () => {
    setChannels(cloneChannels(initial));
    const seen = [];
    initial.forEach((c) => {
      if (!seen.includes(c.category)) seen.push(c.category);
    });
    setGroupOrder(seen);
    setSelectedGroup(seen[0] || "Uncategorized");
    setError("");
    setSuccess("");
  };

  const saveAll = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const normalizedOrder = [...groupOrder];
      channels.forEach((c) => {
        if (!normalizedOrder.includes(c.category)) normalizedOrder.push(c.category);
      });

      const final = [];
      normalizedOrder.forEach((groupName) => {
        channels
          .filter((c) => c.category === groupName)
          .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
          .forEach((c) => final.push(c));
      });
      const payload = final.map((c, idx) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        logo_url: c.logo_url || "",
        position: idx + 1,
      }));

      const res = await fetch(`/api/admin/playlists/${playlistSlug}/editor-save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels: payload, group_order: normalizedOrder }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "Failed to save updates.");
      setSuccess(`Updated ${out.updated_channels || 0} channels successfully.${out.group_order_saved ? " Group order saved." : ""}`);
    } catch (e) {
      setError(e?.message || "Failed to save updates.");
    } finally {
      setSaving(false);
    }
  };

  const changedCount = channels.filter((c) => {
    const changedMeta = c.name !== c.originalName || c.category !== c.originalCategory || (c.logo_url || "") !== (c.originalLogo || "");
    return changedMeta;
  }).length;

  return (
    <section className={styles.editorLayout}>
      <article className={styles.card}>
        <div className={styles.editorTop}>
          <div>
            <h2>{playlistName}</h2>
            <p className={styles.hint}>Slug: <code>{playlistSlug}</code> | Channels: {channels.length}</p>
          </div>
          <div className={styles.editorActions}>
            <button type="button" className={styles.secondaryBtn} onClick={resetAll}>Reset all changes</button>
            <button type="button" className={styles.primaryBtn} onClick={saveAll} disabled={saving}>
              {saving ? "Saving..." : "Save updates"}
            </button>
          </div>
        </div>
      </article>

      <article className={styles.card}>
        <h2>Total Groups: {groupsWithCount.length}</h2>
        <div className={styles.editorActions}>
          <input
            className={styles.groupInput}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New group name"
          />
          <button type="button" className={styles.primaryBtn} onClick={createGroup}>
            Create group
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={sortGroupsAZ}>Sort groups A-Z</button>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.editorTable}>
            <thead>
              <tr>
                <th>Group</th>
                <th>Channels</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupsWithCount.map((g) => (
                <tr key={g.name} className={selectedGroup === g.name ? styles.selectedRow : ""}>
                  <td>
                    <button type="button" className={styles.rowLinkBtn} onClick={() => setSelectedGroup(g.name)}>
                      {g.name}
                    </button>
                  </td>
                  <td>{g.count}</td>
                  <td>
                    <div className={styles.miniActions}>
                      <button type="button" className={styles.iconBtn} onClick={() => moveGroup(g.name, "up")}>↑</button>
                      <button type="button" className={styles.iconBtn} onClick={() => moveGroup(g.name, "down")}>↓</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className={styles.card}>
        <h2>
          Total Channels: {channels.length}
          {selectedGroup ? ` | Group: ${selectedGroup}` : ""}
        </h2>
        <div className={styles.editorActions}>
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setChannelToolsOpen((v) => !v)}
            >
              More channel tools
            </button>
            {channelToolsOpen ? (
              <div className={styles.menuList}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    sortChannelsAZ();
                    setChannelToolsOpen(false);
                  }}
                >
                  Sort channels A-Z
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.editorTable}>
            <thead>
              <tr>
                <th className={styles.colLogoThumb}>Channel Logo</th>
                <th className={styles.colName}>Name</th>
                <th className={styles.colGroup}>Group</th>
                <th className={styles.colLogo}>Logo URL</th>
                <th className={styles.colActions}>Actions</th>
                <th className={styles.colPreview}>Preview</th>
              </tr>
            </thead>
            <tbody>
              {channelsInSelected.map((c) => (
                <tr key={c.id}>
                  <td className={styles.colLogoThumb}>
                    <img
                      src={c.logo_url || PLACEHOLDER_LOGO}
                      alt={c.name || "Channel logo"}
                      className={styles.channelLogoThumb}
                    />
                  </td>
                  <td className={styles.colName}>
                    <input
                      className={styles.inlineInput}
                      value={c.name}
                      onChange={(e) => changeChannel(c.id, { name: e.target.value })}
                    />
                  </td>
                  <td className={styles.colGroup}>
                    <select
                      className={styles.inlineInput}
                      value={c.category}
                      onChange={(e) => {
                        const nextCategory = e.target.value || "Uncategorized";
                        const max = Math.max(
                          0,
                          ...channels.filter((x) => x.category === nextCategory && x.id !== c.id).map((x) => Number(x.order || 0))
                        );
                        changeChannel(c.id, { category: nextCategory, order: max + 1 });
                        setGroupOrder((prev) => (prev.includes(nextCategory) ? prev : [...prev, nextCategory]));
                      }}
                    >
                      {groupsWithCount.map((g) => (
                        <option key={g.name} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.colLogo}>
                    <div className={styles.logoFieldRow}>
                      <input
                        className={styles.inlineInput}
                        value={c.logo_url}
                        onChange={(e) => changeChannel(c.id, { logo_url: e.target.value })}
                      />
                      <label className={styles.uploadLogoBtn}>
                        {uploadingLogoId === c.id ? "Uploading..." : "Upload logo"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingLogoId === c.id}
                          onChange={(e) => uploadLogo(c.id, e.target.files?.[0])}
                          style={{ display: "none" }}
                        />
                      </label>
                    </div>
                  </td>
                  <td className={styles.colActions}>
                    <div className={styles.miniActions}>
                      <button type="button" className={styles.iconBtn} onClick={() => moveChannel(c.id, "up")}>↑</button>
                      <button type="button" className={styles.iconBtn} onClick={() => moveChannel(c.id, "down")}>↓</button>
                    </div>
                  </td>
                  <td className={styles.colPreview}>
                    <button
                      type="button"
                      className={styles.previewCellBtn}
                      onClick={() => setPreview({ title: c.name || "Stream", url: c.stream_url || "" })}
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className={styles.card}>
        <h2>Pending Changes</h2>
        <p className={styles.hint}>Changed channels: {changedCount}</p>
        {error ? <p className={styles.errorText}>{error}</p> : null}
        {success ? <p className={styles.successText}>{success}</p> : null}
      </article>

      <div className={styles.floatingSaveWrap}>
        <div className={styles.floatingSaveInner}>
          <span className={styles.floatingMeta}>Changed: {changedCount}</span>
          <button type="button" className={styles.primaryBtn} onClick={saveAll} disabled={saving}>
            {saving ? "Saving..." : "Save updates"}
          </button>
        </div>
      </div>

      {preview ? (
        <div className={styles.modalWrap} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h4>{preview.title || "Channel Preview"}</h4>
              <button type="button" className={styles.closeBtn} onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            {preview.url ? (
              <video controls autoPlay className={styles.video} src={preview.url}>
                Your browser could not play this stream.
              </video>
            ) : (
              <p className={styles.errorText}>No stream URL found for preview.</p>
            )}
            {preview.url ? (
              <p className={styles.hint}>
                Open direct link:{" "}
                <a href={preview.url} target="_blank" rel="noreferrer" className={styles.url}>
                  {preview.url}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
