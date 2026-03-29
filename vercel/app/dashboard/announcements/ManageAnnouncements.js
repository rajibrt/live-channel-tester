"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ImagePlus, Megaphone, Pencil, Pin, PinOff, Plus, Save, Trash2, X } from "lucide-react";
import styles from "../page.module.css";
import { Button } from "../../../components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { Switch } from "../../../components/ui/switch";
import RichArticleEditor from "./RichArticleEditor";

const EMPTY_FORM = {
  id: "",
  title: "",
  content_html: "",
  content_type: "article",
  featured_image_url: "",
  featured_image_path: "",
  featured_image_bucket: "",
  is_published: false,
  is_pinned: false,
  show_title_in_ticker: false,
};

function normalizePosition(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function normalizeItemsOrder(rows) {
  const sorted = (Array.isArray(rows) ? rows : [])
    .map((row) => ({ ...row, position: normalizePosition(row?.position) }))
    .sort((a, b) => {
      const ap = normalizePosition(a.position);
      const bp = normalizePosition(b.position);
      if (ap !== bp) return ap - bp;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  return sorted.map((row, idx) => ({ ...row, position: idx + 1 }));
}

function stripHtml(html) {
  const decoded = String(html || "")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  return decoded
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpeed(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 34;
  return Math.min(80, Math.max(1, Math.round(num)));
}

function TruncatedTooltipCell({ text = "-", className = "", maxLen = 120 }) {
  const value = String(text || "-");
  const textRef = useRef(null);
  const [overflowed, setOverflowed] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return undefined;
    const checkOverflow = () => {
      setOverflowed(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
    };
    checkOverflow();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(checkOverflow);
      ro.observe(el);
    } else {
      window.addEventListener("resize", checkOverflow);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", checkOverflow);
    };
  }, [value]);

  const shown = value.length > maxLen ? `${value.slice(0, maxLen - 1)}...` : value;
  const node = <span ref={textRef} className={`${styles.cellEllipsis} ${className}`}>{shown}</span>;
  if (!overflowed && shown === value) return node;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}

export default function ManageAnnouncements({ initialItems = [], loadError = "", mode = "articles" }) {
  const submitModeRef = useRef("default");
  const isAnnouncementMode = mode === "announcements";
  const [items, setItems] = useState(() =>
    normalizeItemsOrder(
      initialItems.filter((row) => {
        const kind = String(row?.content_type || "").trim().toLowerCase();
        return isAnnouncementMode ? kind === "announcement" : kind === "article";
      })
    )
  );
  const [error, setError] = useState(loadError);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pinFilter, setPinFilter] = useState("all");
  const [sortMode, setSortMode] = useState("position");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTicker, setSavingTicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tickerSpeedSeconds, setTickerSpeedSeconds] = useState(34);
  const [tickerIconText, setTickerIconText] = useState("•");
  const [editingOrderId, setEditingOrderId] = useState("");
  const [orderDraft, setOrderDraft] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const stats = useMemo(() => {
    const total = items.length;
    const published = items.filter((x) => x.is_published).length;
    const pinned = items.filter((x) => x.is_pinned).length;
    return { total, published, draft: total - published, pinned };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = items.filter((row) => {
      if (statusFilter === "published" && !row.is_published) return false;
      if (statusFilter === "draft" && row.is_published) return false;
      if (isAnnouncementMode) {
        if (pinFilter === "pinned" && !row.is_pinned) return false;
        if (pinFilter === "normal" && row.is_pinned) return false;
      }
      if (!q) return true;
      const plain = stripHtml(row.content_html);
      return `${row.title} ${plain}`.toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      if (sortMode === "position") return normalizePosition(a.position) - normalizePosition(b.position);
      if (sortMode === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortMode === "title_asc") return String(a.title || "").localeCompare(String(b.title || ""));
      if (sortMode === "title_desc") return String(b.title || "").localeCompare(String(a.title || ""));
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [items, searchTerm, statusFilter, pinFilter, sortMode, isAnnouncementMode]);

  useEffect(() => {
    if (!isAnnouncementMode) return undefined;
    let active = true;
    const loadTickerSettings = async () => {
      try {
        const res = await fetch("/api/admin/announcements/settings", { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !active) return;
        setTickerSpeedSeconds(normalizeSpeed(payload?.speed_seconds));
        setTickerIconText(String(payload?.icon_text || "•"));
      } catch {
        if (active) {
          setTickerSpeedSeconds(34);
          setTickerIconText("•");
        }
      }
    };
    loadTickerSettings();
    return () => {
      active = false;
    };
  }, [isAnnouncementMode]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
  };

  const openEdit = (row) => {
    setForm({
      id: String(row?.id || ""),
      title: String(row?.title || ""),
      content_html: String(row?.content_html || ""),
      content_type: String(row?.content_type || (isAnnouncementMode ? "announcement" : "article")),
      featured_image_url: String(row?.featured_image_url || ""),
      featured_image_path: String(row?.featured_image_path || ""),
      featured_image_bucket: String(row?.featured_image_bucket || ""),
      is_published: !!row?.is_published,
      is_pinned: !!row?.is_pinned,
      show_title_in_ticker: !!row?.show_title_in_ticker,
    });
    setEditOpen(true);
  };

  async function uploadArticleImage(file) {
    try {
      if (!file) return;
      setUploadingImage(true);
      setError("");
      setMessage("");
      const data = new FormData();
      data.append("file", file);
      data.append("folder", "featured");
      const res = await fetch("/api/admin/media/article-image-upload", {
        method: "POST",
        body: data,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to upload article image.");
      setForm((prev) => ({
        ...prev,
        featured_image_url: String(payload?.preview_url || payload?.url || ""),
        featured_image_path: String(payload?.path || ""),
        featured_image_bucket: String(payload?.bucket || ""),
      }));
      setMessage("Featured image uploaded.");
    } catch (err) {
      setError(err?.message || "Failed to upload article image.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveTickerSpeed() {
    setSavingTicker(true);
    setError("");
    setMessage("");
    try {
      const speed = normalizeSpeed(tickerSpeedSeconds);
      const iconText = String(tickerIconText || "").trim().slice(0, 16) || "•";
      const res = await fetch("/api/admin/announcements/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ speed_seconds: speed, icon_text: iconText }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save ticker speed.");
      setTickerSpeedSeconds(speed);
      setTickerIconText(String(payload?.icon_text || iconText));
      setMessage("Global ticker speed updated.");
    } catch (err) {
      setError(err?.message || "Failed to save ticker speed.");
    } finally {
      setSavingTicker(false);
    }
  }

  async function handleEdit(event) {
    event.preventDefault();
    if (!form.id) return;
    setError("");
    setMessage("");
    setSaving(true);
    const isDraftSubmit = submitModeRef.current === "draft";
    submitModeRef.current = "default";
    try {
      const res = await fetch(`/api/admin/announcements/${form.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          content_html: form.content_html,
          content_type: isAnnouncementMode ? "announcement" : "article",
          featured_image_url: form.featured_image_url,
          featured_image_path: form.featured_image_path,
          featured_image_bucket: form.featured_image_bucket,
          is_published: isDraftSubmit ? false : !!form.is_published,
          is_pinned: form.is_pinned,
          show_title_in_ticker: form.show_title_in_ticker,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update article.");
      const shouldKeep = String(payload.item?.content_type || "").trim().toLowerCase() === (isAnnouncementMode ? "announcement" : "article");
      setItems((prev) =>
        normalizeItemsOrder(
          shouldKeep
            ? prev.map((x) => (String(x.id) === String(form.id) ? payload.item : x))
            : prev.filter((x) => String(x.id) !== String(form.id))
        )
      );
      setMessage(isAnnouncementMode ? "Announcement updated." : "Article updated.");
      setEditOpen(false);
      resetForm();
    } catch (err) {
      setError(err?.message || "Failed to update article.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const target = deleteTarget;
    if (!target?.id) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/announcements/${target.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to delete article.");
      setItems((prev) => normalizeItemsOrder(prev.filter((x) => String(x.id) !== String(target.id))));
      setMessage("Article deleted.");
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      setError(err?.message || "Failed to delete article.");
    } finally {
      setSaving(false);
    }
  }

  async function patchRow(id, patch, successMessage = "") {
    setBusyId(String(id));
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Update failed.");
      setItems((prev) => normalizeItemsOrder(prev.map((x) => (String(x.id) === String(id) ? payload.item : x))));
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setError(err?.message || "Update failed.");
    } finally {
      setBusyId("");
    }
  }

  async function saveAnnouncementOrder(nextRows, successMessage = isAnnouncementMode ? "Announcement order updated." : "Article order updated.") {
    const previous = normalizeItemsOrder(items);
    const previousById = new Map(previous.map((row) => [String(row.id), normalizePosition(row.position)]));
    const changedRows = nextRows.filter((row) => {
      const prevPos = previousById.get(String(row.id)) || 0;
      return prevPos !== normalizePosition(row.position);
    });
    if (!changedRows.length) return;

    setBusyId("order");
    setError("");
    setMessage("");
    try {
      await Promise.all(
        changedRows.map(async (row) => {
          const res = await fetch(`/api/admin/announcements/${row.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ position: normalizePosition(row.position) }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload?.error || "Failed to save order.");
        })
      );
      setItems(normalizeItemsOrder(nextRows));
      setMessage(successMessage);
    } catch (err) {
      setError(err?.message || "Failed to save order.");
    } finally {
      setBusyId("");
    }
  }

  function moveAnnouncement(id, direction) {
    const current = normalizeItemsOrder(items);
    const from = current.findIndex((row) => String(row.id) === String(id));
    if (from < 0) return;
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= current.length) return;

    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const positioned = next.map((row, idx) => ({ ...row, position: idx + 1 }));
    saveAnnouncementOrder(positioned);
  }

  function moveAnnouncementToPosition(id, rawPosition) {
    const current = normalizeItemsOrder(items);
    const from = current.findIndex((row) => String(row.id) === String(id));
    if (from < 0) return;
    const requested = Number(rawPosition);
    if (!Number.isFinite(requested)) return;
    const to = Math.min(current.length - 1, Math.max(0, Math.floor(requested) - 1));
    if (to === from) return;

    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const positioned = next.map((row, idx) => ({ ...row, position: idx + 1 }));
    saveAnnouncementOrder(positioned);
  }

  return (
    <section className={styles.form}>
      <div className={styles.stats}>
        <article className={styles.statCard}><p>{isAnnouncementMode ? "Total Announcements" : "Total Articles"}</p><strong>{stats.total}</strong></article>
        <article className={styles.statCard}><p>Published</p><strong>{stats.published}</strong></article>
        <article className={styles.statCard}><p>Drafts</p><strong>{stats.draft}</strong></article>
        {isAnnouncementMode ? <article className={styles.statCard}><p>Pinned</p><strong>{stats.pinned}</strong></article> : null}
      </div>

      <div className={styles.controlRowEnd}>
        <Link href={isAnnouncementMode ? "/dashboard/announcements/new" : "/dashboard/articles/new"} className={styles.primaryBtnCompact}>
          <Plus size={16} />
          <span>{isAnnouncementMode ? "Add Announcement" : "Add Article"}</span>
        </Link>

        {isAnnouncementMode ? <div className={styles.controlRow}>
          <label className={styles.field}>
            <span>Ticker Speed (Desktop, seconds)</span>
            <input
              type="number"
              min={1}
              max={80}
              step={1}
              value={tickerSpeedSeconds}
              onChange={(e) => setTickerSpeedSeconds(e.target.value)}
            />
            <small className={styles.fieldHint}>Global speed for all pinned announcements.</small>
          </label>
          <label className={styles.field}>
            <span>Listing Icon (Global)</span>
            <input
              type="text"
              maxLength={16}
              value={tickerIconText}
              onChange={(e) => setTickerIconText(e.target.value)}
              placeholder="e.g. • or 🔔 or ➤"
            />
            <small className={styles.fieldHint}>This icon/text will appear before every ticker item.</small>
          </label>
          <Button type="button" variant="outline" className={styles.secondaryBtn} disabled={savingTicker} onClick={saveTickerSpeed}>
            <Save size={16} />
            <span>{savingTicker ? "Saving..." : "Save Ticker Settings"}</span>
          </Button>
        </div> : null}

        {message ? <p className={styles.successText}>{message}</p> : null}
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isAnnouncementMode ? "Search title or announcement text" : "Search title or article text"}
          />
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        {isAnnouncementMode ? (
          <label className={styles.field}>
            <span>Pin Filter</span>
            <select value={pinFilter} onChange={(e) => setPinFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="pinned">Pinned</option>
              <option value="normal">Not Pinned</option>
            </select>
          </label>
        ) : null}
        <label className={styles.field}>
          <span>Sort</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="position">Custom Position</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
          </select>
        </label>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <TooltipProvider delayDuration={120}>
        <div className={styles.tableWrap}>
          <Table className={styles.announceTable}>
            <TableHeader>
              <TableRow>
                <TableHead className={styles.colAnnounceOrder}>#</TableHead>
                <TableHead className={styles.colAnnounceTitle}>Title</TableHead>
                <TableHead className={styles.colAnnounceStatus}>Status</TableHead>
                {isAnnouncementMode ? <TableHead className={styles.colAnnouncePin}>Pinned</TableHead> : null}
                {isAnnouncementMode ? <TableHead className={styles.colAnnounceMode}>Ticker Mode</TableHead> : null}
                <TableHead className={styles.colAnnounceUpdated}>Updated</TableHead>
                <TableHead className={styles.colAnnounceActions}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className={styles.colAnnounceOrder}>
                    {editingOrderId === String(row.id) ? (
                      <div className={styles.groupEditRow}>
                        <input
                          type="number"
                          min={1}
                          max={items.length}
                          className={styles.inlineInput}
                          value={orderDraft}
                          onChange={(e) => setOrderDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              moveAnnouncementToPosition(row.id, orderDraft);
                              setEditingOrderId("");
                              setOrderDraft("");
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingOrderId("");
                              setOrderDraft("");
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => {
                            moveAnnouncementToPosition(row.id, orderDraft);
                            setEditingOrderId("");
                            setOrderDraft("");
                          }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => {
                            setEditingOrderId("");
                            setOrderDraft("");
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.miniActions}>
                        <span>{normalizePosition(row.position) || "-"}</span>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => {
                            setEditingOrderId(String(row.id));
                            setOrderDraft(String(normalizePosition(row.position) || 1));
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={styles.colAnnounceTitle}>
                    <TruncatedTooltipCell text={row.title || "-"} />
                  </TableCell>
                  <TableCell className={styles.colAnnounceStatus}>
                    <span className={row.is_published ? styles.badgeLive : styles.badgeMuted}>
                      {row.is_published ? "Published" : "Draft"}
                    </span>
                  </TableCell>
                  {isAnnouncementMode ? (
                    <TableCell className={styles.colAnnouncePin}>
                      <span className={row.is_pinned ? styles.badgeInfo : styles.badgeMuted}>
                        {row.is_pinned ? "Pinned" : "Normal"}
                      </span>
                    </TableCell>
                  ) : null}
                  {isAnnouncementMode ? (
                    <TableCell className={styles.colAnnounceMode}>
                      <span className={row.show_title_in_ticker ? styles.badgeInfo : styles.badgeMuted}>
                        {row.show_title_in_ticker ? "Title + Modal" : "Body Text"}
                      </span>
                    </TableCell>
                  ) : null}
                  <TableCell className={styles.colAnnounceUpdated}>
                    <TruncatedTooltipCell text={row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"} />
                  </TableCell>
                  <TableCell className={styles.colAnnounceActions}>
                    <div className={`${styles.clientActionsRow} ${styles.announceActionsRow}`}>
                      <Button
                        type="button"
                        variant="outline"
                        className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                        onClick={() => moveAnnouncement(row.id, "up")}
                        disabled={busyId === "order"}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild><span><ArrowUp size={14} /></span></TooltipTrigger>
                          <TooltipContent>Move up</TooltipContent>
                        </Tooltip>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                        onClick={() => moveAnnouncement(row.id, "down")}
                        disabled={busyId === "order"}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild><span><ArrowDown size={14} /></span></TooltipTrigger>
                          <TooltipContent>Move down</TooltipContent>
                        </Tooltip>
                      </Button>
                      {isAnnouncementMode ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                          onClick={() => openEdit(row)}
                          disabled={busyId === String(row.id)}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild><span><Pencil size={14} /></span></TooltipTrigger>
                            <TooltipContent>Edit announcement</TooltipContent>
                          </Tooltip>
                        </Button>
                      ) : (
                        <Link
                          href={`/dashboard/articles/${encodeURIComponent(String(row.id || ""))}`}
                          className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild><span><Pencil size={14} /></span></TooltipTrigger>
                            <TooltipContent>Edit article</TooltipContent>
                          </Tooltip>
                        </Link>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                        onClick={() =>
                          patchRow(
                            row.id,
                            { is_published: !row.is_published },
                            row.is_published
                              ? "Moved to draft."
                              : isAnnouncementMode
                                ? "Announcement published successfully."
                                : "Article published successfully."
                          )
                        }
                        disabled={busyId === String(row.id)}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild><span>{row.is_published ? <EyeOff size={14} /> : <Eye size={14} />}</span></TooltipTrigger>
                          <TooltipContent>{row.is_published ? "Unpublish" : "Publish"}</TooltipContent>
                        </Tooltip>
                      </Button>
                      {isAnnouncementMode ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                          onClick={() => patchRow(row.id, { is_pinned: !row.is_pinned }, row.is_pinned ? "Unpinned." : "Pinned to top.")}
                          disabled={busyId === String(row.id)}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild><span>{row.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}</span></TooltipTrigger>
                            <TooltipContent>{row.is_pinned ? "Unpin" : "Pin to top"}</TooltipContent>
                          </Tooltip>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                        onClick={() => {
                          setDeleteTarget(row);
                          setDeleteOpen(true);
                        }}
                        disabled={busyId === String(row.id)}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild><span><Trash2 size={14} /></span></TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredItems.length ? (
                <TableRow>
                  <TableCell colSpan={isAnnouncementMode ? 7 : 5} className={styles.pending}>No {isAnnouncementMode ? "announcement" : "article"} found.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

      {isAnnouncementMode ? (
        <AlertDialog open={editOpen} onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) resetForm();
        }}>
          <AlertDialogContent className={styles.announceModal}>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Announcement</AlertDialogTitle>
              <AlertDialogDescription>Update announcement details then save changes.</AlertDialogDescription>
            </AlertDialogHeader>
            <form className={styles.form} onSubmit={handleEdit}>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Content / Article</span>
                <RichArticleEditor
                  value={form.content_html}
                  onChange={(value) => setForm((prev) => ({ ...prev, content_html: value }))}
                />
              </label>
              <div className={`${styles.field} ${styles.full}`}>
                <span className={styles.statLabelWithIcon}><ImagePlus size={14} /><span>Featured Image</span></span>
                <div className={styles.logoFieldRow}>
                  <input
                    className={styles.inlineInput}
                    type="text"
                    value={form.featured_image_url}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        featured_image_url: e.target.value,
                        featured_image_path: "",
                        featured_image_bucket: "",
                      }))
                    }
                    placeholder="https://your-site.example/article-cover.jpg or /api/media/object?..."
                  />
                  <label className={styles.uploadLogoBtn}>
                    {uploadingImage ? "Uploading..." : "Upload image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={uploadingImage}
                      onChange={(e) => uploadArticleImage(e.target.files?.[0])}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                <small className={styles.fieldHint}>Recommended: wide cover image, JPG/PNG/WebP, under 5MB.</small>
                {form.featured_image_url ? (
                  <div className={styles.articleImagePreview}>
                    <img src={form.featured_image_url} alt="Featured preview" className={styles.articleImagePreviewImg} />
                  </div>
                ) : null}
              </div>
              <div className={styles.formGrid}>
                <label className={styles.checkRow}>
                  <Switch
                    checked={!!form.is_published}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_published: checked }))}
                  />
                  <span>Published</span>
                </label>
                <label className={styles.checkRow}>
                  <Switch
                    checked={!!form.is_pinned}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_pinned: checked }))}
                  />
                  <span>Pinned</span>
                </label>
              </div>
              {error ? <p className={styles.errorText}>{error}</p> : null}
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline" className={`${styles.secondaryBtn} ${styles.modalActionBtn}`}>Cancel</Button>
                </AlertDialogCancel>
                <Button
                  type="submit"
                  variant="outline"
                  className={`${styles.secondaryBtn} ${styles.modalActionBtn}`}
                  disabled={saving}
                  onClick={() => {
                    submitModeRef.current = "draft";
                  }}
                >
                  {saving ? "Saving..." : "Save as Draft"}
                </Button>
                <Button type="submit" className={`${styles.primaryBtn} ${styles.modalActionBtn}`} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {isAnnouncementMode ? "announcement" : "article"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. {isAnnouncementMode ? "Announcement" : "Article"} title: <strong>{deleteTarget?.title || "-"}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" className={`${styles.secondaryBtn} ${styles.modalActionBtn}`}>Cancel</Button>
            </AlertDialogCancel>
            <Button type="button" className={`${styles.primaryBtn} ${styles.modalActionBtn}`} disabled={saving} onClick={handleDelete}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className={styles.hint}>
        <Megaphone size={14} style={{ verticalAlign: "text-bottom", marginRight: 6 }} />
        {isAnnouncementMode
          ? "Use this module for maintenance alerts, notices, and ticker updates."
          : "Use this module for editorial articles and featured reading content."}
      </p>
    </section>
  );
}
