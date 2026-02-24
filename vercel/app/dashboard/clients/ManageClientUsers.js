"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";
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
};

export default function ManageClientUsers({ initialItems = [] }) {
  const [items, setItems] = useState(Array.isArray(initialItems) ? initialItems : []);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const activeCount = useMemo(() => items.filter((x) => x.is_active).length, [items]);

  function openEdit(row) {
    setError("");
    setMessage("");
    setEditForm({
      user_id: row.user_id,
      email: row.email || "",
      full_name: row.full_name || "",
      mobile_number: row.mobile_number || "",
      is_active: !!row.is_active,
    });
    setEditOpen(true);
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

  async function resetPassword(userId) {
    const nextPassword = window.prompt("Enter new password (min 8 chars):", "");
    if (!nextPassword) return;

    setBusyId(userId);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/client-users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ new_password: nextPassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to reset password.");
      setMessage("Password updated.");
    } catch (err) {
      setError(err?.message || "Failed to reset password.");
    } finally {
      setBusyId("");
    }
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
                <small className={styles.fieldHint}>Minimum 8 characters. Client can change later by admin reset.</small>
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
            {items.map((row) => (
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
                      onClick={() => resetPassword(row.user_id)}
                    >
                      Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
