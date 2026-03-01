"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Plus, RefreshCw, Save, ShieldUser, Trash2, UserRoundCog, Users } from "lucide-react";
import styles from "../page.module.css";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../components/i18n/LanguageProvider";
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

const ROLE_SUPER = "super_admin";
const ROLE_ADMIN = "admin";

function formatDate(value) {
  if (!value) return "—";
  const ts = Date.parse(String(value));
  if (!Number.isFinite(ts)) return "—";
  return new Date(ts).toLocaleString();
}

export default function ManageAdminUsers() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [currentAdminUserId, setCurrentAdminUserId] = useState("");
  const [currentAdminRole, setCurrentAdminRole] = useState(ROLE_ADMIN);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    is_active: true,
    role: ROLE_ADMIN,
    new_password: "",
    confirm_password: "",
  });
  const [createForm, setCreateForm] = useState({
    email: "",
    full_name: "",
    password: "",
    confirm_password: "",
    role: ROLE_ADMIN,
  });

  const selected = useMemo(() => items.find((x) => x.user_id === selectedId) || null, [items, selectedId]);
  const activeCount = useMemo(() => items.filter((x) => x.is_active).length, [items]);
  const superCount = useMemo(() => items.filter((x) => x.role === ROLE_SUPER).length, [items]);
  const canManageRole = currentAdminRole === ROLE_SUPER;

  async function loadAdmins(preserveSelected = true) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/admin-users", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("settings.failedLoadAdmins"));

      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      const nextCurrent = String(payload?.current_admin_user_id || "");
      const nextCurrentRole = String(payload?.current_admin_role || ROLE_ADMIN).trim().toLowerCase();
      setItems(nextItems);
      setCurrentAdminUserId(nextCurrent);
      setCurrentAdminRole(nextCurrentRole === ROLE_SUPER ? ROLE_SUPER : ROLE_ADMIN);

      const fallbackId = nextItems[0]?.user_id || "";
      const nextSelected = preserveSelected && selectedId && nextItems.some((x) => x.user_id === selectedId)
        ? selectedId
        : fallbackId;
      setSelectedId(nextSelected);
    } catch (err) {
      setError(err?.message || t("settings.failedLoadAdmins"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setForm({ email: "", full_name: "", is_active: true, role: ROLE_ADMIN, new_password: "", confirm_password: "" });
      return;
    }
    setForm({
      email: String(selected.email || ""),
      full_name: String(selected.full_name || ""),
      is_active: selected.is_active !== false,
      role: String(selected.role || ROLE_ADMIN).trim().toLowerCase() === ROLE_SUPER ? ROLE_SUPER : ROLE_ADMIN,
      new_password: "",
      confirm_password: "",
    });
  }, [selected]);

  function handleSelect(userId) {
    setSelectedId(userId);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const email = String(form.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) throw new Error(t("settings.validEmailRequired"));

      const fullName = String(form.full_name || "").trim();
      const newPassword = String(form.new_password || "");
      const confirmPassword = String(form.confirm_password || "");
      if (newPassword || confirmPassword) {
        if (newPassword.length < 8) throw new Error(t("settings.passwordMin"));
        if (newPassword !== confirmPassword) throw new Error(t("settings.passwordMismatch"));
      }

      const body = {};
      if (email !== String(selected.email || "").trim().toLowerCase()) body.email = email;
      if (fullName !== String(selected.full_name || "").trim()) body.full_name = fullName;
      if (!!form.is_active !== (selected.is_active !== false)) body.is_active = !!form.is_active;
      if (canManageRole && form.role !== String(selected.role || ROLE_ADMIN)) body.role = form.role;
      if (newPassword) body.new_password = newPassword;
      if (!Object.keys(body).length) {
        setMessage(t("settings.noChanges"));
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/admin/admin-users/${encodeURIComponent(selected.user_id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("settings.failedSaveAdmins"));

      setMessage(t("settings.adminInfoUpdated"));
      setEditOpen(false);
      await loadAdmins(true);
    } catch (err) {
      setError(err?.message || t("settings.failedSaveAdmins"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selected) return;
    if (!window.confirm(`${t("settings.deleteConfirmPrefix")} "${selected.email}"? ${t("settings.deleteConfirmSuffix")}`)) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/admin-users/${encodeURIComponent(selected.user_id)}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("settings.failedDeleteAdmin"));
      setMessage(t("settings.adminDeleted"));
      setSelectedId("");
      await loadAdmins(false);
    } catch (err) {
      setError(err?.message || t("settings.failedDeleteAdmin"));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAdmin() {
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const email = String(createForm.email || "").trim().toLowerCase();
      const fullName = String(createForm.full_name || "").trim();
      const password = String(createForm.password || "");
      const confirmPassword = String(createForm.confirm_password || "");
      const role = createForm.role === ROLE_SUPER ? ROLE_SUPER : ROLE_ADMIN;
      if (!email || !email.includes("@")) throw new Error(t("settings.validAdminEmailRequired"));
      if (password.length < 8) throw new Error(t("settings.adminPasswordMin"));
      if (password !== confirmPassword) throw new Error(t("settings.passwordMismatch"));
      const res = await fetch("/api/admin/admin-users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          full_name: fullName,
          password,
          role,
          is_active: true,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("settings.createAdminFail"));
      setMessage(t("settings.createAdminSuccess"));
      setCreateForm({ email: "", full_name: "", password: "", confirm_password: "", role: ROLE_ADMIN });
      setShowCreatePassword(false);
      setShowCreateConfirmPassword(false);
      setCreateOpen(false);
      await loadAdmins(false);
      if (payload?.user_id) handleSelect(String(payload.user_id));
    } catch (err) {
      setError(err?.message || t("settings.createAdminFail"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className={`${styles.form} ${styles.settingsLayout}`}>
      <div className={`${styles.stats} ${styles.statsCompact4} ${styles.settingsStatusGrid}`}>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><ShieldUser size={14} /><span>{t("settings.totalAdmins")}</span></p>
          <strong>{items.length}</strong>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><Users size={14} /><span>{t("settings.activeAdmins")}</span></p>
          <strong>{activeCount}</strong>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><ShieldUser size={14} /><span>{t("settings.superAdmins")}</span></p>
          <strong>{superCount}</strong>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><UserRoundCog size={14} /><span>{t("common.currentSession")}</span></p>
          <strong>{currentAdminUserId ? t("common.authenticated") : t("common.unknown")}</strong>
        </article>
      </div>

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><ShieldUser size={17} /> {t("settings.adminList")}</h3>
          <p className={styles.settingsPanelHint}>{t("settings.adminListHint")}</p>
        </header>
        <div className={`${styles.controlRowEnd} ${styles.adminListActions}`}>
          <Button type="button" variant="outline" className={styles.secondaryBtnCompact} disabled={loading} onClick={() => loadAdmins(true)}>
            <RefreshCw size={15} />
            <span>{loading ? t("common.loading") : t("common.refresh")}</span>
          </Button>
          <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" className={styles.primaryBtnCompact} disabled={!canManageRole} title={!canManageRole ? t("settings.createAdminOnlySuper") : ""}>
                <Plus size={15} />
                <span>{t("settings.createAdmin")}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className={styles.adminCreateModal}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.createAdminTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("settings.createAdminDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>{t("common.email")}</span>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="new-admin@example.com"
                    disabled={!canManageRole || creating}
                  />
                </label>

                <label className={styles.field}>
                  <span>{t("common.fullName")}</span>
                  <input
                    type="text"
                    value={createForm.full_name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Admin name"
                    disabled={!canManageRole || creating}
                  />
                </label>

                <label className={styles.field}>
                  <span>{t("common.role")}</span>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value === ROLE_SUPER ? ROLE_SUPER : ROLE_ADMIN }))}
                    disabled={!canManageRole || creating}
                  >
                    <option value={ROLE_ADMIN}>{t("settings.admin")}</option>
                    <option value={ROLE_SUPER}>{t("settings.superAdmin")}</option>
                  </select>
                </label>

                <label className={`${styles.field} ${styles.full}`}>
                  <span>{t("settings.password")}</span>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showCreatePassword ? "text" : "password"}
                      value={createForm.password}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder={t("settings.minimum8")}
                      minLength={8}
                      autoComplete="new-password"
                      disabled={!canManageRole || creating}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowCreatePassword((x) => !x)}
                      aria-label={showCreatePassword ? t("settings.hidePassword") : t("settings.showPassword")}
                    >
                      {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                <label className={`${styles.field} ${styles.full}`}>
                  <span>{t("settings.confirmPassword")}</span>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showCreateConfirmPassword ? "text" : "password"}
                      value={createForm.confirm_password}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                      placeholder={t("settings.repeatPassword")}
                      minLength={8}
                      autoComplete="new-password"
                      disabled={!canManageRole || creating}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowCreateConfirmPassword((x) => !x)}
                      aria-label={showCreateConfirmPassword ? t("settings.hideConfirmPassword") : t("settings.showConfirmPassword")}
                    >
                      {showCreateConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel className={styles.secondaryBtnCompact} disabled={creating}>{t("common.cancel")}</AlertDialogCancel>
                <Button type="button" className={styles.primaryBtnCompact} disabled={creating || !canManageRole} onClick={handleCreateAdmin}>
                  <Plus size={15} />
                  <span>{creating ? t("settings.creating") : t("settings.createAdmin")}</span>
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {message ? <p className={styles.successText}>{message}</p> : null}
        </div>
        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={`${styles.tableWrap} ${styles.adminUsersDesktopTable}`}>
          <table className={styles.adminUsersTable}>
            <thead>
              <tr>
                <th>{t("common.email")}</th>
                <th>{t("common.fullName")}</th>
                <th>{t("common.role")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.lastSignIn")}</th>
                <th>{t("common.action")}</th>
              </tr>
            </thead>
            <tbody>
              {!items.length ? (
                <tr>
                  <td colSpan={6}>{t("settings.noRows")}</td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.user_id} className={row.user_id === selectedId ? styles.adminRowActive : undefined}>
                    <td>{row.email || "—"}</td>
                    <td>{row.full_name || "—"}</td>
                    <td>
                      <span className={row.role === ROLE_SUPER ? styles.badgeInfo : styles.badgeMuted}>
                        {row.role === ROLE_SUPER ? t("settings.superAdmin") : t("settings.admin")}
                      </span>
                    </td>
                    <td>
                      <span className={row.is_active ? styles.badgeLive : styles.badgeMuted}>
                        {row.is_active ? t("common.active") : t("common.inactive")}
                      </span>
                    </td>
                    <td>{formatDate(row.last_sign_in_at)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.secondaryBtnCompact}
                        onClick={() => handleSelect(row.user_id)}
                      >
                        {t("settings.manage")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.adminUsersMobileList}>
          {!items.length ? (
            <div className={styles.adminUserMobileCard}>
              <p className={styles.hint} style={{ margin: 0 }}>{t("settings.noRows")}</p>
            </div>
          ) : (
            items.map((row) => (
              <article key={`m-${row.user_id}`} className={styles.adminUserMobileCard}>
                <div className={styles.adminUserMobileHead}>
                  <strong className={styles.adminUserMobileEmail}>{row.email || "—"}</strong>
                  <span className={row.role === ROLE_SUPER ? styles.badgeInfo : styles.badgeMuted}>
                    {row.role === ROLE_SUPER ? t("settings.superAdmin") : t("settings.admin")}
                  </span>
                </div>
                <div className={styles.adminUserMobileGrid}>
                  <p><span>{t("common.status")}</span><strong>{row.is_active ? t("common.active") : t("common.inactive")}</strong></p>
                  <p><span>{t("common.fullName")}</span><strong>{row.full_name || "—"}</strong></p>
                  <p><span>{t("common.lastSignIn")}</span><strong>{formatDate(row.last_sign_in_at)}</strong></p>
                </div>
                <button
                  type="button"
                  className={styles.secondaryBtnCompact}
                  onClick={() => handleSelect(row.user_id)}
                >
                  {t("settings.manage")}
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
        <AlertDialogContent className={styles.adminCreateModal}>
          <AlertDialogHeader>
            <AlertDialogTitle><KeyRound size={16} style={{ marginRight: 6 }} />{t("settings.manageAdmin")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.selectedAdmin")} {selected?.email || t("settings.notSelected")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!selected ? (
            <p className={styles.hint}>{t("settings.selectAdminHint")}</p>
          ) : (
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>{t("common.email")}</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@example.com"
                />
              </label>

              <label className={styles.field}>
                <span>{t("common.fullName")}</span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Admin name"
                />
              </label>

              <label className={`${styles.checkRow} ${styles.settingsToggleRow}`}>
                <input
                  type="checkbox"
                  checked={!!form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  disabled={selected.user_id === currentAdminUserId || selected.role === ROLE_SUPER}
                />
                <span>
                  {t("settings.activeAdminLabel")}
                  {selected.user_id === currentAdminUserId ? t("settings.cannotDeactivateCurrent") : ""}
                  {selected.role === ROLE_SUPER ? t("settings.cannotDeactivateSuper") : ""}
                </span>
              </label>

              <label className={styles.field}>
                <span>{t("common.role")}</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value === ROLE_SUPER ? ROLE_SUPER : ROLE_ADMIN }))}
                  disabled={!canManageRole}
                >
                  <option value={ROLE_ADMIN}>{t("settings.admin")}</option>
                  <option value={ROLE_SUPER}>{t("settings.superAdmin")}</option>
                </select>
                {!canManageRole ? <small className={styles.fieldHint}>{t("settings.onlySuperCanChangeRole")}</small> : null}
              </label>

              <label className={styles.field}>
                <span>{t("settings.newPasswordOptional")}</span>
                <input
                  type="password"
                  minLength={8}
                  value={form.new_password}
                  onChange={(e) => setForm((prev) => ({ ...prev, new_password: e.target.value }))}
                  placeholder={t("settings.minimum8")}
                  autoComplete="new-password"
                />
              </label>

              <label className={styles.field}>
                <span>{t("settings.repeatNewPassword")}</span>
                <input
                  type="password"
                  minLength={8}
                  value={form.confirm_password}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                  placeholder={t("settings.repeatNewPassword")}
                  autoComplete="new-password"
                />
              </label>

              <div className={`${styles.settingsHintTile} ${styles.full}`}>
                <p className={styles.settingsHintTitle}>{t("settings.accountInfo")}</p>
                <p className={styles.settingsHintText}>
                  {t("settings.created")}: {formatDate(selected.created_at)} | {t("settings.confirmed")}: {formatDate(selected.email_confirmed_at)}
                </p>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className={styles.secondaryBtnCompact} disabled={saving}>{t("common.close")}</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              className={styles.secondaryBtnCompact}
              onClick={handleDeleteSelected}
              disabled={
                saving ||
                !canManageRole ||
                !selected ||
                selected.user_id === currentAdminUserId ||
                selected.role === ROLE_SUPER ||
                selected.is_active
              }
              title={
                selected?.role === ROLE_SUPER
                  ? t("settings.cannotDeleteSuper")
                  : selected?.is_active
                    ? t("settings.deactivateBeforeDelete")
                    : t("settings.deleteSelected")
              }
            >
              <Trash2 size={15} />
              <span>{t("settings.deleteAdmin")}</span>
            </Button>
            <Button type="button" className={styles.primaryBtnCompact} onClick={handleSave} disabled={saving || !selected}>
              <Save size={16} />
              <span>{saving ? t("settings.saving") : t("settings.saveChanges")}</span>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
