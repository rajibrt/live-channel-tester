"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../../page.module.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";

const PLACEHOLDER_LOGO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='10' fill='%23e2e8f0'/><circle cx='32' cy='24' r='9' fill='%2394a3b8'/><rect x='16' y='38' width='32' height='10' rx='5' fill='%2394a3b8'/></svg>";

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm17.7-10.04a1 1 0 0 0 0-1.42L18.2 3.3a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 2-1.67Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="m18.3 5.71-1.41-1.42L12 9.17 7.11 4.29 5.7 5.71 10.59 10.6 5.7 15.49l1.41 1.42L12 12l4.89 4.91 1.41-1.42L13.41 10.6l4.89-4.89Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M6 7h12v2H6V7Zm2 3h8v9H8v-9Zm2-7h4l1 1h4v2H5V4h4l1-1Z" />
    </svg>
  );
}

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
          status: String(c.status || "LIVE").toUpperCase(),
          include_on_home: c.include_on_home !== false,
          order: idx + 1,
          originalOrder: idx + 1,
          originalCategory: key,
          originalName: c.name || "Stream",
          originalLogo: c.logo_url || "",
          originalStreamUrl: c.stream_url || "",
          originalIncludeOnHome: c.include_on_home !== false,
        });
      });
  });
  return result;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M5 20h14v-2H5v2Zm7-18v12l4-4 1.41 1.41L12 17.83 6.59 11.41 8 10l4 4V2h0Z" />
    </svg>
  );
}

function GroupCombobox({ value, options, onCommit }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(String(value || ""));

  useEffect(() => {
    setQuery(String(value || ""));
  }, [value]);

  useEffect(() => {
    function onDocMouseDown(event) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const normalizedOptions = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const raw of options || []) {
      const name = String(raw || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      list.push(name);
    }
    return list;
  }, [options]);

  const filteredOptions = useMemo(() => {
    const rawQuery = query.trim();
    const currentValue = String(value || "").trim();
    const q = rawQuery.toLowerCase();
    const shouldFilter = q && q !== currentValue.toLowerCase();
    if (!shouldFilter) return normalizedOptions;
    return normalizedOptions.filter((name) => name.toLowerCase().includes(q));
  }, [normalizedOptions, query, value]);

  const hasExact = normalizedOptions.some((name) => name === query.trim());

  const commit = (rawValue) => {
    const next = String(rawValue || "").trim() || "Uncategorized";
    setQuery(next);
    onCommit(next);
    setOpen(false);
  };

  return (
    <div className={`${styles.menuWrap} ${styles.groupComboWrap}`} ref={rootRef}>
      <input
        className={styles.inlineInput}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(query);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setQuery(String(value || ""));
          }
        }}
        placeholder="Select or type group"
        aria-label="Channel group"
      />
      {open ? (
        <div className={`${styles.menuList} ${styles.groupComboMenu}`}>
          {filteredOptions.map((name) => (
            <button
              key={name}
              type="button"
              className={styles.menuItem}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(name)}
            >
              {name}
            </button>
          ))}
          {!hasExact ? (
            <button
              type="button"
              className={styles.menuItem}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(query)}
            >
              Use "{query.trim() || "Uncategorized"}"
            </button>
          ) : null}
          {!filteredOptions.length && hasExact ? (
            <div className={styles.menuItem}>No matching category</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function PlaylistEditor({ playlistSlug, playlistName, playlistUrl = "", initialChannels, initialGroups = [] }) {
  const [channels, setChannels] = useState(() => cloneChannels(initialChannels));
  const [initial] = useState(() => cloneChannels(initialChannels));
  const initialGroupOrder = useMemo(() => {
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
  }, [initialChannels, initialGroups]);
  const [groupOrder, setGroupOrder] = useState(() => {
    return initialGroupOrder;
  });
  const [selectedGroup, setSelectedGroup] = useState(groupOrder[0] || "Uncategorized");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState("");
  const [groupEditValue, setGroupEditValue] = useState("");
  const [channelToolsOpen, setChannelToolsOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadingLogoId, setUploadingLogoId] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [channelStatusFilter, setChannelStatusFilter] = useState("ALL");
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [healthSummary, setHealthSummary] = useState("");
  const [healthRows, setHealthRows] = useState([]);
  const [healthActionLoading, setHealthActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    onConfirm: null,
  });
  const [editingGroupOrder, setEditingGroupOrder] = useState("");
  const [groupOrderDraft, setGroupOrderDraft] = useState("");
  const [editingChannelOrderId, setEditingChannelOrderId] = useState(null);
  const [channelOrderDraft, setChannelOrderDraft] = useState("");

  const openConfirm = ({ title, description, confirmText = "Confirm", onConfirm }) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      confirmText,
      onConfirm: typeof onConfirm === "function" ? onConfirm : null,
    });
  };

  const groupsWithCount = useMemo(() => {
    const counts = new Map();
    channels.forEach((c) => {
      const key = c.category || "Uncategorized";
      const prev = counts.get(key) || { total: 0, live: 0, dead: 0 };
      const status = String(c.status || "LIVE").toUpperCase();
      counts.set(key, {
        total: prev.total + 1,
        live: prev.live + (status === "LIVE" ? 1 : 0),
        dead: prev.dead + (status === "LIVE" ? 0 : 1),
      });
    });
    const merged = [...groupOrder];
    counts.forEach((_v, k) => {
      if (!merged.includes(k)) merged.push(k);
    });
    return merged.map((name) => {
      const summary = counts.get(name) || { total: 0, live: 0, dead: 0 };
      return { name, ...summary };
    });
  }, [channels, groupOrder]);

  const allChannelsInSelected = useMemo(
    () =>
      channels
        .filter((c) => c.category === selectedGroup)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [channels, selectedGroup]
  );

  const channelsInSelected = useMemo(() => {
    const base = allChannelsInSelected;
    if (channelStatusFilter === "LIVE") {
      return base.filter((c) => String(c.status || "LIVE").toUpperCase() === "LIVE");
    }
    if (channelStatusFilter === "DEAD") {
      return base.filter((c) => String(c.status || "LIVE").toUpperCase() !== "LIVE");
    }
    return base;
  }, [allChannelsInSelected, channelStatusFilter]);

  const changeChannel = (id, patch) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const applyChannelGroupChange = (channelId, rawCategory) => {
    const nextCategory = String(rawCategory || "").trim() || "Uncategorized";
    const max = Math.max(
      0,
      ...channels
        .filter((x) => x.category === nextCategory && x.id !== channelId)
        .map((x) => Number(x.order || 0))
    );
    changeChannel(channelId, { category: nextCategory, order: max + 1 });
    setGroupOrder((prev) => (prev.includes(nextCategory) ? prev : [...prev, nextCategory]));
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

  const moveGroupToPosition = (groupName, rawPosition) => {
    const idx = groupOrder.indexOf(groupName);
    if (idx < 0) return;
    const safeMax = groupOrder.length;
    const requested = Number(rawPosition);
    if (!Number.isFinite(requested)) return;
    const to = Math.min(safeMax - 1, Math.max(0, Math.floor(requested) - 1));
    if (to === idx) return;
    setGroupOrder((prev) => {
      const from = prev.indexOf(groupName);
      if (from < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const moveChannel = (id, dir) => {
    const list = allChannelsInSelected;
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

  const moveChannelToPosition = (id, rawPosition) => {
    const list = allChannelsInSelected;
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const requested = Number(rawPosition);
    if (!Number.isFinite(requested)) return;
    const to = Math.min(list.length - 1, Math.max(0, Math.floor(requested) - 1));
    if (to === idx) return;
    const reordered = [...list];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(to, 0, item);
    const nextOrderById = new Map(reordered.map((x, orderIdx) => [x.id, orderIdx + 1]));
    setChannels((prev) =>
      prev.map((c) => {
        if (c.category !== selectedGroup) return c;
        const nextOrder = nextOrderById.get(c.id);
        if (!nextOrder) return c;
        return { ...c, order: nextOrder };
      })
    );
  };

  const deleteChannel = (id) => {
    openConfirm({
      title: "Delete channel?",
      description: "This will remove the channel from the playlist.",
      confirmText: "Delete",
      onConfirm: () => setChannels((prev) => prev.filter((c) => c.id !== id)),
    });
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

  const makeUniqueGroupName = (candidate, currentName) => {
    const base = String(candidate || "").trim();
    if (!base) return "";
    const existing = new Set(groupOrder.filter((x) => x !== currentName));
    if (!existing.has(base)) return base;
    let i = 1;
    let next = `${base} ${i}`;
    while (existing.has(next)) {
      i += 1;
      next = `${base} ${i}`;
    }
    return next;
  };

  const renameGroup = (oldName, nextRaw) => {
    const draft = String(nextRaw ?? "").trim();
    if (!draft || draft === oldName) {
      setEditingGroup("");
      setGroupEditValue("");
      return;
    }
    const finalName = makeUniqueGroupName(draft, oldName);
    if (!finalName) return;
    setGroupOrder((prev) => prev.map((x) => (x === oldName ? finalName : x)));
    setChannels((prev) => prev.map((c) => (c.category === oldName ? { ...c, category: finalName } : c)));
    setSelectedGroup((prev) => (prev === oldName ? finalName : prev));
    setEditingGroup("");
    setGroupEditValue("");
    setSuccess(`Group renamed to "${finalName}".`);
  };

  const startEditGroup = (groupName) => {
    setEditingGroup(groupName);
    setGroupEditValue(groupName);
    setError("");
    setSuccess("");
  };

  const deleteGroup = (groupName) => {
    const count = channels.filter((c) => c.category === groupName).length;
    if (count > 0) {
      setError(`Cannot delete "${groupName}" because it has ${count} channel(s). Move channels first.`);
      setSuccess("");
      return;
    }
    openConfirm({
      title: `Delete group "${groupName}"?`,
      description: "This empty group will be removed.",
      confirmText: "Delete",
      onConfirm: () => {
        setGroupOrder((prev) => prev.filter((x) => x !== groupName));
        if (selectedGroup === groupName) {
          const remaining = groupOrder.filter((x) => x !== groupName);
          setSelectedGroup(remaining[0] || "Uncategorized");
        }
        if (editingGroup === groupName) {
          setEditingGroup("");
          setGroupEditValue("");
        }
        setError("");
        setSuccess(`Deleted empty group "${groupName}".`);
      },
    });
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

  const sortAllGroupsChannelsAZ = () => {
    setChannels((prev) => {
      const grouped = new Map();
      prev.forEach((c) => {
        const key = c.category || "Uncategorized";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(c);
      });

      const nextById = new Map();
      grouped.forEach((list) => {
        const sorted = list
          .slice()
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        sorted.forEach((item, idx) => {
          nextById.set(item.id, { ...item, order: idx + 1 });
        });
      });

      return prev.map((c) => nextById.get(c.id) || c);
    });
    setSuccess("Sorted channels A-Z in all groups.");
    setError("");
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
      // Rebuild positions deterministically per group, then flatten by group order.
      const groupBuckets = new Map();
      final.forEach((c) => {
        const key = c.category || "Uncategorized";
        if (!groupBuckets.has(key)) groupBuckets.set(key, []);
        groupBuckets.get(key).push(c);
      });
      const normalizedFinal = [];
      normalizedOrder.forEach((groupName) => {
        const list = groupBuckets.get(groupName) || [];
        list
          .slice()
          .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
          .forEach((c, idx) => normalizedFinal.push({ ...c, order: idx + 1 }));
      });

      const payload = normalizedFinal.map((c, idx) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        logo_url: c.logo_url || "",
        stream_url: c.stream_url || "",
        include_on_home: c.include_on_home !== false,
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
    const changedMeta =
      c.name !== c.originalName ||
      c.category !== c.originalCategory ||
      Number(c.order || 0) !== Number(c.originalOrder || 0) ||
      (c.logo_url || "") !== (c.originalLogo || "") ||
      (c.stream_url || "") !== (c.originalStreamUrl || "") ||
      (c.include_on_home !== false) !== (c.originalIncludeOnHome !== false);
    return changedMeta;
  }).length;
  const groupOrderChanged =
    groupOrder.length !== initialGroupOrder.length ||
    groupOrder.some((name, idx) => name !== initialGroupOrder[idx]);
  const totalChangedCount = changedCount + (groupOrderChanged ? 1 : 0);

  const checkedDeadRows = healthRows.filter((x) => x.check_status === "DEAD");
  const checkedLiveRows = healthRows.filter((x) => x.check_status === "LIVE");
  const allChannelIds = channels.map((x) => Number(x.id)).filter((x) => Number.isFinite(x));
  const liveCount = channels.reduce(
    (total, c) => total + (String(c.status || "LIVE").toUpperCase() === "LIVE" ? 1 : 0),
    0
  );
  const deadCount = channels.length - liveCount;

  const runHealthCheck = async () => {
    try {
      setHealthLoading(true);
      setHealthError("");
      setHealthSummary("");
      const res = await fetch(`/api/admin/playlists/${playlistSlug}/health-check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timeout: 8, concurrency: 6 }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to run health check.");
      const items = Array.isArray(payload.items) ? payload.items : [];
      setHealthRows(items);
      setHealthSummary(`Checked ${payload.total || 0}: LIVE ${payload.live_count || 0}, DEAD ${payload.dead_count || 0}.`);
    } catch (e) {
      setHealthError(e?.message || "Failed to run health check.");
    } finally {
      setHealthLoading(false);
    }
  };

  const applyHealthAction = async (kind) => {
    try {
      if (kind === "delete-dead" && checkedDeadRows.length) {
        openConfirm({
          title: `Delete ${checkedDeadRows.length} DEAD link(s)?`,
          description: "This will permanently remove these channels from this playlist.",
          confirmText: "Delete permanently",
          onConfirm: () => applyHealthAction("delete-dead-confirmed"),
        });
        return;
      }
      setHealthActionLoading(true);
      setHealthError("");
      setHealthSummary("");
      const deadIds = checkedDeadRows.map((x) => Number(x.id));
      const liveIds = checkedLiveRows.map((x) => Number(x.id));
      const allIds = allChannelIds;
      const body = {
        disable_ids: kind === "disable-dead" ? deadIds : kind === "disable-all" ? allIds : [],
        delete_ids: kind === "delete-dead" || kind === "delete-dead-confirmed" ? deadIds : [],
        enable_ids: kind === "enable-live" ? liveIds : kind === "enable-all" ? allIds : [],
      };
      const res = await fetch(`/api/admin/playlists/${playlistSlug}/health-actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to apply action.");

      if (kind === "disable-dead" && deadIds.length) {
        setChannels((prev) => prev.map((c) => (deadIds.includes(Number(c.id)) ? { ...c, status: "DEAD" } : c)));
      }
      if (kind === "disable-all" && allIds.length) {
        setChannels((prev) => prev.map((c) => (allIds.includes(Number(c.id)) ? { ...c, status: "DEAD" } : c)));
      }
      if (kind === "enable-live" && liveIds.length) {
        setChannels((prev) => prev.map((c) => (liveIds.includes(Number(c.id)) ? { ...c, status: "LIVE" } : c)));
      }
      if (kind === "enable-all" && allIds.length) {
        setChannels((prev) => prev.map((c) => (allIds.includes(Number(c.id)) ? { ...c, status: "LIVE" } : c)));
      }
      if ((kind === "delete-dead" || kind === "delete-dead-confirmed") && deadIds.length) {
        setChannels((prev) => prev.filter((c) => !deadIds.includes(Number(c.id))));
        setHealthRows((prev) => prev.filter((x) => !deadIds.includes(Number(x.id))));
      }
      setHealthSummary(
        `Disabled: ${payload.disabled_count || 0}, Re-enabled: ${payload.enabled_count || 0}, Removed from playlist: ${payload.deleted_from_playlist || 0}`
      );
      setSuccess("Health action applied.");
    } catch (e) {
      setHealthError(e?.message || "Failed to apply health action.");
    } finally {
      setHealthActionLoading(false);
    }
  };

  const copyPlaylistUrl = async () => {
    try {
      if (!playlistUrl) return;
      await navigator.clipboard.writeText(playlistUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1200);
    } catch {
      setCopiedUrl(false);
    }
  };

  return (
    <section className={styles.editorLayout}>
      <article className={styles.card}>
        <div className={styles.editorTop}>
          <div>
            <h2>{playlistName}</h2>
            <p className={styles.hint}>
              Slug: <code>{playlistSlug}</code> | Channels: {channels.length}
              {" | "}
              <span className={styles.metaStat}>
                <span className={`${styles.statusDot} ${styles.statusLive}`} aria-hidden="true" />
                LIVE: {liveCount}
              </span>
              {" | "}
              <span className={styles.metaStat}>
                <span className={`${styles.statusDot} ${styles.statusDead}`} aria-hidden="true" />
                DEAD: {deadCount}
              </span>
            </p>
            {playlistUrl ? (
              <div className={styles.playlistLinkRow}>
                <a href={playlistUrl} target="_blank" rel="noreferrer" className={styles.url}>
                  {playlistUrl}
                </a>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={copyPlaylistUrl}
                  aria-label="Copy playlist link"
                  title={copiedUrl ? "Copied" : "Copy link"}
                >
                  {copiedUrl ? "✓" : <CopyIcon />}
                </button>
                <a
                  href={playlistUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.copyBtn}
                  aria-label="Download playlist"
                  title="Download playlist"
                  download
                >
                  <DownloadIcon />
                </a>
              </div>
            ) : (
              <p className={styles.pending}>Generate token to get playlist URL.</p>
            )}
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
        <div className={`${styles.editorActions} ${styles.channelToolbar}`}>
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
                <th>#</th>
                <th>Group</th>
                <th>Total</th>
                <th>LIVE</th>
                <th>DEAD</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupsWithCount.map((g, idx) => (
                <tr key={g.name} className={selectedGroup === g.name ? styles.selectedRow : ""}>
                  <td>
                    {editingGroupOrder === g.name ? (
                      <div className={styles.serialEditRow}>
                        <input
                          className={styles.serialInput}
                          type="number"
                          min="1"
                          max={groupsWithCount.length}
                          value={groupOrderDraft}
                          onChange={(e) => setGroupOrderDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              moveGroupToPosition(g.name, groupOrderDraft);
                              setEditingGroupOrder("");
                              setGroupOrderDraft("");
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Confirm serial"
                          aria-label="Confirm serial"
                          onClick={() => {
                            moveGroupToPosition(g.name, groupOrderDraft);
                            setEditingGroupOrder("");
                            setGroupOrderDraft("");
                          }}
                        >
                          <CheckIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Cancel serial edit"
                          aria-label="Cancel serial edit"
                          onClick={() => {
                            setEditingGroupOrder("");
                            setGroupOrderDraft("");
                          }}
                        >
                          <XIcon />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.serialCell}>
                        <span className={styles.serialNum}>{idx + 1}</span>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Edit serial"
                          aria-label="Edit serial"
                          onClick={() => {
                            setEditingGroupOrder(g.name);
                            setGroupOrderDraft(String(idx + 1));
                          }}
                        >
                          <PencilIcon />
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    {editingGroup === g.name ? (
                      <div className={styles.groupEditRow}>
                        <input
                          className={styles.inlineInput}
                          value={groupEditValue}
                          onChange={(e) => setGroupEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              renameGroup(g.name, groupEditValue);
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Update group name"
                          aria-label="Update group name"
                          onClick={() => renameGroup(g.name, groupEditValue)}
                        >
                          <CheckIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Cancel"
                          aria-label="Cancel group edit"
                          onClick={() => {
                            setEditingGroup("");
                            setGroupEditValue("");
                          }}
                        >
                          <XIcon />
                        </button>
                      </div>
                    ) : (
                      <button type="button" className={styles.rowLinkBtn} onClick={() => setSelectedGroup(g.name)}>
                        {g.name}
                      </button>
                    )}
                  </td>
                  <td>{g.total}</td>
                  <td>{g.live}</td>
                  <td>{g.dead}</td>
                  <td>
                    <div className={styles.miniActions}>
                      <button type="button" className={styles.iconBtn} aria-label="Move group up" title="Move up" onClick={() => moveGroup(g.name, "up")}>↑</button>
                      <button type="button" className={styles.iconBtn} aria-label="Move group down" title="Move down" onClick={() => moveGroup(g.name, "down")}>↓</button>
                      <button type="button" className={styles.iconBtn} title="Edit group" aria-label="Edit group" onClick={() => startEditGroup(g.name)}>
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title={g.total > 0 ? "Move channels to another group before deleting" : "Delete empty group"}
                        aria-label="Delete group"
                        onClick={() => deleteGroup(g.name)}
                        disabled={g.total > 0}
                      >
                        <TrashIcon />
                      </button>
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
          <label className={styles.field}>
            <span>Status Filter</span>
            <select
              className={styles.inlineInput}
              value={channelStatusFilter}
              onChange={(e) => setChannelStatusFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="LIVE">LIVE</option>
              <option value="DEAD">DEAD</option>
            </select>
          </label>
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
                  Sort selected group A-Z
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    sortAllGroupsChannelsAZ();
                    setChannelToolsOpen(false);
                  }}
                >
                  Sort all groups A-Z
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.editorTable}>
            <thead>
              <tr>
                <th className={styles.colSerial}>#</th>
                <th className={styles.colLogoThumb}>Channel Logo</th>
                <th className={styles.colName}>Name</th>
                <th className={styles.colGroup}>Group</th>
                <th className={styles.colLogo}>Logo URL</th>
                <th className={styles.colStream}>Stream URL</th>
                <th>Home</th>
                <th className={styles.colActions}>Actions</th>
                <th className={styles.colPreview}>Preview</th>
              </tr>
            </thead>
              <tbody>
              {channelsInSelected.map((c, idx) => (
                <tr key={c.id}>
                  <td className={styles.colSerial}>
                    {editingChannelOrderId === c.id ? (
                      <div className={styles.serialEditRow}>
                        <input
                          className={styles.serialInput}
                          type="number"
                          min="1"
                          max={allChannelsInSelected.length}
                          value={channelOrderDraft}
                          onChange={(e) => setChannelOrderDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              moveChannelToPosition(c.id, channelOrderDraft);
                              setEditingChannelOrderId(null);
                              setChannelOrderDraft("");
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Confirm serial"
                          aria-label="Confirm serial"
                          onClick={() => {
                            moveChannelToPosition(c.id, channelOrderDraft);
                            setEditingChannelOrderId(null);
                            setChannelOrderDraft("");
                          }}
                        >
                          <CheckIcon />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Cancel serial edit"
                          aria-label="Cancel serial edit"
                          onClick={() => {
                            setEditingChannelOrderId(null);
                            setChannelOrderDraft("");
                          }}
                        >
                          <XIcon />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.serialCell}>
                        <span className={styles.serialNum}>{Number(c.order || idx + 1)}</span>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Edit serial"
                          aria-label="Edit serial"
                          onClick={() => {
                            setEditingChannelOrderId(c.id);
                            setChannelOrderDraft(String(Number(c.order || idx + 1)));
                          }}
                        >
                          <PencilIcon />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className={styles.colLogoThumb}>
                    <div className={styles.logoWithStatus}>
                      <img
                        src={c.logo_url || PLACEHOLDER_LOGO}
                        alt={c.name || "Channel logo"}
                        className={styles.channelLogoThumb}
                      />
                      <span
                        className={`${styles.statusDot} ${String(c.status || "LIVE").toUpperCase() === "LIVE" ? styles.statusLive : styles.statusDead}`}
                        title={String(c.status || "LIVE").toUpperCase() === "LIVE" ? "LIVE" : "DEAD"}
                        aria-label={String(c.status || "LIVE").toUpperCase() === "LIVE" ? "LIVE" : "DEAD"}
                      />
                    </div>
                  </td>
                  <td className={styles.colName}>
                    <input
                      className={styles.inlineInput}
                      value={c.name}
                      onChange={(e) => changeChannel(c.id, { name: e.target.value })}
                    />
                  </td>
                  <td className={styles.colGroup}>
                    <GroupCombobox
                      value={c.category}
                      options={groupsWithCount.map((g) => g.name)}
                      onCommit={(nextCategory) => applyChannelGroupChange(c.id, nextCategory)}
                    />
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
                  <td className={styles.colStream}>
                    <input
                      className={styles.inlineInput}
                      value={c.stream_url || ""}
                      onChange={(e) => changeChannel(c.id, { stream_url: e.target.value })}
                    />
                  </td>
                  <td>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={c.include_on_home !== false}
                        onChange={(e) => changeChannel(c.id, { include_on_home: e.target.checked })}
                      />
                      <span>Show</span>
                    </label>
                  </td>
                  <td className={styles.colActions}>
                    <div className={styles.miniActions}>
                      <button type="button" className={styles.iconBtn} onClick={() => moveChannel(c.id, "up")}>↑</button>
                      <button type="button" className={styles.iconBtn} onClick={() => moveChannel(c.id, "down")}>↓</button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Delete channel from playlist"
                        aria-label="Delete channel from playlist"
                        onClick={() => deleteChannel(c.id)}
                      >
                        <TrashIcon />
                      </button>
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
        <p className={styles.hint}>Changed items: {totalChangedCount}</p>
        {error ? <p className={styles.errorText}>{error}</p> : null}
        {success ? <p className={styles.successText}>{success}</p> : null}
      </article>

      <article className={styles.card}>
        <h2>Saved Playlist Live Check</h2>
        <p className={styles.hint}>
          Check current saved links. DEAD links can be temporarily disabled or permanently removed. LIVE results can be re-enabled.
        </p>
        <div className={styles.editorActions}>
          <button type="button" className={styles.primaryBtn} onClick={runHealthCheck} disabled={healthLoading || healthActionLoading}>
            {healthLoading ? "Checking..." : "Run Saved Links Check"}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={healthActionLoading || !checkedDeadRows.length}
            onClick={() => applyHealthAction("disable-dead")}
            title="Temporarily disable dead links from public playlist"
          >
            Temp Disable DEAD ({checkedDeadRows.length})
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={healthActionLoading || !allChannelIds.length}
            onClick={() => applyHealthAction("disable-all")}
            title="Mark every link in this playlist as DEAD"
          >
            Set ALL DEAD ({allChannelIds.length})
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={healthActionLoading || !checkedLiveRows.length}
            onClick={() => applyHealthAction("enable-live")}
            title="Re-enable links that are currently live"
          >
            Re-enable LIVE ({checkedLiveRows.length})
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={healthActionLoading || !allChannelIds.length}
            onClick={() => applyHealthAction("enable-all")}
            title="Mark every link in this playlist as LIVE"
          >
            Set ALL LIVE ({allChannelIds.length})
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={healthActionLoading || !checkedDeadRows.length}
            onClick={() => applyHealthAction("delete-dead")}
            title="Permanently remove dead links from playlist"
          >
            Permanent Delete DEAD ({checkedDeadRows.length})
          </button>
        </div>
        {healthError ? <p className={styles.errorText}>{healthError}</p> : null}
        {healthSummary ? <p className={styles.successText}>{healthSummary}</p> : null}
        {healthRows.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.editorTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Current Status</th>
                  <th>Checked</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {healthRows.map((r) => (
                  <tr key={`health-${r.id}`}>
                    <td>{r.name}</td>
                    <td>{r.status_before}</td>
                    <td>{r.check_status}</td>
                    <td>{r.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <div className={styles.floatingSaveWrap}>
        <div className={styles.floatingSaveInner}>
          <span className={styles.floatingMeta}>Changed: {totalChangedCount}</span>
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

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={styles.secondaryBtn}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={styles.primaryBtn}
              onClick={(e) => {
                e.preventDefault();
                const fn = confirmDialog.onConfirm;
                setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null }));
                if (typeof fn === "function") fn();
              }}
            >
              {confirmDialog.confirmText || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
