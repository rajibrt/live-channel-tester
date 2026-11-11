"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowDownAZ, ArrowDownZA, ArrowUp, Link2, Plus } from "lucide-react";
import styles from "../../workspace.module.css";
import ChannelDrawer from "./ChannelDrawer";
import { normalizeGroup } from "./groupUtils";

const ALL = "__all__";
const PAGE = 200;

function hostOf(url) {
  try {
    return new URL(String(url || "")).host;
  } catch {
    return String(url || "").slice(0, 60);
  }
}

function isDead(channel) {
  return String(channel?.status || "").toUpperCase() === "DEAD";
}

async function postJson(url, body, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Request failed.");
  return json;
}

function ChannelLogo({ src, name }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={styles.logo} loading="lazy" onError={() => setFailed(true)} />;
  }
  return <span className={`${styles.logo} ${styles.logoFallback}`}>{String(name || "TV").slice(0, 2).toUpperCase()}</span>;
}

export default function ChannelsTab({ initialGroup = null, onReorderGroups, playlistSlug, channels, setChannels, groups, setSavedGroups, sourceCounts, setSourceCounts }) {
  const [group, setGroup] = useState(() => initialGroup || groups[0]?.name || ALL);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(null); // { mode: "edit", channelId } | { mode: "new" }
  const [moveTarget, setMoveTarget] = useState("");

  const groupNames = useMemo(() => groups.map((g) => g.name), [groups]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels
      .filter((c) => group === ALL || normalizeGroup(c.category) === group)
      .filter((c) => {
        if (filter === "live") return !isDead(c);
        if (filter === "dead") return isDead(c);
        if (filter === "hidden") return c.include_on_home === false;
        if (filter === "multi") return Number(sourceCounts[String(c.id)]?.active || 0) > 1;
        return true;
      })
      .filter((c) => !q || `${c.name} ${c.stream_url} ${c.category}`.toLowerCase().includes(q))
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0) || Number(a.id) - Number(b.id));
  }, [channels, group, filter, search, sourceCounts]);

  const canReorder = group !== ALL && filter === "all" && !search.trim();
  const shown = visible.slice(0, limit);
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(Number(c.id)));

  const flash = (text) => {
    setMessage(text);
    setError("");
    setTimeout(() => setMessage((current) => (current === text ? "" : current)), 3500);
  };

  const patchLocal = useCallback(
    (ids, patch) => {
      const set = new Set(ids.map(Number));
      setChannels((prev) => prev.map((c) => (set.has(Number(c.id)) ? { ...c, ...patch } : c)));
    },
    [setChannels]
  );

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (name) => {
    setGroup(name);
    setSelected(new Set());
    setLimit(PAGE);
  };

  const move = async (index, delta) => {
    const target = index + delta;
    if (!canReorder || target < 0 || target >= visible.length) return;
    const order = visible.map((c) => Number(c.id));
    [order[index], order[target]] = [order[target], order[index]];
    setBusy(true);
    try {
      const json = await postJson(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/channel-order`, { channel_ids: order });
      const positions = new Map((json.positions || []).map((p) => [Number(p.channel_id), Number(p.position)]));
      setChannels((prev) => prev.map((c) => (positions.has(Number(c.id)) ? { ...c, position: positions.get(Number(c.id)) } : c)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sortGroupByName = async (direction) => {
    if (!canReorder || visible.length < 2) return;
    const label = direction === "desc" ? "Z–A" : "A–Z";
    if (!window.confirm(`Sort all ${visible.length} channels in “${group}” ${label}? This replaces the current manual order.`)) return;
    const sorted = [...visible].sort((a, b) => {
      const cmp = String(a.name || "").localeCompare(String(b.name || ""), "en", { sensitivity: "base", numeric: true });
      return direction === "desc" ? -cmp : cmp;
    });
    setBusy(true);
    try {
      const json = await postJson(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/channel-order`, {
        channel_ids: sorted.map((c) => Number(c.id)),
      });
      const positions = new Map((json.positions || []).map((p) => [Number(p.channel_id), Number(p.position)]));
      setChannels((prev) => prev.map((c) => (positions.has(Number(c.id)) ? { ...c, position: positions.get(Number(c.id)) } : c)));
      flash(`Sorted “${group}” ${label}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleHome = async (channel) => {
    const next = channel.include_on_home === false;
    patchLocal([channel.id], { include_on_home: next });
    try {
      await postJson(`/api/admin/channels/${channel.id}`, { include_on_home: next }, "PATCH");
    } catch (e) {
      patchLocal([channel.id], { include_on_home: !next });
      setError(e.message);
    }
  };

  const runBulk = async (action) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    setError("");
    try {
      if (action === "show_home" || action === "hide_home") {
        await postJson(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/channels-bulk`, { ids, action });
        patchLocal(ids, { include_on_home: action === "show_home" });
        flash(`${ids.length} channel(s) ${action === "show_home" ? "shown on" : "hidden from"} the home page.`);
      } else if (action === "move_group") {
        let category = moveTarget;
        if (category === "__new__") category = String(window.prompt("New group name") || "").trim();
        if (!category) return;
        await postJson(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/channels-bulk`, { ids, action, category });
        patchLocal(ids, { category });
        setSavedGroups((prev) => (prev.includes(category) ? prev : [...prev, category]));
        setMoveTarget("");
        flash(`${ids.length} channel(s) moved to “${category}”.`);
      } else if (action === "live" || action === "dead") {
        await postJson(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/health-actions`, {
          [action === "live" ? "enable_ids" : "disable_ids"]: ids,
        });
        patchLocal(ids, { status: action === "live" ? "LIVE" : "DEAD" });
        flash(`${ids.length} channel(s) marked ${action === "live" ? "LIVE" : "DEAD"}.`);
      } else if (action === "remove") {
        if (!window.confirm(`Remove ${ids.length} channel(s) from this playlist? This cannot be undone.`)) return;
        await postJson(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/health-actions`, { delete_ids: ids });
        const set = new Set(ids);
        setChannels((prev) => prev.filter((c) => !set.has(Number(c.id))));
        flash(`${ids.length} channel(s) removed.`);
      }
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const drawerChannel = drawer?.mode === "edit" ? channels.find((c) => Number(c.id) === Number(drawer.channelId)) : null;

  return (
    <div className={styles.channelsLayout}>
      <aside className={styles.groupPanel} aria-label="Groups">
        <div className={styles.groupPanelHead}>
          <p className={styles.groupPanelTitle}>Groups</p>
          {onReorderGroups ? (
            <button type="button" className={styles.linkBtn} onClick={onReorderGroups}>
              Reorder
            </button>
          ) : null}
        </div>
        <ul className={styles.groupList}>
          <li>
            <button
              type="button"
              className={`${styles.groupItem} ${group === ALL ? styles.groupItemActive : ""}`}
              onClick={() => selectGroup(ALL)}
            >
              <span className={styles.groupName}>All channels</span>
              <span className={styles.groupCounts}>{channels.length}</span>
            </button>
          </li>
          {groups.map((g) => (
            <li key={g.name}>
              <button
                type="button"
                className={`${styles.groupItem} ${group === g.name ? styles.groupItemActive : ""}`}
                onClick={() => selectGroup(g.name)}
                title={g.name}
              >
                <span className={styles.groupName}>{g.name}</span>
                <span className={styles.groupCounts}>
                  {g.total}
                  {g.dead ? <span className={styles.deadBadge} title={`${g.dead} dead`}>{g.dead}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className={styles.listPanel}>
        <div className={styles.toolbar}>
          <input
            className={styles.input}
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={group === ALL ? "Search all channels by name or link" : `Search in ${group}`}
            aria-label="Search channels"
          />
          <select className={styles.select} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
            <option value="all">All statuses</option>
            <option value="live">Live only</option>
            <option value="dead">Dead only</option>
            <option value="hidden">Hidden from home</option>
            <option value="multi">Has backup links</option>
          </select>
          {group !== ALL ? (
            <>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => sortGroupByName("asc")}
                disabled={busy || !canReorder || visible.length < 2}
                title={canReorder ? `Sort ${group} A–Z (saves immediately)` : "Clear search and status filter to sort"}
              >
                <ArrowDownAZ size={16} />
                A–Z
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => sortGroupByName("desc")}
                disabled={busy || !canReorder || visible.length < 2}
                title={canReorder ? `Sort ${group} Z–A (saves immediately)` : "Clear search and status filter to sort"}
              >
                <ArrowDownZA size={16} />
                Z–A
              </button>
            </>
          ) : null}
          <button type="button" className={styles.primaryBtn} onClick={() => setDrawer({ mode: "new" })}>
            <Plus size={16} />
            Add channel
          </button>
        </div>

        {selected.size ? (
          <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
            <strong>{selected.size} selected</strong>
            <select className={styles.select} value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} aria-label="Move to group">
              <option value="">Move to group…</option>
              {groupNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__new__">+ New group…</option>
            </select>
            <button type="button" className={styles.ghostBtn} disabled={busy || !moveTarget} onClick={() => runBulk("move_group")}>
              Move
            </button>
            <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => runBulk("show_home")}>
              Show on home
            </button>
            <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => runBulk("hide_home")}>
              Hide from home
            </button>
            <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => runBulk("live")}>
              Mark live
            </button>
            <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => runBulk("dead")}>
              Mark dead
            </button>
            <button type="button" className={styles.dangerBtn} disabled={busy} onClick={() => runBulk("remove")}>
              Remove
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        ) : null}

        {message ? <p className={styles.notice}>{message}</p> : null}
        {error ? <p className={styles.errorText}>{error}</p> : null}

        <ul className={styles.channelList}>
          <li className={`${styles.channelRow} ${styles.listHeader}`}>
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={() =>
                setSelected(allShownSelected ? new Set() : new Set(shown.map((c) => Number(c.id))))
              }
              aria-label="Select all shown channels"
            />
            <span className={styles.hideOnNarrow}>{canReorder ? "Order" : ""}</span>
            <span />
            <span>
              {visible.length} channel{visible.length === 1 ? "" : "s"}
              {group !== ALL ? ` in ${group}` : ""}
            </span>
            <span className={styles.hideOnNarrow}>Status</span>
            <span className={styles.hideOnNarrow}>Links</span>
            <span className={styles.hideOnNarrow}>Home</span>
            <span />
          </li>
          {shown.map((c, index) => {
            const id = Number(c.id);
            const links = sourceCounts[String(id)];
            const linkTotal = Number(links?.total || 1);
            const multi = Number(links?.active || 0) > 1;
            return (
              <li key={id} className={`${styles.channelRow} ${selected.has(id) ? styles.channelRowSelected : ""}`}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} aria-label={`Select ${c.name}`} />
                <span className={`${styles.orderBtns} ${styles.hideOnNarrow}`}>
                  {canReorder ? (
                    <>
                      <button type="button" className={styles.iconBtn} disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        disabled={busy || index === visible.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </>
                  ) : null}
                </span>
                <ChannelLogo src={c.logo_url} name={c.name} />
                <button type="button" className={styles.channelMain} onClick={() => setDrawer({ mode: "edit", channelId: id })}>
                  <span className={styles.channelName}>{c.name}</span>
                  <span className={styles.channelMeta}>
                    {group === ALL ? `${normalizeGroup(c.category)} · ` : ""}
                    {hostOf(c.stream_url)}
                  </span>
                </button>
                <span className={`${styles.pill} ${isDead(c) ? styles.pillDead : styles.pillLive} ${styles.hideOnNarrow}`}>
                  {isDead(c) ? "Dead" : "Live"}
                </span>
                <span
                  className={`${styles.pill} ${styles.pillLinks} ${multi ? styles.pillLinksMulti : ""} ${styles.hideOnNarrow}`}
                  title={`${linkTotal} link(s), ${links?.active ?? 1} active`}
                >
                  <Link2 size={12} />
                  {linkTotal}
                </span>
                <label className={`${styles.switch} ${styles.hideOnNarrow}`}>
                  <input type="checkbox" checked={c.include_on_home !== false} onChange={() => toggleHome(c)} />
                  {c.include_on_home !== false ? "Shown" : "Hidden"}
                </label>
                <button type="button" className={styles.ghostBtn} onClick={() => setDrawer({ mode: "edit", channelId: id })}>
                  Edit
                </button>
              </li>
            );
          })}
          {!visible.length ? (
            <li className={styles.listFooter}>
              <span className={styles.muted}>No channels match.</span>
            </li>
          ) : null}
          {visible.length > shown.length ? (
            <li className={styles.listFooter}>
              <button type="button" className={styles.ghostBtn} onClick={() => setLimit((n) => n + PAGE)}>
                Show more ({visible.length - shown.length} left)
              </button>
            </li>
          ) : null}
        </ul>
      </div>

      {drawer ? (
        <ChannelDrawer
          mode={drawer.mode}
          channel={drawerChannel}
          playlistSlug={playlistSlug}
          groupNames={groupNames}
          defaultGroup={group === ALL ? "" : group}
          onClose={() => setDrawer(null)}
          onChannelSaved={(updated) => {
            patchLocal([updated.id], updated);
            if (updated.category) setSavedGroups((prev) => (prev.includes(updated.category) ? prev : [...prev, updated.category]));
          }}
          onCreated={(created) => {
            const maxPos = channels.reduce((m, c) => Math.max(m, Number(c.position || 0)), 0);
            setChannels((prev) => [...prev, { status: "LIVE", include_on_home: true, ...created, position: maxPos + 1 }]);
            if (created.category) setSavedGroups((prev) => (prev.includes(created.category) ? prev : [...prev, created.category]));
            setSourceCounts((prev) => ({ ...prev, [String(created.id)]: { total: 1, active: 1 } }));
            setDrawer({ mode: "edit", channelId: Number(created.id), startTab: "links" });
            flash(`“${created.name}” added.`);
          }}
          onLinksSaved={(json) => {
            const list = Array.isArray(json?.sources) ? json.sources : [];
            if (json?.channel?.id) {
              setSourceCounts((prev) => ({
                ...prev,
                [String(json.channel.id)]: { total: list.length, active: list.filter((s) => s?.is_active !== false).length },
              }));
              patchLocal([json.channel.id], { stream_url: json.channel.stream_url });
            }
          }}
          startTab={drawer.startTab}
        />
      ) : null}
    </div>
  );
}
