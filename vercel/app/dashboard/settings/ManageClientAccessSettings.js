"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Save, ShieldCheck, Smartphone } from "lucide-react";
import styles from "../page.module.css";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../components/i18n/LanguageProvider";

const DEFAULT_FORM = {
  facebook_first_login_requires_admin_approval: true,
};

export default function ManageClientAccessSettings() {
  const { t } = useI18n();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/client-access-settings", { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || t("settings.failedLoadClientAccessSettings"));
        if (!active) return;
        setForm((prev) => ({ ...prev, ...(payload || {}) }));
      } catch (err) {
        if (!active) return;
        setError(err?.message || t("settings.failedLoadClientAccessSettings"));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t]);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/client-access-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          facebook_first_login_requires_admin_approval: !!form.facebook_first_login_requires_admin_approval,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("settings.failedSaveClientAccessSettings"));
      setForm((prev) => ({ ...prev, ...(payload?.settings || {}) }));
      setMessage(t("settings.clientAccessSettingsSaved"));
    } catch (err) {
      setError(err?.message || t("settings.failedSaveClientAccessSettings"));
    } finally {
      setSaving(false);
    }
  }

  const approvalEnabled = !!form.facebook_first_login_requires_admin_approval;

  return (
    <section className={`${styles.form} ${styles.settingsLayout}`}>
      <div className={`${styles.stats} ${styles.statsCompact3} ${styles.settingsStatusGrid}`}>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><ShieldCheck size={14} /><span>Facebook Signup</span></p>
          <strong>{approvalEnabled ? "Manual Review" : "Instant Access"}</strong>
          <span className={styles.metaMuted}>{approvalEnabled ? "Admin approval after mobile submit" : "Auto activation after mobile submit"}</span>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><Smartphone size={14} /><span>First Step</span></p>
          <strong>Mobile Number</strong>
          <span className={styles.metaMuted}>Required on the first Facebook login</span>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><CheckCircle2 size={14} /><span>Login Result</span></p>
          <strong>{approvalEnabled ? "Pending Until Review" : "Auto Login Continues"}</strong>
          <span className={styles.metaMuted}>{approvalEnabled ? "Playback stays locked" : "User enters the site immediately"}</span>
        </article>
      </div>

      <div className={`${styles.controlRowEnd} ${styles.settingsActionBar}`}>
        <div className={styles.controlRow}>
          <Button type="button" className={styles.primaryBtn} disabled={loading || saving} onClick={saveSettings}>
            <Save size={16} />
            <span>{saving ? t("settings.saving") : t("settings.saveClientAccessSettings")}</span>
          </Button>
        </div>
        {message ? <p className={styles.successText}>{message}</p> : null}
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><ShieldCheck size={17} /> Facebook First Login Flow</h3>
          <p className={styles.settingsPanelHint}>
            Control whether a Facebook user becomes active immediately after submitting a mobile number, or waits for admin review.
          </p>
        </header>

        <div className={styles.formGrid}>
          <label className={`${styles.checkRow} ${styles.settingsToggleRow} ${styles.full}`}>
            <input
              type="checkbox"
              checked={approvalEnabled}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  facebook_first_login_requires_admin_approval: e.target.checked,
                }))
              }
            />
            <span>Require admin approval after the first Facebook mobile-number submission</span>
          </label>

          <div className={`${styles.settingsHintTile} ${styles.full}`}>
            <p className={styles.settingsHintTitle}>How it works</p>
            <p className={styles.settingsHintText}>
              When this option is on, Facebook users submit their mobile number and stay pending until an admin approves them.
              When this option is off, the same submit action marks the account approved instantly and the user continues into the site without extra review.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
