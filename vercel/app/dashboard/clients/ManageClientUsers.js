"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, History, Pencil, Plus, Trash2 } from "lucide-react";
import styles from "../page.module.css";
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
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";

const EMPTY_FORM = {
  email: "",
  full_name: "",
  mobile_number: "",
  password: "",
};

const EMPTY_EDIT_FORM = {
  user_id: "",
  email: "",
  full_name: "",
  mobile_number: "",
  is_active: true,
  approval_status: "approved",
  approval_note: "",
  new_password: "",
  confirm_password: "",
};

function getFacebookProfileUrl(row) {
  if (String(row?.auth_provider || "").toLowerCase() !== "facebook") return "";
  const fromMeta = String(row?.oauth_profile_json?.profile_url || "").trim();
  if (fromMeta && /^https?:\/\//i.test(fromMeta)) {
    try {
      const parsed = new URL(fromMeta);
      if (/facebook\.com$/i.test(parsed.hostname) || /\.facebook\.com$/i.test(parsed.hostname)) {
        const firstSegment = String(parsed.pathname || "").replace(/^\/+/, "").split("/")[0] || "";
        const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firstSegment);
        if (!uuidLike) return parsed.toString();
      }
    } catch {
      // ignore invalid metadata URL
    }
  }
  const usernameCandidates = [
    row?.oauth_profile_json?.user_name,
    row?.oauth_profile_json?.username,
    row?.oauth_profile_json?.preferred_username,
  ];
  for (const candidate of usernameCandidates) {
    const username = String(candidate || "").trim();
    if (/^[A-Za-z0-9.]{3,100}$/.test(username)) {
      return `https://www.facebook.com/${username}`;
    }
  }
  const providerId = String(row?.provider_user_id || "").trim();
  if (/^\d{5,30}$/.test(providerId)) {
    return `https://www.facebook.com/profile.php?id=${providerId}`;
  }
  return "";
}

function getFacebookSearchUrl(row) {
  if (String(row?.auth_provider || "").toLowerCase() !== "facebook") return "";
  const query = String(row?.full_name || row?.email || "").trim();
  if (!query) return "https://www.facebook.com/search/top";
  return `https://www.facebook.com/search/top?q=${encodeURIComponent(query)}`;
}

function TruncatedTooltipCell({ text = "-", className = "", asButton = false, onClick }) {
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

  const baseNode = asButton ? (
    <button type="button" ref={textRef} className={`${className} ${styles.cellEllipsis} ${styles.rowLinkBtn}`} onClick={onClick}>
      {value}
    </button>
  ) : (
    <span ref={textRef} className={`${className} ${styles.cellEllipsis}`} tabIndex={0}>
      {value}
    </span>
  );

  if (!overflowed) return baseNode;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {baseNode}
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}

export default function ManageClientUsers({ initialItems = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(Array.isArray(initialItems) ? initialItems : []);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [watchTierFilter, setWatchTierFilter] = useState("all");
  const [sortMode, setSortMode] = useState("created_desc");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyUserLabel, setHistoryUserLabel] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const lastOpenedUserRef = useRef("");

  function cycleStatusFilter() {
    setStatusFilter((prev) => (prev === "all" ? "active" : prev === "active" ? "inactive" : "all"));
  }

  function toggleHeaderSort(modeA, modeB) {
    setSortMode((prev) => (prev === modeA ? modeB : modeA));
  }

  function sortMarker(modeA, modeB) {
    if (sortMode === modeA) return "↑";
    if (sortMode === modeB) return "↓";
    return "";
  }

  const activeCount = useMemo(() => items.filter((x) => x.is_active).length, [items]);
  const noActivityCount = useMemo(() => items.filter((x) => Number(x.watch_count || 0) <= 0).length, [items]);
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = items.filter((row) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "active" && row.is_active) ||
        (statusFilter === "inactive" && !row.is_active);
      if (!statusMatch) return false;

      const watchCount = Number(row.watch_count || 0);
      const totalWatch = Number(row.total_watch_seconds || 0);
      const hasActivity = watchCount > 0 || totalWatch > 0;

      if (activityFilter === "no_activity" && hasActivity) return false;
      if (activityFilter === "has_activity" && !hasActivity) return false;

      if (watchTierFilter === "heavy" && totalWatch < 1800) return false;
      if (watchTierFilter === "medium" && (totalWatch < 300 || totalWatch >= 1800)) return false;
      if (watchTierFilter === "light" && (totalWatch <= 0 || totalWatch >= 300)) return false;
      if (watchTierFilter === "zero" && totalWatch > 0) return false;

      if (!q) return true;
      const haystack = [
        String(row.email || ""),
        String(row.mobile_number || ""),
        String(row.full_name || ""),
        String(row.user_id || ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    const sorted = base.slice();
    const timeValue = (value) => {
      const t = value ? new Date(value).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };
    sorted.sort((a, b) => {
      if (sortMode === "name_asc") return String(a.full_name || "").localeCompare(String(b.full_name || ""));
      if (sortMode === "name_desc") return String(b.full_name || "").localeCompare(String(a.full_name || ""));
      if (sortMode === "mobile_asc") return String(a.mobile_number || "").localeCompare(String(b.mobile_number || ""));
      if (sortMode === "mobile_desc") return String(b.mobile_number || "").localeCompare(String(a.mobile_number || ""));
      if (sortMode === "most_watched") return Number(b.total_watch_seconds || 0) - Number(a.total_watch_seconds || 0);
      if (sortMode === "least_watched") return Number(a.total_watch_seconds || 0) - Number(b.total_watch_seconds || 0);
      if (sortMode === "most_views") return Number(b.watch_count || 0) - Number(a.watch_count || 0);
      if (sortMode === "least_views") return Number(a.watch_count || 0) - Number(b.watch_count || 0);
      if (sortMode === "recent_activity") return timeValue(b.last_watched_at) - timeValue(a.last_watched_at);
      if (sortMode === "long_inactive") return timeValue(a.last_watched_at) - timeValue(b.last_watched_at);
      if (sortMode === "created_asc") return timeValue(a.created_at) - timeValue(b.created_at);
      return timeValue(b.created_at) - timeValue(a.created_at);
    });
    return sorted;
  }, [items, searchTerm, statusFilter, activityFilter, watchTierFilter, sortMode]);

  function openEdit(row) {
    setError("");
    setMessage("");
    setEditForm({
      user_id: row.user_id,
      email: row.email || "",
      full_name: row.full_name || "",
      mobile_number: row.mobile_number || "",
      is_active: !!row.is_active,
      approval_status: String(row.approval_status || "approved"),
      approval_note: String(row.approval_note || ""),
      new_password: "",
      confirm_password: "",
    });
    setShowEditPassword(false);
    setEditOpen(true);
  }

  function openView(row) {
    setViewUser({
      ...row,
      facebook_profile_url: getFacebookProfileUrl(row),
      facebook_search_url: getFacebookSearchUrl(row),
    });
    setViewOpen(true);
  }

  function openUserFromId(userId) {
    const id = String(userId || "").trim();
    if (!id) return false;
    const target = items.find((row) => String(row?.user_id || "") === id);
    if (!target) return false;
    openView(target);
    return true;
  }

  useEffect(() => {
    const notificationUserId = String(searchParams?.get("openUser") || "").trim();
    if (!notificationUserId) return;
    if (lastOpenedUserRef.current === notificationUserId) return;
    if (!openUserFromId(notificationUserId)) return;

    lastOpenedUserRef.current = notificationUserId;
    const next = new URLSearchParams(searchParams?.toString() || "");
    next.delete("openUser");
    next.delete("openSource");
    next.delete("notif");
    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [items, pathname, router, searchParams]);

  useEffect(() => {
    const onOpenFromNotification = (event) => {
      const userId = String(event?.detail?.userId || "").trim();
      if (!userId) return;
      openUserFromId(userId);
    };

    window.addEventListener("admin-open-client-user", onOpenFromNotification);
    return () => {
      window.removeEventListener("admin-open-client-user", onOpenFromNotification);
    };
  }, [items]);

  async function openHistory(row) {
    setError("");
    setMessage("");
    setHistoryError("");
    setHistoryRows([]);
    setHistoryUserLabel(row.full_name || row.email || row.mobile_number || "Client user");
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const res = await fetch(`/api/admin/client-users/${row.user_id}/history`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to load history.");
      setHistoryRows(Array.isArray(payload?.items) ? payload.items : []);
    } catch (err) {
      setHistoryError(err?.message || "Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function createUser(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/client-users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create user.");
      const created = payload?.item || {};
      setItems((prev) => [
        {
          ...created,
          watch_count: Number(created.watch_count || 0),
          total_watch_seconds: Number(created.total_watch_seconds || 0),
          last_watched_at: String(created.last_watched_at || ""),
        },
        ...prev,
      ]);
      setForm(EMPTY_FORM);
      setShowPassword(false);
      setMessage("Client user created.");
      setCreateOpen(false);
    } catch (err) {
      setError(err?.message || "Failed to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editForm.user_id) return;
    const nextPassword = String(editForm.new_password || "");
    if (nextPassword && nextPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (nextPassword && nextPassword !== String(editForm.confirm_password || "")) {
      setError("Password and confirm password do not match.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/client-users/${editForm.user_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: editForm.email,
          full_name: editForm.full_name,
          mobile_number: editForm.mobile_number,
          is_active: editForm.is_active,
          ...(nextPassword ? { new_password: nextPassword } : {}),
          approval_status: editForm.approval_status,
          approval_note: editForm.approval_note,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update user.");
      setItems((prev) =>
        prev.map((row) =>
          row.user_id === editForm.user_id
            ? {
                ...row,
                email: editForm.email.trim() ? editForm.email.trim().toLowerCase() : row.email,
                full_name: editForm.full_name.trim(),
                mobile_number: editForm.mobile_number.trim(),
                is_active: editForm.is_active,
                approval_status: editForm.approval_status,
                approval_note: editForm.approval_note.trim(),
              }
            : row
        )
      );
      setShowEditPassword(false);
      setMessage("Client user updated.");
      setEditOpen(false);
    } catch (err) {
      setError(err?.message || "Failed to update user.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(userId, nextActive) {
    setBusyId(userId);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/client-users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update status.");
      setItems((prev) => prev.map((row) => (row.user_id === userId ? { ...row, is_active: nextActive } : row)));
    } catch (err) {
      setError(err?.message || "Failed to update status.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteInactiveUser(row) {
    if (!row || !row.user_id) return;
    if (row.is_active) {
      setError("Only inactive profiles can be deleted.");
      return;
    }
    const confirmed = window.confirm("Delete this inactive client profile permanently?");
    if (!confirmed) return;

    setBusyId(row.user_id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/client-users/${row.user_id}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to delete inactive user.");
      setItems((prev) => prev.filter((item) => item.user_id !== row.user_id));
      setMessage("Inactive client profile deleted.");
    } catch (err) {
      setError(err?.message || "Failed to delete inactive user.");
    } finally {
      setBusyId("");
    }
  }

  function formatWatchDuration(secondsValue) {
    const total = Number(secondsValue || 0);
    if (!Number.isFinite(total) || total <= 0) return "0s";
    const seconds = Math.floor(total);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remain = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${remain}s`;
    if (minutes > 0) return `${minutes}m ${remain}s`;
    return `${remain}s`;
  }

  return (
    <section className={styles.form}>
      <div className={styles.stats}>
        <article className={styles.statCard}>
          <p>Total Clients</p>
          <strong>{items.length}</strong>
        </article>
        <article className={styles.statCard}>
          <p>Active Clients</p>
          <strong>{activeCount}</strong>
        </article>
        <article className={styles.statCard}>
          <p>No Activity</p>
          <strong>{noActivityCount}</strong>
        </article>
      </div>

      <div className={styles.controlRowEnd}>
        <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" className={styles.primaryBtnCompact}>
              <Plus size={16} />
              <span>New Client</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create Client User</AlertDialogTitle>
              <AlertDialogDescription>
                Mobile number and password are required. Email and full name are optional.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <form onSubmit={createUser} className={styles.form}>
              <div className={styles.field}>
                <span>Email <em className={styles.optionalMark}>Optional</em></span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="client@example.com"
                />
                <small className={styles.fieldHint}>If provided, client can login by email or mobile.</small>
              </div>
              <div className={styles.field}>
                <span>Mobile Number <em className={styles.requiredMark}>*</em></span>
                <input
                  type="tel"
                  value={form.mobile_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                  placeholder="e.g. +8801XXXXXXXXX"
                  required
                />
                <small className={styles.fieldHint}>Must contain at least 11 digits. Last 11 digits can be used for login.</small>
              </div>
              <div className={styles.field}>
                <span>Full Name <em className={styles.optionalMark}>Optional</em></span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Optional"
                />
                <small className={styles.fieldHint}>Shown in dashboard and client profile context.</small>
              </div>
              <label className={styles.field}>
                <span>Initial Password <em className={styles.requiredMark}>*</em></span>
                <div className={styles.passwordWrap}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    minLength={8}
                    required
                  />
                  <Button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                <small className={styles.fieldHint}>Minimum 8 characters. Password can be updated later from edit modal.</small>
              </label>
              {error ? <p className={styles.errorText}>{error}</p> : null}
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline" className={styles.secondaryBtn}>Cancel</Button>
                </AlertDialogCancel>
                <Button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? "Creating..." : "Create Client"}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
        {message ? <p className={styles.successText}>{message}</p> : null}
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Search User</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by email, mobile, or full name"
          />
        </label>
        <label className={styles.field}>
          <span>Status Filter</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Activity Filter</span>
          <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
            <option value="all">All Activity States</option>
            <option value="has_activity">Has Activity</option>
            <option value="no_activity">No Activity</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Watch Tier</span>
          <select value={watchTierFilter} onChange={(e) => setWatchTierFilter(e.target.value)}>
            <option value="all">All Tiers</option>
            <option value="heavy">Heavy (30m+)</option>
            <option value="medium">Medium (5m-30m)</option>
            <option value="light">Light (&lt;5m)</option>
            <option value="zero">Zero Watch</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Sort By</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="created_desc">Newest Created</option>
            <option value="created_asc">Oldest Created</option>
            <option value="name_asc">Name A-Z</option>
            <option value="name_desc">Name Z-A</option>
            <option value="mobile_asc">Mobile A-Z</option>
            <option value="mobile_desc">Mobile Z-A</option>
            <option value="most_watched">Most Watched Time</option>
            <option value="least_watched">Least Watched Time</option>
            <option value="most_views">Most Views</option>
            <option value="least_views">Least Views</option>
            <option value="recent_activity">Recently Active</option>
            <option value="long_inactive">Longest Inactive</option>
          </select>
        </label>
      </div>

      <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
        <AlertDialogContent className={styles.clientModal}>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Client User</AlertDialogTitle>
            <AlertDialogDescription>
              Update account details and access status for this client.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form onSubmit={saveEdit} className={styles.form}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <span>Email <em className={styles.optionalMark}>Optional</em></span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="client@example.com"
                />
              </div>
              <div className={styles.field}>
                <span>Mobile Number <em className={styles.optionalMark}>Optional</em></span>
                <input
                  type="tel"
                  value={editForm.mobile_number}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                  placeholder="e.g. +8801XXXXXXXXX"
                />
                <small className={styles.fieldHint}>Keep empty if Facebook profile does not provide a phone number.</small>
              </div>
              <div className={styles.field}>
                <span>Full Name</span>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <label className={styles.field}>
                <span>Approval Status</span>
                <select
                  value={editForm.approval_status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, approval_status: e.target.value }))}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className={`${styles.field} ${styles.full}`}>
                <span>Approval Note</span>
                <input
                  type="text"
                  value={editForm.approval_note}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, approval_note: e.target.value }))}
                  placeholder="Optional reviewer note"
                />
              </label>
              <label className={styles.field}>
                <span>New Password <em className={styles.optionalMark}>Optional</em></span>
                <div className={styles.passwordWrap}>
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editForm.new_password}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, new_password: e.target.value }))}
                    minLength={8}
                    placeholder="Leave blank to keep current password"
                  />
                  <Button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowEditPassword((prev) => !prev)}
                    aria-label={showEditPassword ? "Hide password" : "Show password"}
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                <small className={styles.fieldHint}>Minimum 8 characters if you want to change password.</small>
              </label>
              <div className={styles.field}>
                <span>Confirm New Password <em className={styles.optionalMark}>Optional</em></span>
                <input
                  type={showEditPassword ? "text" : "password"}
                  value={editForm.confirm_password}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                  minLength={8}
                  placeholder="Repeat new password"
                />
              </div>
            </div>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(e) => setEditForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              <span>Active account</span>
            </label>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline" className={`${styles.secondaryBtn} ${styles.modalActionBtn}`}>Cancel</Button>
              </AlertDialogCancel>
              <Button type="submit" className={`${styles.primaryBtn} ${styles.modalActionBtn}`} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={viewOpen} onOpenChange={setViewOpen}>
        <AlertDialogContent className={styles.clientModal}>
          <AlertDialogHeader>
            <AlertDialogTitle>Client Details</AlertDialogTitle>
            <AlertDialogDescription>
              Review this user info, then click Edit to update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <span>Full Name</span>
              <p className={styles.metaLine}>{viewUser?.full_name || "-"}</p>
            </div>
            <div className={styles.field}>
              <span>Mobile</span>
              <p className={styles.metaLine}>{viewUser?.mobile_number || "-"}</p>
            </div>
            <div className={styles.field}>
              <span>Email</span>
              <p className={styles.metaLine}>{viewUser?.email || "-"}</p>
            </div>
            <div className={styles.field}>
              <span>Status</span>
              <p className={styles.metaLine}>{viewUser?.is_active ? "Active" : "Inactive"}</p>
            </div>
            <div className={styles.field}>
              <span>Approval</span>
              <p className={styles.metaLine}>{String(viewUser?.approval_status || "approved")}</p>
            </div>
            <div className={styles.field}>
              <span>Provider</span>
              <p className={styles.metaLine}>{String(viewUser?.auth_provider || "password")}</p>
            </div>
            <div className={styles.field}>
              <span>Provider User ID</span>
              <p className={styles.metaLine}>{viewUser?.provider_user_id || "-"}</p>
            </div>
            <div className={styles.field}>
              <span>Facebook Profile</span>
              {viewUser?.facebook_profile_url ? (
                <a
                  href={viewUser.facebook_profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  Visit Facebook Profile
                </a>
              ) : viewUser?.facebook_search_url ? (
                <a
                  href={viewUser.facebook_search_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  Search on Facebook
                </a>
              ) : (
                <p className={styles.metaLine}>-</p>
              )}
            </div>
            <div className={styles.field}>
              <span>Views</span>
              <p className={styles.metaLine}>{Number(viewUser?.watch_count || 0)}</p>
            </div>
            <div className={styles.field}>
              <span>Watch Time</span>
              <p className={styles.metaLine}>{formatWatchDuration(viewUser?.total_watch_seconds)}</p>
            </div>
            <div className={styles.field}>
              <span>Last Activity</span>
              <p className={styles.metaLine}>
                {viewUser?.last_watched_at ? new Date(viewUser.last_watched_at).toLocaleString() : "No activity"}
              </p>
            </div>
            <div className={styles.field}>
              <span>Created</span>
              <p className={styles.metaLine}>{viewUser?.created_at ? new Date(viewUser.created_at).toLocaleString() : "-"}</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" className={`${styles.secondaryBtn} ${styles.modalActionBtn}`}>Close</Button>
            </AlertDialogCancel>
            <Button
              type="button"
              className={`${styles.primaryBtn} ${styles.modalActionBtn} ${styles.modalEditBtn}`}
              onClick={() => {
                if (viewUser) openEdit(viewUser);
                setViewOpen(false);
              }}
            >
              <Pencil size={14} />
              <span>Edit</span>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <AlertDialogContent className={styles.historyModal}>
          <AlertDialogHeader>
            <AlertDialogTitle>Watch History</AlertDialogTitle>
            <AlertDialogDescription>
              Latest 50 viewed channels for {historyUserLabel}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {historyError ? <p className={styles.errorText}>{historyError}</p> : null}
          {historyLoading ? <p className={styles.pending}>Loading history...</p> : null}
          {!historyLoading ? (
            <div className={`${styles.tableWrap} ${styles.historyTableWrap}`}>
              <table>
                <thead>
                  <tr>
                    <th>Seen At</th>
                    <th>Channel</th>
                    <th>Watch Time</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.watched_at ? new Date(row.watched_at).toLocaleString() : "-"}</td>
                      <td>{row.channel_name || row.channel_id || "-"}</td>
                      <td>{formatWatchDuration(row.watch_seconds)}</td>
                    </tr>
                  ))}
                  {!historyRows.length ? (
                    <tr>
                      <td colSpan={3} className={styles.pending}>No history yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" className={styles.secondaryBtn}>Close</Button>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TooltipProvider delayDuration={120}>
        <div className={styles.tableWrap}>
          <Table className={styles.clientUsersTable}>
            <TableHeader>
              <TableRow>
                <TableHead className={styles.colClientName}>
                  <button type="button" className={styles.rowLinkBtn} onClick={() => toggleHeaderSort("name_asc", "name_desc")}>
                    Full Name {sortMarker("name_asc", "name_desc")}
                  </button>
                </TableHead>
                <TableHead className={styles.colClientMobile}>
                  <button type="button" className={styles.rowLinkBtn} onClick={() => toggleHeaderSort("mobile_asc", "mobile_desc")}>
                    Mobile {sortMarker("mobile_asc", "mobile_desc")}
                  </button>
                </TableHead>
                <TableHead className={styles.colClientStatus}>
                  <button type="button" className={styles.rowLinkBtn} onClick={cycleStatusFilter}>
                    Status {statusFilter === "active" ? "(A)" : statusFilter === "inactive" ? "(I)" : "(All)"}
                  </button>
                </TableHead>
                <TableHead className={styles.colClientStatus}>Approval</TableHead>
                <TableHead className={styles.colClientViews}>
                  <button type="button" className={styles.rowLinkBtn} onClick={() => toggleHeaderSort("most_views", "least_views")}>
                    Views {sortMarker("most_views", "least_views")}
                  </button>
                </TableHead>
                <TableHead className={styles.colClientWatch}>
                  <button type="button" className={styles.rowLinkBtn} onClick={() => toggleHeaderSort("most_watched", "least_watched")}>
                    Watch Time {sortMarker("most_watched", "least_watched")}
                  </button>
                </TableHead>
                <TableHead className={styles.colClientLast}>
                  <button type="button" className={styles.rowLinkBtn} onClick={() => toggleHeaderSort("recent_activity", "long_inactive")}>
                    Last Activity {sortMarker("recent_activity", "long_inactive")}
                  </button>
                </TableHead>
                <TableHead className={styles.colClientCreated}>
                  <button type="button" className={styles.rowLinkBtn} onClick={() => toggleHeaderSort("created_desc", "created_asc")}>
                    Created {sortMarker("created_desc", "created_asc")}
                  </button>
                </TableHead>
                <TableHead className={styles.colClientActions}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell className={styles.colClientName}>
                    <TruncatedTooltipCell text={row.full_name || "-"} asButton onClick={() => openView(row)} />
                  </TableCell>
                  <TableCell className={styles.colClientMobile}>
                    <TruncatedTooltipCell text={row.mobile_number || "-"} />
                  </TableCell>
                  <TableCell className={styles.colClientStatus}>
                    <TruncatedTooltipCell text={row.is_active ? "Active" : "Inactive"} />
                  </TableCell>
                  <TableCell className={styles.colClientStatus}>
                    <TruncatedTooltipCell text={String(row.approval_status || "approved")} />
                  </TableCell>
                  <TableCell className={styles.colClientViews}>
                    <TruncatedTooltipCell text={Number(row.watch_count || 0)} />
                  </TableCell>
                  <TableCell className={styles.colClientWatch}>
                    <TruncatedTooltipCell text={formatWatchDuration(row.total_watch_seconds)} />
                  </TableCell>
                  <TableCell className={styles.colClientLast}>
                    <TruncatedTooltipCell text={row.last_watched_at ? new Date(row.last_watched_at).toLocaleString() : "No activity"} />
                  </TableCell>
                  <TableCell className={styles.colClientCreated}>
                    <TruncatedTooltipCell text={row.created_at ? new Date(row.created_at).toLocaleString() : "-"} />
                  </TableCell>
                  <TableCell className={styles.colClientActions}>
                    <div className={styles.clientActionsRow}>
                      <Button
                        type="button"
                        variant="outline"
                        className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                        disabled={busyId === row.user_id}
                        onClick={() => toggleActive(row.user_id, !row.is_active)}
                        title={row.is_active ? "Deactivate user" : "Activate user"}
                        aria-label={row.is_active ? "Deactivate user" : "Activate user"}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>{row.is_active ? <EyeOff size={14} /> : <Eye size={14} />}</span>
                          </TooltipTrigger>
                          <TooltipContent>{row.is_active ? "Deactivate user" : "Activate user"}</TooltipContent>
                        </Tooltip>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={`${styles.secondaryBtn} ${styles.clientActionBtn}`}
                        disabled={busyId === row.user_id}
                        onClick={() => openHistory(row)}
                        aria-label="View history"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><History size={14} /></span>
                          </TooltipTrigger>
                          <TooltipContent>View history</TooltipContent>
                        </Tooltip>
                      </Button>
                      {!row.is_active ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={`${styles.secondaryBtn} ${styles.clientActionBtn} ${styles.clientActionDanger}`}
                          disabled={busyId === row.user_id}
                          onClick={() => deleteInactiveUser(row)}
                          aria-label="Delete inactive profile"
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span><Trash2 size={14} /></span>
                            </TooltipTrigger>
                            <TooltipContent>Delete inactive profile</TooltipContent>
                          </Tooltip>
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!filteredItems.length ? (
              <TableRow>
                <TableCell colSpan={9} className={styles.pending}>No users found for this filter.</TableCell>
              </TableRow>
            ) : null}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>
    </section>
  );
}
