"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, MailCheck, Palette, Save, Send, Server, TestTube2 } from "lucide-react";
import styles from "../page.module.css";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../components/i18n/LanguageProvider";

const DEFAULT_FORM = {
  welcome_auto_send: true,
  smtp_host: "",
  smtp_port: 587,
  smtp_secure: false,
  smtp_user: "",
  smtp_pass: "",
  smtp_pass_set: false,
  from_name: "WEBTVBD Support",
  from_email: "",
  reply_to: "",
  brand_name: "WEBTVBD",
  site_url: "",
  logo_url: "",
  welcome_subject: "Your WEBTVBD account has been approved",
  welcome_message: "Welcome to WEBTVBD. Your account is now active and ready to use.",
  approval_request_auto_send: true,
  approval_request_recipient: "",
  approval_request_subject: "New approval request from {{full_name}}",
  approval_request_message:
    "A client has submitted an approval request. Please review the details below and take action from the dashboard.",
  test_recipient: "",
};

export default function ManageEmailSettings() {
  const { t } = useI18n();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const smtpConfigured = useMemo(() => {
    return Boolean(form.smtp_host && form.smtp_user && (form.smtp_pass || form.smtp_pass_set));
  }, [form.smtp_host, form.smtp_user, form.smtp_pass, form.smtp_pass_set]);
  const placeholdersHint = "{{full_name}} {{email}} {{mobile_number}} {{requested_at}} {{brand}}";

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/email-settings", { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || t("settings.failedLoadEmailSettings"));
        if (!active) return;
        setForm((prev) => ({ ...prev, ...(payload || {}) }));
      } catch (err) {
        if (!active) return;
        setError(err?.message || t("settings.failedLoadEmailSettings"));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/email-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          welcome_auto_send: !!form.welcome_auto_send,
          smtp_host: form.smtp_host,
          smtp_port: Number(form.smtp_port || 587),
          smtp_secure: !!form.smtp_secure,
          smtp_user: form.smtp_user,
          smtp_pass: form.smtp_pass,
          from_name: form.from_name,
          from_email: form.from_email,
          reply_to: form.reply_to,
          brand_name: form.brand_name,
          site_url: form.site_url,
          logo_url: form.logo_url,
          welcome_subject: form.welcome_subject,
          welcome_message: form.welcome_message,
          approval_request_auto_send: !!form.approval_request_auto_send,
          approval_request_recipient: form.approval_request_recipient,
          approval_request_subject: form.approval_request_subject,
          approval_request_message: form.approval_request_message,
          test_recipient: form.test_recipient,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("settings.failedSaveEmailSettings"));
      setForm((prev) => ({ ...prev, ...(payload?.settings || {}), smtp_pass: "" }));
      setMessage(t("settings.emailSettingsSaved"));
    } catch (err) {
      setError(err?.message || t("settings.failedSaveEmailSettings"));
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    setTesting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/email-settings/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient: form.test_recipient }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("settings.failedSendTestEmail"));
      setMessage(`${t("settings.testEmailSentTo")} ${payload?.to || form.test_recipient || t("settings.recipient")}.`);
    } catch (err) {
      setError(err?.message || t("settings.failedSendTestEmail"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className={`${styles.form} ${styles.settingsLayout}`}>
      <div className={`${styles.stats} ${styles.statsCompact4} ${styles.settingsStatusGrid}`}>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><Server size={14} /><span>{t("settings.smtp")}</span></p>
          <strong>{smtpConfigured ? t("settings.ready") : t("settings.incomplete")}</strong>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><MailCheck size={14} /><span>{t("settings.autoWelcome")}</span></p>
          <strong>{form.welcome_auto_send ? t("settings.enabled") : t("settings.disabled")}</strong>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><Palette size={14} /><span>{t("settings.brand")}</span></p>
          <strong>{form.brand_name || "WEBTVBD"}</strong>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><BellRing size={14} /><span>{t("settings.approvalAlerts")}</span></p>
          <strong>{form.approval_request_auto_send ? t("settings.enabled") : t("settings.disabled")}</strong>
        </article>
      </div>

      <div className={`${styles.controlRowEnd} ${styles.settingsActionBar}`}>
        <div className={styles.controlRow}>
          <Button type="button" className={styles.primaryBtn} disabled={loading || saving} onClick={saveSettings}>
            <Save size={16} />
            <span>{saving ? t("settings.saving") : t("settings.saveEmailSettings")}</span>
          </Button>
          <Button type="button" variant="outline" className={styles.secondaryBtn} disabled={loading || testing} onClick={sendTestEmail}>
            <Send size={16} />
            <span>{testing ? t("settings.testing") : t("settings.sendTestEmail")}</span>
          </Button>
        </div>
        {message ? <p className={styles.successText}>{message}</p> : null}
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><Server size={17} /> {t("settings.smtpConnectivity")}</h3>
          <p className={styles.settingsPanelHint}>{t("settings.smtpHint")}</p>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>SMTP Host</span>
            <input
              type="text"
              value={form.smtp_host}
              onChange={(e) => setForm((prev) => ({ ...prev, smtp_host: e.target.value }))}
              placeholder="smtp.example.com"
            />
          </label>

          <label className={styles.field}>
            <span>SMTP Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={form.smtp_port}
              onChange={(e) => setForm((prev) => ({ ...prev, smtp_port: e.target.value }))}
            />
          </label>

          <label className={`${styles.checkRow} ${styles.settingsToggleRow}`}>
            <input
              type="checkbox"
              checked={!!form.smtp_secure}
              onChange={(e) => setForm((prev) => ({ ...prev, smtp_secure: e.target.checked }))}
            />
            <span>Use secure SMTP (SSL/TLS)</span>
          </label>

          <label className={styles.field}>
            <span>SMTP Username</span>
            <input
              type="text"
              value={form.smtp_user}
              onChange={(e) => setForm((prev) => ({ ...prev, smtp_user: e.target.value }))}
              placeholder="smtp-user@example.com"
            />
          </label>

          <label className={styles.field}>
            <span>SMTP Password</span>
            <input
              type="password"
              value={form.smtp_pass}
              onChange={(e) => setForm((prev) => ({ ...prev, smtp_pass: e.target.value }))}
              placeholder={form.smtp_pass_set ? "Leave blank to keep existing password" : "Enter SMTP password"}
            />
            <small className={styles.fieldHint}>{form.smtp_pass_set ? "Password already saved." : "Password is required for sending emails."}</small>
          </label>

          <label className={styles.field}>
            <span>From Name</span>
            <input
              type="text"
              value={form.from_name}
              onChange={(e) => setForm((prev) => ({ ...prev, from_name: e.target.value }))}
              placeholder="WEBTVBD Support"
            />
          </label>

          <label className={styles.field}>
            <span>From Email</span>
            <input
              type="email"
              value={form.from_email}
              onChange={(e) => setForm((prev) => ({ ...prev, from_email: e.target.value }))}
              placeholder="support@example.com"
            />
          </label>

          <label className={styles.field}>
            <span>Reply-To Email</span>
            <input
              type="email"
              value={form.reply_to}
              onChange={(e) => setForm((prev) => ({ ...prev, reply_to: e.target.value }))}
              placeholder="helpdesk@example.com"
            />
          </label>
        </div>
      </section>

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><Palette size={17} /> {t("settings.brandWebsite")}</h3>
          <p className={styles.settingsPanelHint}>{t("settings.brandWebsiteHint")}</p>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Brand Name</span>
            <input
              type="text"
              value={form.brand_name}
              onChange={(e) => setForm((prev) => ({ ...prev, brand_name: e.target.value }))}
              placeholder="WEBTVBD"
            />
          </label>

          <label className={styles.field}>
            <span>Website URL</span>
            <input
              type="url"
              value={form.site_url}
              onChange={(e) => setForm((prev) => ({ ...prev, site_url: e.target.value }))}
              placeholder="https://your-site.example"
            />
            <small className={styles.fieldHint}>This link is used in email call-to-action buttons.</small>
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Brand Logo URL</span>
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
              placeholder="https://your-site.example/logo.png"
            />
            <small className={styles.fieldHint}>If empty, system will try Website URL + /logo.png.</small>
          </label>
        </div>
      </section>

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><MailCheck size={17} /> {t("settings.welcomeEmail")}</h3>
          <p className={styles.settingsPanelHint}>{t("settings.welcomeEmailHint")}</p>
        </header>
        <div className={styles.formGrid}>
          <label className={`${styles.checkRow} ${styles.settingsToggleRow} ${styles.full}`}>
            <input
              type="checkbox"
              checked={!!form.welcome_auto_send}
              onChange={(e) => setForm((prev) => ({ ...prev, welcome_auto_send: e.target.checked }))}
            />
            <span>Send welcome email automatically when a client is approved</span>
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Welcome Email Subject</span>
            <input
              type="text"
              value={form.welcome_subject}
              onChange={(e) => setForm((prev) => ({ ...prev, welcome_subject: e.target.value }))}
              placeholder="Your WEBTVBD account has been approved"
            />
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Welcome Message Body</span>
            <textarea
              rows={4}
              value={form.welcome_message}
              onChange={(e) => setForm((prev) => ({ ...prev, welcome_message: e.target.value }))}
              placeholder="Welcome message that appears in approved account email."
            />
          </label>
        </div>
      </section>

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><BellRing size={17} /> {t("settings.approvalRequestAlerts")}</h3>
          <p className={styles.settingsPanelHint}>{t("settings.approvalRequestHint")}</p>
        </header>
        <div className={styles.formGrid}>
          <label className={`${styles.checkRow} ${styles.settingsToggleRow} ${styles.full}`}>
            <input
              type="checkbox"
              checked={!!form.approval_request_auto_send}
              onChange={(e) => setForm((prev) => ({ ...prev, approval_request_auto_send: e.target.checked }))}
            />
            <span>Send approval request alerts to admin email automatically</span>
          </label>

          <label className={styles.field}>
            <span>Approval Request Recipient</span>
            <input
              type="email"
              value={form.approval_request_recipient}
              onChange={(e) => setForm((prev) => ({ ...prev, approval_request_recipient: e.target.value }))}
              placeholder="admin@example.com"
            />
            <small className={styles.fieldHint}>All new approval requests will be sent to this email.</small>
          </label>

          <div className={styles.settingsHintTile}>
            <p className={styles.settingsHintTitle}>Template placeholders</p>
            <p className={styles.settingsHintText}>{placeholdersHint}</p>
          </div>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Approval Request Email Subject</span>
            <input
              type="text"
              value={form.approval_request_subject}
              onChange={(e) => setForm((prev) => ({ ...prev, approval_request_subject: e.target.value }))}
              placeholder="New approval request from {{full_name}}"
            />
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Approval Request Email Message</span>
            <textarea
              rows={4}
              value={form.approval_request_message}
              onChange={(e) => setForm((prev) => ({ ...prev, approval_request_message: e.target.value }))}
              placeholder="A client has submitted an approval request..."
            />
            <small className={styles.fieldHint}>You can use the same placeholders as subject.</small>
          </label>
        </div>
      </section>

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><TestTube2 size={17} /> {t("settings.testDelivery")}</h3>
          <p className={styles.settingsPanelHint}>{t("settings.testDeliveryHint")}</p>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Test Recipient Email</span>
            <input
              type="email"
              value={form.test_recipient}
              onChange={(e) => setForm((prev) => ({ ...prev, test_recipient: e.target.value }))}
              placeholder="qa@example.com"
            />
            <small className={styles.fieldHint}>Used by Send Test Email button.</small>
          </label>
        </div>
      </section>
    </section>
  );
}
