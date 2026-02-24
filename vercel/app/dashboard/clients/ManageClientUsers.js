"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, History, Pencil, Plus } from "lucide-react";
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
  new_password: "",
  confirm_password: "",
};

export default function ManageClientUsers({ initialItems = [] }) {
  const [items, setItems] = useState(Array.isArray(initialItems) ? initialItems : []);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const activeCount = useMemo(() => items.filter((x) => x.is_active).length, [items]);
  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((row) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "active" && row.is_active) ||
        (statusFilter === "inactive" && !row.is_active);
      if (!statusMatch) return false;

      if (!q) return true;
      const haystack = [
        String(row.email || ""),
        String(row.mobile_number || ""),
        String(row.full_name || ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, searchTerm, statusFilter]);

  function openEdit(row) {
    setError("");
    setMessage("");
    setEditForm({
      user_id: row.user_id,
      email: row.email || "",
      full_name: row.full_name || "",
      mobile_number: row.mobile_number || "",
      is_active: !!row.is_active,
      new_password: "",
      confirm_password: "",
    });
    setShowEditPassword(false);
    setEditOpen(true);
  }

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
      setItems((prev) => [payload.item, ...prev]);
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
      </div>

      <div className={styles.controlRowEnd}>
        <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
          <AlertDialogTrigger asChild>
            <button type="button" className={styles.primaryBtnCompact}>
              <Plus size={16} />
              <span>New Client</span>
            </button>
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
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <small className={styles.fieldHint}>Minimum 8 characters. Password can be updated later from edit modal.</small>
              </label>
              {error ? <p className={styles.errorText}>{error}</p> : null}
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <button type="button" className={styles.secondaryBtn}>Cancel</button>
                </AlertDialogCancel>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? "Creating..." : "Create Client"}
                </button>
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
      </div>

      <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Client User</AlertDialogTitle>
            <AlertDialogDescription>
              Update account details and access status for this client.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form onSubmit={saveEdit} className={styles.form}>
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
              <span>Mobile Number <em className={styles.requiredMark}>*</em></span>
              <input
                type="tel"
                value={editForm.mobile_number}
                onChange={(e) => setEditForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                placeholder="e.g. +8801XXXXXXXXX"
                required
              />
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
              <span>New Password <em className={styles.optionalMark}>Optional</em></span>
              <div className={styles.passwordWrap}>
                <input
                  type={showEditPassword ? "text" : "password"}
                  value={editForm.new_password}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, new_password: e.target.value }))}
                  minLength={8}
                  placeholder="Leave blank to keep current password"
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowEditPassword((prev) => !prev)}
                  aria-label={showEditPassword ? "Hide password" : "Show password"}
                >
                  {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
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
                <button type="button" className={styles.secondaryBtn}>Cancel</button>
              </AlertDialogCancel>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Watch History</AlertDialogTitle>
            <AlertDialogDescription>
              Latest 50 viewed channels for {historyUserLabel}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {historyError ? <p className={styles.errorText}>{historyError}</p> : null}
          {historyLoading ? <p className={styles.pending}>Loading history...</p> : null}
          {!historyLoading ? (
            <div className={styles.tableWrap}>
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
              <button type="button" className={styles.secondaryBtn}>Close</button>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Mobile</th>
              <th>Full Name</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((row) => (
              <tr key={row.user_id}>
                <td>{row.email}</td>
                <td>{row.mobile_number || "-"}</td>
                <td>{row.full_name || "-"}</td>
                <td>{row.is_active ? "Active" : "Inactive"}</td>
                <td>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                <td>
                  <div className={styles.controlRow}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={busyId === row.user_id}
                      onClick={() => openEdit(row)}
                    >
                      <Pencil size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={busyId === row.user_id}
                      onClick={() => toggleActive(row.user_id, !row.is_active)}
                    >
                      {row.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={busyId === row.user_id}
                      onClick={() => openHistory(row)}
                    >
                      <History size={14} />
                      <span>History</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredItems.length ? (
              <tr>
                <td colSpan={6} className={styles.pending}>No users found for this filter.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
