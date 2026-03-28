"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../../../page.module.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../../components/ui/alert-dialog";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { resolveBrowserPlaybackUrl } from "../../../../../lib/streamUrl";

function isHlsUrl(url) {
  return /\.m3u8(\?|$)/i.test(String(url || ""));
}

function loadHlsScript() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Hls) return Promise.resolve(window.Hls);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hls-script="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Hls || null), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load HLS script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
    script.async = true;
    script.dataset.hlsScript = "1";
    script.onload = () => resolve(window.Hls || null);
    script.onerror = () => reject(new Error("Failed to load HLS script."));
    document.head.appendChild(script);
  });
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
          originalStatus: String(c.status || "LIVE").toUpperCase(),
        });
      });
  });
  return result;
}

export default function LiveCheckWorkspace({
  playlistSlug,
  playlistName,
  initialChannels,
  initialGroups = [],
}) {
  const router = useRouter();
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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewVideoEl, setPreviewVideoEl] = useState(null);
  const previewHlsRef = useRef(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [healthSummary, setHealthSummary] = useState("");
  const [healthRows, setHealthRows] = useState([]);
  const [healthSearch, setHealthSearch] = useState("");
  const [healthGroupFilter, setHealthGroupFilter] = useState("ALL");
  const [healthCheckedFilter, setHealthCheckedFilter] = useState("ALL");
  const [healthPlaylistStatusFilter, setHealthPlaylistStatusFilter] = useState("ALL");
  const [healthSorting, setHealthSorting] = useState([]);
  const [healthRowSelection, setHealthRowSelection] = useState({});
  const [healthActionLoading, setHealthActionLoading] = useState(false);
  const [leaveGuardActive, setLeaveGuardActive] = useState(false);
  const [healthOverallTotal, setHealthOverallTotal] = useState(initialChannels.length);
  const [healthResumeIndex, setHealthResumeIndex] = useState(0);
  const [healthRunScope, setHealthRunScope] = useState("ALL");
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [cachedUpdatedAt, setCachedUpdatedAt] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    onConfirm: null,
  });

  const openConfirm = ({ title, description, confirmText = "Confirm", onConfirm }) => {
    setConfirmDialog({
      open: true,
      title,
      description,
      confirmText,
      onConfirm: typeof onConfirm === "function" ? onConfirm : null,
    });
  };

  const cacheKey = useMemo(() => `playlist-live-check:${playlistSlug}`, [playlistSlug]);

  const confirmLeaveWorkspace = useCallback(
    (onConfirmLeave) => {
      openConfirm({
        title: "Leave live check workspace?",
        description: "Test results or unsaved playlist changes may be lost if you leave before saving.",
        confirmText: "Leave page",
        onConfirm: () => {
          setLeaveGuardActive(false);
          if (typeof onConfirmLeave === "function") onConfirmLeave();
        },
      });
    },
    []
  );

  const openPreview = useCallback((title, url) => {
    setPreviewError("");
    setPreviewLoading(false);
    setPreview({ title: title || "Stream", url: url || "" });
  }, []);

  const updateHealthRowUrl = useCallback((id, nextUrl) => {
    const normalized = String(nextUrl || "");
    setLeaveGuardActive(true);
    setHealthRows((prev) =>
      prev.map((row) => (Number(row.id) === Number(id) ? { ...row, url: normalized } : row))
    );
    setChannels((prev) =>
      prev.map((channel) => (Number(channel.id) === Number(id) ? { ...channel, stream_url: normalized } : channel))
    );
  }, []);

  const useHttpForHealthRow = useCallback((id) => {
    setLeaveGuardActive(true);
    setHealthRows((prev) => {
      const current = prev.find((row) => Number(row.id) === Number(id));
      if (!current) return prev;
      const raw = String(current.url || "").trim();
      const nextUrl = /^https:\/\//i.test(raw)
        ? raw.replace(/^https:\/\//i, "http://")
        : /^http:\/\//i.test(raw)
        ? raw
        : raw
        ? `http://${raw.replace(/^\/+/, "")}`
        : "";
      setChannels((channelsPrev) =>
        channelsPrev.map((channel) =>
          Number(channel.id) === Number(id) ? { ...channel, stream_url: nextUrl } : channel
        )
      );
      return prev.map((row) => (Number(row.id) === Number(id) ? { ...row, url: nextUrl } : row));
    });
  }, []);

  const toggleHealthRowPlaylistLive = useCallback((id, checked) => {
    const nextStatus = checked ? "LIVE" : "DEAD";
    setLeaveGuardActive(true);
    setHealthRows((prev) =>
      prev.map((row) =>
        Number(row.id) === Number(id) ? { ...row, status_before: nextStatus, manual_live: checked } : row
      )
    );
    setChannels((prev) =>
      prev.map((channel) =>
        Number(channel.id) === Number(id) ? { ...channel, status: nextStatus } : channel
      )
    );
  }, []);

  const deleteHealthRowsLocally = useCallback((ids) => {
    const idSet = new Set(ids.map((id) => Number(id)));
    setChannels((prev) => prev.filter((channel) => !idSet.has(Number(channel.id))));
    setHealthRows((prev) => prev.filter((row) => !idSet.has(Number(row.id))));
    setHealthRowSelection((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[String(id)]);
      return next;
    });
  }, []);

  const applyHealthSelectionAction = useCallback(
    (kind, ids) => {
      const normalizedIds = [...new Set((ids || []).map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
      if (!normalizedIds.length) {
        setHealthError("Select at least one checked row first.");
        return;
      }

      if (kind === "delete") {
        openConfirm({
          title: `Delete ${normalizedIds.length} selected channel(s)?`,
          description: "This will remove the selected channels from the playlist.",
          confirmText: "Delete selected",
          onConfirm: () => {
            deleteHealthRowsLocally(normalizedIds);
            setSuccess(`Removed ${normalizedIds.length} selected channel(s) from the playlist.`);
            setHealthSummary(`Selected rows removed: ${normalizedIds.length}. Click Save updates to persist changes.`);
          },
        });
        return;
      }

      const nextStatus = kind === "live" ? "LIVE" : "DEAD";
      const isLive = nextStatus === "LIVE";
      const idSet = new Set(normalizedIds);
      setLeaveGuardActive(true);
      setChannels((prev) =>
        prev.map((channel) =>
          idSet.has(Number(channel.id)) ? { ...channel, status: nextStatus } : channel
        )
      );
      setHealthRows((prev) =>
        prev.map((row) =>
          idSet.has(Number(row.id)) ? { ...row, status_before: nextStatus, manual_live: isLive } : row
        )
      );
      setSuccess(`Updated ${normalizedIds.length} selected channel(s) to ${nextStatus}.`);
      setHealthSummary(`Selected rows set to ${nextStatus}. Click Save updates to persist changes.`);
    },
    [deleteHealthRowsLocally]
  );

  const keepSelectedRowsInPlaylist = useCallback(
    (selectedIds, scopedIds) => {
      const normalizedSelected = [...new Set((selectedIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
      const normalizedScope = [...new Set((scopedIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
      if (!normalizedScope.length) {
        setHealthError("No checked rows are available in the current filtered view.");
        return;
      }
      if (!normalizedSelected.length) {
        setHealthError("Select at least one checked row to keep in the playlist.");
        return;
      }

      const selectedSet = new Set(normalizedSelected);
      const scopeSet = new Set(normalizedScope);
      const deleteIds = normalizedScope.filter((id) => !selectedSet.has(id));

      openConfirm({
        title: `Keep ${normalizedSelected.length} selected channel(s)?`,
        description: deleteIds.length
          ? `Selected checked rows will stay in the playlist as LIVE. The other ${deleteIds.length} checked row(s) in the current filtered view will be removed from this playlist.`
          : "Selected checked rows will stay in the playlist as LIVE.",
        confirmText: "Keep selected",
        onConfirm: () => {
          setLeaveGuardActive(true);
          setChannels((prev) =>
            prev
              .filter((channel) => !deleteIds.includes(Number(channel.id)))
              .map((channel) =>
                scopeSet.has(Number(channel.id)) && selectedSet.has(Number(channel.id))
                  ? { ...channel, status: "LIVE" }
                  : channel
              )
          );
          setHealthRows((prev) =>
            prev
              .filter((row) => !deleteIds.includes(Number(row.id)))
              .map((row) =>
                scopeSet.has(Number(row.id)) && selectedSet.has(Number(row.id))
                  ? { ...row, status_before: "LIVE", manual_live: true }
                  : row
              )
          );
          setHealthRowSelection((prev) => {
            const next = { ...prev };
            deleteIds.forEach((id) => delete next[String(id)]);
            return next;
          });
          setSuccess(`Kept ${normalizedSelected.length} selected checked channel(s) in the playlist.`);
          setHealthSummary(
            deleteIds.length
              ? `Selected checked rows kept as LIVE. Removed ${deleteIds.length} other checked row(s) from the current filtered view. Click Save updates to persist changes.`
              : "Selected checked rows kept as LIVE. Click Save updates to persist changes."
          );
        },
      });
    },
    []
  );

  useEffect(() => {
    if (!preview) return undefined;

    const video = previewVideoEl;
    const rawSource = String(preview.url || "").trim();
    const source = resolveBrowserPlaybackUrl(
      rawSource,
      typeof window === "undefined" ? "" : window.location.protocol
    );
    if (!video) return undefined;

    if (previewHlsRef.current) {
      previewHlsRef.current.destroy();
      previewHlsRef.current = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (!rawSource) {
      setPreviewError("Stream URL is empty.");
      setPreviewLoading(false);
      return undefined;
    }

    setPreviewError("");
    setPreviewLoading(true);
    let cancelled = false;
    let nativeFallbackTried = false;

    const onCanPlay = () => {
      if (cancelled) return;
      setPreviewLoading(false);
      setPreviewError("");
    };
    const onError = () => {
      if (cancelled) return;
      setPreviewLoading(false);
      setPreviewError("Unable to play this stream URL.");
    };
    video.addEventListener("loadedmetadata", onCanPlay);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onCanPlay);
    video.addEventListener("error", onError);

    const startNativePlayback = () => {
      video.src = source;
      video.play().catch(() => {});
    };

    (async () => {
      try {
        if (isHlsUrl(source)) {
          const Hls = await loadHlsScript();
          if (cancelled) return;
          if (Hls?.isSupported?.()) {
            const hls = new Hls({ lowLatencyMode: true, maxBufferLength: 30 });
            previewHlsRef.current = hls;
            hls.loadSource(source);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (cancelled) return;
              setPreviewLoading(false);
              video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data?.fatal || cancelled) return;
              hls.destroy();
              previewHlsRef.current = null;
              if (!nativeFallbackTried) {
                nativeFallbackTried = true;
                startNativePlayback();
                return;
              }
              setPreviewLoading(false);
              setPreviewError("Unable to play this stream URL.");
            });
            return;
          }
        }
        startNativePlayback();
      } catch {
        if (cancelled) return;
        setPreviewLoading(false);
        setPreviewError("Unable to load stream preview.");
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onCanPlay);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onCanPlay);
      video.removeEventListener("error", onError);
      if (previewHlsRef.current) {
        previewHlsRef.current.destroy();
        previewHlsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      setPreviewLoading(false);
    };
  }, [preview, previewVideoEl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (!cached || typeof cached !== "object") return;
      if (Array.isArray(cached.channels)) setChannels(cached.channels);
      if (Array.isArray(cached.healthRows)) setHealthRows(cached.healthRows);
      if (typeof cached.healthSummary === "string") setHealthSummary(cached.healthSummary);
      if (typeof cached.leaveGuardActive === "boolean") setLeaveGuardActive(cached.leaveGuardActive);
      if (Number.isFinite(Number(cached.healthOverallTotal))) setHealthOverallTotal(Number(cached.healthOverallTotal));
      if (Number.isFinite(Number(cached.healthResumeIndex))) setHealthResumeIndex(Number(cached.healthResumeIndex));
      if (Number.isFinite(Number(cached.updatedAt))) setCachedUpdatedAt(Number(cached.updatedAt));
    } catch {
      window.localStorage.removeItem(cacheKey);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!leaveGuardActive && !healthRows.length && !healthLoading) {
      window.localStorage.removeItem(cacheKey);
      setCachedUpdatedAt(0);
      return;
    }
    const payload = {
      channels,
      healthRows,
      healthSummary,
      leaveGuardActive,
      healthOverallTotal,
      healthResumeIndex,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
    setCachedUpdatedAt(payload.updatedAt);
  }, [
    cacheKey,
    channels,
    healthLoading,
    healthOverallTotal,
    healthResumeIndex,
    healthRows,
    healthSummary,
    leaveGuardActive,
  ]);

  useEffect(() => {
    if (!leaveGuardActive) return undefined;

    const currentHref = window.location.href;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      window.history.pushState({ liveCheckGuard: true }, "", currentHref);
      confirmLeaveWorkspace(() => {
        window.history.back();
      });
    };

    const handleDocumentClick = (event) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target") === "_blank") return;

      const targetUrl = new URL(href, window.location.href);
      if (targetUrl.href === window.location.href) return;

      event.preventDefault();
      confirmLeaveWorkspace(() => {
        if (targetUrl.origin === window.location.origin) {
          router.push(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
          return;
        }
        window.location.assign(targetUrl.href);
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.history.pushState({ liveCheckGuard: true }, "", currentHref);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [confirmLeaveWorkspace, leaveGuardActive, router]);

  const changedCount = channels.filter((c) => {
    const changedMeta =
      c.name !== c.originalName ||
      c.category !== c.originalCategory ||
      Number(c.order || 0) !== Number(c.originalOrder || 0) ||
      (c.logo_url || "") !== (c.originalLogo || "") ||
      (c.stream_url || "") !== (c.originalStreamUrl || "") ||
      (c.include_on_home !== false) !== (c.originalIncludeOnHome !== false) ||
      String(c.status || "LIVE").toUpperCase() !== String(c.originalStatus || "LIVE").toUpperCase();
    return changedMeta;
  }).length;

  const healthGroupOptions = useMemo(() => {
    const seen = new Set();
    const list = [];

    initialGroupOrder.forEach((groupName) => {
      const normalized = String(groupName || "").trim() || "Uncategorized";
      if (seen.has(normalized)) return;
      seen.add(normalized);
      list.push(normalized);
    });

    channels.forEach((channel) => {
      const normalized = String(channel.category || "").trim() || "Uncategorized";
      if (seen.has(normalized)) return;
      seen.add(normalized);
      list.push(normalized);
    });

    healthRows.forEach((row) => {
      const normalized = String(row.category || "").trim() || "Uncategorized";
      if (seen.has(normalized)) return;
      seen.add(normalized);
      list.push(normalized);
    });

    return list;
  }, [channels, healthRows, initialGroupOrder]);

  const filteredHealthRows = useMemo(
    () =>
      healthRows.filter((row) => {
        const groupName = String(row.category || "").trim() || "Uncategorized";
        const currentStatus = String(row.status_before || "LIVE").toUpperCase();
        const checkedStatus = String(row.check_status || "").toUpperCase();
        if (healthGroupFilter !== "ALL" && groupName !== healthGroupFilter) return false;
        if (healthPlaylistStatusFilter !== "ALL" && currentStatus !== healthPlaylistStatusFilter) return false;
        if (healthCheckedFilter !== "ALL" && checkedStatus !== healthCheckedFilter) return false;
        return true;
      }),
    [healthRows, healthGroupFilter, healthPlaylistStatusFilter, healthCheckedFilter]
  );

  const checkedDeadRows = healthRows.filter((x) => x.check_status === "DEAD");
  const checkedLiveRows = healthRows.filter((x) => x.check_status === "LIVE");
  const allChannelIds = channels.map((x) => Number(x.id)).filter((x) => Number.isFinite(x));
  const liveCount = channels.reduce(
    (total, c) => total + (String(c.status || "LIVE").toUpperCase() === "LIVE" ? 1 : 0),
    0
  );
  const deadCount = channels.length - liveCount;

  const saveAll = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const normalizedOrder = [...initialGroupOrder];
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
        stream_url: c.stream_url || "",
        include_on_home: c.include_on_home !== false,
        status: String(c.status || "LIVE").toUpperCase() === "DEAD" ? "DEAD" : "LIVE",
        position: idx + 1,
      }));

      const res = await fetch(`/api/admin/playlists/${playlistSlug}/editor-save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels: payload, group_order: normalizedOrder }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error || "Failed to save updates.");
      const savedChannelsById = new Map(payload.map((item) => [Number(item.id), item]));
      setChannels((prev) =>
        prev.map((channel) => {
          const saved = savedChannelsById.get(Number(channel.id));
          if (!saved) return channel;
          const nextStatus = String(saved.status || "LIVE").toUpperCase();
          return {
            ...channel,
            name: saved.name,
            category: saved.category,
            logo_url: saved.logo_url || "",
            stream_url: saved.stream_url || "",
            include_on_home: saved.include_on_home !== false,
            status: nextStatus,
            order: Number(saved.position || channel.order || 0),
            originalName: saved.name,
            originalCategory: saved.category,
            originalLogo: saved.logo_url || "",
            originalStreamUrl: saved.stream_url || "",
            originalIncludeOnHome: saved.include_on_home !== false,
            originalStatus: nextStatus,
            originalOrder: Number(saved.position || channel.order || 0),
          };
        })
      );
      setHealthRows((prev) =>
        prev.map((row) => {
          const saved = savedChannelsById.get(Number(row.id));
          if (!saved) return row;
          const nextStatus = String(saved.status || "LIVE").toUpperCase();
          return {
            ...row,
            url: saved.stream_url || row.url || "",
            category: saved.category || row.category || "",
            status_before: nextStatus,
            manual_live: nextStatus === "LIVE",
            check_status: nextStatus === "LIVE" ? "LIVE" : row.check_status,
            reason: nextStatus === "LIVE" && row.check_status !== "LIVE" ? "manual_override_saved" : row.reason,
          };
        })
      );
      setLeaveGuardActive(false);
      setHealthResumeIndex(0);
      setCachedUpdatedAt(0);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(cacheKey);
      }
      setSuccess(`Updated ${out.updated_channels || 0} channels successfully.`);
      setHealthSummary("Playlist saved. Checked rows were synced with the saved playlist state.");
    } catch (e) {
      setError(e?.message || "Failed to save updates.");
    } finally {
      setSaving(false);
    }
  };

  const runHealthCheck = async ({ startIndex = 0, preserveExisting = false, groupName = "", replaceGroup = false } = {}) => {
    try {
      const normalizedGroup = String(groupName || "").trim();
      const scopeLabel = normalizedGroup || "ALL";
      let latestScopedLive = 0;
      let latestScopedDead = 0;
      let latestScopedChecked = 0;
      setLeaveGuardActive(true);
      setHealthLoading(true);
      setHealthError("");
      setHealthSummary("");
      setHealthRunScope(scopeLabel);
      setHealthOverallTotal(normalizedGroup ? channels.filter((channel) => String(channel.category || "").trim() === normalizedGroup).length : channels.length);
      setHealthResumeIndex(normalizedGroup ? 0 : Math.max(0, Number(startIndex || 0)));
      if (!preserveExisting) {
        setHealthRows([]);
      } else if (replaceGroup && normalizedGroup) {
        setHealthRows((prev) =>
          prev.filter((row) => String(row.category || "").trim() !== normalizedGroup)
        );
      }
      setHealthRowSelection({});
      const res = await fetch(`/api/admin/playlists/${playlistSlug}/health-check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          timeout: 8,
          hard_timeout: 15,
          delay: 0,
          verify_segment: true,
          start_index: startIndex,
          ...(normalizedGroup ? { group: normalizedGroup } : {}),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to run health check.");
      }

      const contentType = String(res.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("application/x-ndjson")) {
        const payload = await res.json().catch(() => ({}));
        const items = Array.isArray(payload.items) ? payload.items : [];
        setHealthRows((prev) => {
          if (!normalizedGroup) return items;
          const withoutScoped = prev.filter((row) => String(row.category || "").trim() !== normalizedGroup);
          return [...withoutScoped, ...items].sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
        });
        setHealthOverallTotal(Number(payload.original_total || payload.total || channels.length));
        setHealthResumeIndex(normalizedGroup ? 0 : Number(payload.start_index || 0) + Number(payload.total || 0));
        setHealthSummary(
          normalizedGroup
            ? `Checked group ${normalizedGroup}: ${payload.total || 0}. LIVE ${payload.live_count || 0}, DEAD ${payload.dead_count || 0}.`
            : `Checked ${payload.total || 0}: LIVE ${payload.live_count || 0}, DEAD ${payload.dead_count || 0}.`
        );
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No health check response body received.");
      const decoder = new TextDecoder();
      let buffer = "";
      let total = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const raw = line.trim();
          if (!raw) continue;
          let evt = null;
          try {
            evt = JSON.parse(raw);
          } catch {
            continue;
          }

          if (evt?.type === "start") {
            total = Number(evt.total || channels.length || 0);
            setHealthOverallTotal(total);
            setHealthResumeIndex(normalizedGroup ? 0 : Number(evt.start_index || startIndex || 0));
            setHealthSummary(
              normalizedGroup
                ? `Checking group ${normalizedGroup} 0/${total || 0}...`
                : `Checking ${Number(evt.start_index || startIndex || 0)}/${total || 0} saved links...`
            );
          }

          if (evt?.type === "item" && evt.id) {
            const currentChannel = channels.find((channel) => Number(channel.id) === Number(evt.id));
            const currentStatus = String(currentChannel?.status || evt.status_before || "LIVE").toUpperCase();
            const nextRow = {
              id: Number(evt.id),
              name: String(evt.name || evt.title || "Stream"),
              category: String(evt.category || ""),
              url: String(evt.url || ""),
              status_before: currentStatus,
              position: Number(evt.position || 0),
              check_status: String(evt.status || "DEAD").toUpperCase(),
              reason: String(evt.reason || ""),
              manual_live: currentStatus === "LIVE",
            };

            setHealthRows((prev) => {
              const withoutCurrent = prev.filter((row) => Number(row.id) !== nextRow.id);
              const merged = [...withoutCurrent, nextRow].sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
              const scopedRows = normalizedGroup
                ? merged.filter((row) => String(row.category || "").trim() === normalizedGroup)
                : merged;
              const scopedLive = scopedRows.filter((row) => row.check_status === "LIVE").length;
              const scopedDead = scopedRows.filter((row) => row.check_status === "DEAD").length;
              const scopedChecked = scopedRows.length;
              latestScopedLive = scopedLive;
              latestScopedDead = scopedDead;
              latestScopedChecked = scopedChecked;
              const progressIndex = normalizedGroup
                ? Math.min(Number(evt.index || scopedChecked), total || scopedChecked)
                : Number(evt.index || merged.length);
              setHealthResumeIndex(normalizedGroup ? 0 : Number(evt.index || merged.length));
              setHealthSummary(
                normalizedGroup
                  ? `Checking group ${normalizedGroup} ${progressIndex}/${total || scopedChecked}: LIVE ${scopedLive}, DEAD ${scopedDead}.`
                  : `Checking ${progressIndex}/${total || merged.length}: LIVE ${scopedLive}, DEAD ${scopedDead}.`
              );
              return merged;
            });
          }

          if (evt?.type === "complete") {
            setHealthResumeIndex(normalizedGroup ? 0 : Number(evt.total || total || 0));
            setHealthSummary(
              normalizedGroup
                ? `Checked group ${normalizedGroup}: ${evt.total || total || latestScopedChecked}. LIVE ${latestScopedLive}, DEAD ${latestScopedDead}.`
                : `Checked ${evt.total || 0}: cached results restored and updated.`
            );
          }
        }
      }
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
      setLeaveGuardActive(true);
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
        setHealthRows((prev) =>
          prev.map((row) =>
            deadIds.includes(Number(row.id)) ? { ...row, status_before: "DEAD", manual_live: false } : row
          )
        );
      }
      if (kind === "disable-all" && allIds.length) {
        setChannels((prev) => prev.map((c) => (allIds.includes(Number(c.id)) ? { ...c, status: "DEAD" } : c)));
        setHealthRows((prev) =>
          prev.map((row) =>
            allIds.includes(Number(row.id)) ? { ...row, status_before: "DEAD", manual_live: false } : row
          )
        );
      }
      if (kind === "enable-live" && liveIds.length) {
        setChannels((prev) => prev.map((c) => (liveIds.includes(Number(c.id)) ? { ...c, status: "LIVE" } : c)));
        setHealthRows((prev) =>
          prev.map((row) =>
            liveIds.includes(Number(row.id)) ? { ...row, status_before: "LIVE", manual_live: true } : row
          )
        );
      }
      if (kind === "enable-all" && allIds.length) {
        setChannels((prev) => prev.map((c) => (allIds.includes(Number(c.id)) ? { ...c, status: "LIVE" } : c)));
        setHealthRows((prev) =>
          prev.map((row) =>
            allIds.includes(Number(row.id)) ? { ...row, status_before: "LIVE", manual_live: true } : row
          )
        );
      }
      if ((kind === "delete-dead" || kind === "delete-dead-confirmed") && deadIds.length) {
        deleteHealthRowsLocally(deadIds);
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

  const healthColumns = useMemo(
    () => [
      {
        id: "select",
        header: "Select",
        enableSorting: false,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Select ${row.original?.name || "row"}`}
          />
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button type="button" className={styles.rowLinkBtn} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Name {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : ""}
          </button>
        ),
      },
      {
        accessorKey: "category",
        header: ({ column }) => (
          <button type="button" className={styles.rowLinkBtn} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Group {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : ""}
          </button>
        ),
        cell: ({ row }) => row.original.category || "Uncategorized",
      },
      {
        accessorKey: "status_before",
        header: ({ column }) => (
          <button type="button" className={styles.rowLinkBtn} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Playlist Status {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : ""}
          </button>
        ),
      },
      {
        accessorKey: "check_status",
        header: ({ column }) => (
          <button type="button" className={styles.rowLinkBtn} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Checked {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : ""}
          </button>
        ),
      },
      { accessorKey: "reason", header: "Reason", cell: ({ row }) => row.original.reason || "-" },
      {
        id: "set_live",
        header: "Set LIVE",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={r.manual_live !== false}
                onChange={(e) => toggleHealthRowPlaylistLive(r.id, e.target.checked)}
              />
              <span>Live</span>
            </label>
          );
        },
      },
      {
        accessorKey: "url",
        header: "Stream URL",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className={styles.healthUrlEditor}>
              <input
                className={styles.inlineInput}
                value={r.url || ""}
                onChange={(e) => updateHealthRowUrl(r.id, e.target.value)}
                placeholder="Update stream URL"
              />
              <div className={styles.healthUrlActions}>
                <button
                  type="button"
                  className={styles.secondaryBtnCompact}
                  disabled={!String(r.url || "").trim()}
                  onClick={() => useHttpForHealthRow(r.id)}
                >
                  Use HTTP
                </button>
              </div>
            </div>
          );
        },
      },
      {
        id: "preview",
        header: "Preview",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <button
              type="button"
              className={styles.previewCellBtn}
              disabled={!String(r.url || "").trim()}
              onClick={() => openPreview(r.name || "Stream", r.url || "")}
            >
              Preview
            </button>
          );
        },
      },
    ],
    [openPreview, toggleHealthRowPlaylistLive, updateHealthRowUrl, useHttpForHealthRow]
  );

  const healthTable = useReactTable({
    data: filteredHealthRows,
    columns: healthColumns,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    state: {
      sorting: healthSorting,
      globalFilter: healthSearch,
      rowSelection: healthRowSelection,
    },
    onSortingChange: setHealthSorting,
    onGlobalFilterChange: setHealthSearch,
    onRowSelectionChange: setHealthRowSelection,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue || "").trim().toLowerCase();
      if (!query) return true;
      const item = row.original || {};
      const haystack = [item.name, item.category, item.url, item.reason, item.status_before, item.check_status]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedHealthIds = healthTable.getSelectedRowModel().rows.map((row) => Number(row.original.id));
  const filteredHealthIds = healthTable.getFilteredRowModel().rows.map((row) => Number(row.original.id));
  const isScopedHealthRun = healthGroupFilter !== "ALL";
  const resumableProgress = Math.max(Number(healthResumeIndex || 0), Number(healthRows.length || 0));
  const hasResumableSession =
    !isScopedHealthRun &&
    !healthLoading &&
    resumableProgress > 0 &&
    Number(healthOverallTotal || channels.length || 0) > resumableProgress;
  const cachedProgressText =
    Number(healthOverallTotal || channels.length || 0) > 0
      ? `${resumableProgress}/${Number(healthOverallTotal || channels.length || 0)}`
      : `${resumableProgress}`;
  const cachedUpdatedLabel = cachedUpdatedAt
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(cachedUpdatedAt))
    : "";

  const startFreshHealthCheck = () => {
    setResumePromptOpen(false);
    setHealthRows([]);
    setHealthSummary("");
    setHealthError("");
    setHealthRowSelection({});
    setHealthResumeIndex(0);
    setHealthOverallTotal(channels.length);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(cacheKey);
    }
    runHealthCheck({ startIndex: 0, preserveExisting: false });
  };

  return (
    <section className={styles.editorLayout}>
      <article className={styles.card}>
        <div className={styles.editorTop}>
          <div>
            <h2>Playlist Live Check Workspace</h2>
            <p className={styles.hint}>
              Playlist: <code>{playlistSlug}</code> | Channels: {channels.length} | LIVE: {liveCount} | DEAD: {deadCount}
            </p>
            <p className={styles.hint}>
              Bulk test, filter by group/result, preview failing links, then save only the changes you want.
            </p>
          </div>
          <div className={styles.editorActions}>
            <Link href={`/dashboard/playlists?selected=${playlistSlug}#playlist-editor`} className={styles.secondaryBtn}>
              Back To Editor
            </Link>
            <button type="button" className={styles.primaryBtn} onClick={saveAll} disabled={saving}>
              {saving ? "Saving..." : `Save updates (${changedCount})`}
            </button>
          </div>
        </div>
      </article>

      {(leaveGuardActive || healthRows.length) ? (
        <article className={styles.card}>
          <div className={styles.settingsHintTile}>
            <p className={styles.settingsHintTitle}>Cached Session</p>
            <p className={styles.settingsHintText}>
              {hasResumableSession
                ? `Resume available from ${cachedProgressText}.`
                : healthRows.length
                ? `Current cached progress: ${cachedProgressText}.`
                : "A cached session is active for this playlist."}
              {healthRunScope !== "ALL" ? ` Last run scope: ${healthRunScope}.` : ""}
              {cachedUpdatedLabel ? ` Last updated: ${cachedUpdatedLabel}.` : ""}
            </p>
          </div>
        </article>
      ) : null}

      <article className={styles.card}>
        <h2>{playlistName}</h2>
        <p className={styles.hint}>
          This workspace is separated from the playlist editor so bulk checking and filtering do not overload the main page.
        </p>
        {error ? <p className={styles.errorText}>{error}</p> : null}
        {success ? <p className={styles.successText}>{success}</p> : null}
      </article>

      <article className={styles.card}>
        <h2>Saved Playlist Live Check</h2>
        <p className={styles.hint}>
          Check current saved links. DEAD links can be disabled or removed. LIVE links can be re-enabled or manually curated.
        </p>
        <div className={styles.editorActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              if (hasResumableSession) {
                setResumePromptOpen(true);
                return;
              }
              runHealthCheck({
                startIndex: 0,
                preserveExisting: isScopedHealthRun,
                groupName: isScopedHealthRun ? healthGroupFilter : "",
                replaceGroup: isScopedHealthRun,
              });
            }}
            disabled={healthLoading || healthActionLoading}
          >
            {healthLoading ? "Checking..." : isScopedHealthRun ? `Run ${healthGroupFilter} Check` : "Run Saved Links Check"}
          </button>
          {hasResumableSession ? (
            <>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={healthLoading || healthActionLoading}
                onClick={() => runHealthCheck({ startIndex: resumableProgress, preserveExisting: true, groupName: "", replaceGroup: false })}
                title="Continue from the last checked item"
              >
                Resume From {cachedProgressText}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={healthLoading || healthActionLoading}
                onClick={startFreshHealthCheck}
                title="Clear cached progress and test again from the beginning"
              >
                Start Over
              </button>
            </>
          ) : null}
          <button type="button" className={styles.secondaryBtn} disabled={healthActionLoading || !checkedDeadRows.length} onClick={() => applyHealthAction("disable-dead")}>
            Temp Disable DEAD ({checkedDeadRows.length})
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={healthActionLoading || !allChannelIds.length} onClick={() => applyHealthAction("disable-all")}>
            Set ALL DEAD ({allChannelIds.length})
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={healthActionLoading || !checkedLiveRows.length} onClick={() => applyHealthAction("enable-live")}>
            Re-enable LIVE ({checkedLiveRows.length})
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={healthActionLoading || !allChannelIds.length} onClick={() => applyHealthAction("enable-all")}>
            Set ALL LIVE ({allChannelIds.length})
          </button>
          <button type="button" className={styles.secondaryBtn} disabled={healthActionLoading || !checkedDeadRows.length} onClick={() => applyHealthAction("delete-dead")}>
            Permanent Delete DEAD ({checkedDeadRows.length})
          </button>
        </div>
        <div className={`${styles.editorActions} ${styles.channelToolbar}`}>
          <label className={styles.field}>
            <span>Group Filter</span>
            <select className={styles.inlineInput} value={healthGroupFilter} onChange={(e) => setHealthGroupFilter(e.target.value)}>
              <option value="ALL">All Groups</option>
              {healthGroupOptions.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Playlist Status</span>
            <select className={styles.inlineInput} value={healthPlaylistStatusFilter} onChange={(e) => setHealthPlaylistStatusFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="LIVE">LIVE</option>
              <option value="DEAD">DEAD</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Checked Result</span>
            <select className={styles.inlineInput} value={healthCheckedFilter} onChange={(e) => setHealthCheckedFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="LIVE">LIVE</option>
              <option value="DEAD">DEAD</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Search</span>
            <input
              className={styles.inlineInput}
              placeholder="Search name, group, reason, URL..."
              value={healthSearch}
              onChange={(e) => setHealthSearch(e.target.value)}
            />
          </label>
        </div>
        <div className={styles.editorActions}>
          <button
            type="button"
            className={styles.secondaryBtnCompact}
            disabled={!filteredHealthIds.length}
            onClick={() => {
              const next = {};
              filteredHealthIds.forEach((id) => {
                next[String(id)] = true;
              });
              setHealthRowSelection(next);
            }}
          >
            Select Filtered ({filteredHealthIds.length})
          </button>
          <button type="button" className={styles.secondaryBtnCompact} disabled={!selectedHealthIds.length} onClick={() => setHealthRowSelection({})}>
            Clear Selection ({selectedHealthIds.length})
          </button>
          <button type="button" className={styles.secondaryBtnCompact} disabled={!selectedHealthIds.length} onClick={() => applyHealthSelectionAction("live", selectedHealthIds)}>
            Set Selected LIVE ({selectedHealthIds.length})
          </button>
          <button
            type="button"
            className={styles.primaryBtnCompact}
            disabled={!selectedHealthIds.length || !filteredHealthIds.length}
            onClick={() => keepSelectedRowsInPlaylist(selectedHealthIds, filteredHealthIds)}
          >
            Keep Selected In Playlist ({selectedHealthIds.length})
          </button>
          <button type="button" className={styles.secondaryBtnCompact} disabled={!selectedHealthIds.length} onClick={() => applyHealthSelectionAction("dead", selectedHealthIds)}>
            Set Selected DEAD ({selectedHealthIds.length})
          </button>
          <button type="button" className={styles.secondaryBtnCompact} disabled={!selectedHealthIds.length} onClick={() => applyHealthSelectionAction("delete", selectedHealthIds)}>
            Delete Selected ({selectedHealthIds.length})
          </button>
        </div>
        {healthError ? <p className={styles.errorText}>{healthError}</p> : null}
        {healthSummary ? <p className={styles.successText}>{healthSummary}</p> : null}
        {hasResumableSession ? (
          <p className={styles.hint}>
            Cached progress found: {healthResumeIndex}/{healthOverallTotal} checked. You can resume from where you left off or start from the beginning.
          </p>
        ) : null}
        {isScopedHealthRun ? (
          <p className={styles.hint}>
            Group mode active: only <strong>{healthGroupFilter}</strong> channels will be checked. You can save after each group without running the full playlist.
          </p>
        ) : null}
        <p className={styles.hint}>
          Showing {healthTable.getFilteredRowModel().rows.length} of {filteredHealthRows.length} checked rows
          {isScopedHealthRun ? " in the selected group" : ""}. Selected: {selectedHealthIds.length}.
          Use filters to target a group, then apply selected actions. `Keep Selected In Playlist` keeps the selected checked rows and removes the other checked rows in the current filtered view when you save.
        </p>
        {healthRows.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.editorTable}>
              <thead>
                {healthTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {healthTable.getRowModel().rows.map((row) => (
                  <tr key={`health-${row.original.id}`} className={row.getIsSelected() ? styles.selectedRow : ""}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={`${String(row.original.id)}-${cell.column.id}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      {preview ? (
        <div className={styles.modalWrap} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h4>{preview.title || "Channel Preview"}</h4>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => {
                  setPreview(null);
                  setPreviewError("");
                  setPreviewLoading(false);
                }}
              >
                Close
              </button>
            </div>
            {previewLoading ? <p className={styles.pending}>Loading preview...</p> : null}
            {previewError ? <p className={styles.errorText}>{previewError}</p> : null}
            {preview.url ? (
              <video ref={setPreviewVideoEl} controls autoPlay playsInline className={styles.video}>
                Your browser could not play this stream.
              </video>
            ) : (
              <p className={styles.errorText}>No stream URL found for preview.</p>
            )}
            {preview.url ? (
              <p className={styles.hint}>
                Playlist preview link:{" "}
                <a href={preview.url} target="_blank" rel="noreferrer" className={styles.url}>
                  {preview.url}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <AlertDialog open={resumePromptOpen} onOpenChange={setResumePromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume previous live check?</AlertDialogTitle>
            <AlertDialogDescription>
              Cached progress found for this playlist. Continue from {cachedProgressText}, or discard cache and start again from the beginning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={styles.secondaryBtn}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={styles.secondaryBtn}
              onClick={startFreshHealthCheck}
            >
              Start From Beginning
            </AlertDialogAction>
            <AlertDialogAction
              className={styles.primaryBtn}
              onClick={() => {
                setResumePromptOpen(false);
                runHealthCheck({ startIndex: resumableProgress, preserveExisting: true });
              }}
            >
              Resume From Last Checked
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog((prev) => ({ ...prev, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={styles.secondaryBtn}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={styles.primaryBtn}
              onClick={() => {
                confirmDialog.onConfirm?.();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }}
            >
              {confirmDialog.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
