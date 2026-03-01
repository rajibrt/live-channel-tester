"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Send } from "lucide-react";
import styles from "../page.module.css";
import { Button } from "../../../components/ui/button";

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
  test_recipient: "",
};

export default function ManageEmailSettings() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const smtpConfigured = useMemo(() => {
    return Boolean(form.smtp_host && form.smtp_user && (form.smtp_pass || form.smtp_pass_set));
  }, [form.smtp_host, form.smtp_user, form.smtp_pass, form.smtp_pass_set]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/email-settings", { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Failed to load email settings.");
        if (!active) return;
        setForm((prev) => ({ ...prev, ...(payload || {}) }));
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load email settings.");
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
          test_recipient: form.test_recipient,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save email settings.");
      setForm((prev) => ({ ...prev, ...(payload?.settings || {}), smtp_pass: "" }));
      setMessage("Email settings saved.");
    } catch (err) {
      setError(err?.message || "Failed to save email settings.");
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
      if (!res.ok) throw new Error(payload?.error || "Failed to send test email.");
      setMessage(`Test email sent to ${payload?.to || form.test_recipient || "recipient"}.`);
    } catch (err) {
      setError(err?.message || "Failed to send test email.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className={styles.form}>
      <div className={styles.statsCompact3}>
        <article className={styles.statCard}>
          <p>SMTP</p>
          <strong>{smtpConfigured ? "Ready" : "Incomplete"}</strong>
        </article>
        <article className={styles.statCard}>
          <p>Auto Welcome</p>
          <strong>{form.welcome_auto_send ? "Enabled" : "Disabled"}</strong>
        </article>
        <article className={styles.statCard}>
          <p>Brand</p>
          <strong>{form.brand_name || "WEBTVBD"}</strong>
        </article>
      </div>

      <div className={styles.controlRowEnd}>
        <div className={styles.controlRow}>
          <Button type="button" className={styles.primaryBtn} disabled={loading || saving} onClick={saveSettings}>
            <Save size={16} />
            <span>{saving ? "Saving..." : "Save Email Settings"}</span>
          </Button>
          <Button type="button" variant="outline" className={styles.secondaryBtn} disabled={loading || testing} onClick={sendTestEmail}>
            <Send size={16} />
            <span>{testing ? "Testing..." : "Send Test Email"}</span>
          </Button>
        </div>
        {message ? <p className={styles.successText}>{message}</p> : null}
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <div className={styles.formGrid}>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={!!form.welcome_auto_send}
            onChange={(e) => setForm((prev) => ({ ...prev, welcome_auto_send: e.target.checked }))}
          />
          <span>Send welcome email automatically when a client is approved</span>
        </label>

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

        <label className={styles.checkRow}>
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
          <small className={styles.fieldHint}>This link will be added to welcome email body.</small>
        </label>

        <label className={styles.field}>
          <span>Brand Logo URL</span>
          <input
            type="url"
            value={form.logo_url}
            onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
            placeholder="https://your-site.example/logo.png"
          />
          <small className={styles.fieldHint}>If empty, system will try Website URL + /logo.png.</small>
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
  );
}
