import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "./supabaseAdmin";

const SETTINGS_TABLE = "admin_settings";
const SETTINGS_KEY = "email_delivery";

function toCleanString(value, max = 400) {
  return String(value || "").trim().slice(0, max);
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(v)) return true;
    if (["0", "false", "no", "off"].includes(v)) return false;
  }
  return fallback;
}

function toPort(value, fallback = 587) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(65535, Math.round(num)));
}

function toUrl(value) {
  const raw = toCleanString(value, 500);
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    return new URL(raw).toString();
  } catch {
    return "";
  }
}

function normalizeEmail(value) {
  return toCleanString(value, 320).toLowerCase();
}

function looksLikeEmail(value) {
  const v = normalizeEmail(value);
  if (!v || v.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isDeliverableEmail(value) {
  const email = normalizeEmail(value);
  if (!looksLikeEmail(email)) return false;
  if (email.endsWith(".local")) return false;
  return true;
}

function asDateLabel(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return "-";
  return dt.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatSettingsDbError(error, fallback) {
  const message = String(error?.message || fallback || "Request failed.");
  const code = String(error?.code || "");
  const lower = message.toLowerCase();
  if (code === "PGRST205" || code === "42P01" || lower.includes("schema cache") || lower.includes("does not exist")) {
    return "Settings module not initialized. Run latest SQL migration in Supabase.";
  }
  return message;
}

export function getDefaultEmailSettings() {
  const publicSite = toUrl(process.env.PUBLIC_PLAYLIST_BASE_URL || "");
  return {
    welcome_auto_send: true,
    smtp_host: "",
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: "",
    smtp_pass: "",
    from_name: "WEBTVBD Support",
    from_email: "",
    reply_to: "",
    brand_name: "WEBTVBD",
    site_url: publicSite,
    logo_url: "",
    welcome_subject: "Your WEBTVBD account has been approved",
    welcome_message: "Welcome to WEBTVBD. Your account is now active and ready to use.",
    test_recipient: "",
  };
}

export function normalizeEmailSettings(valueJson) {
  const raw = valueJson && typeof valueJson === "object" ? valueJson : {};
  const defaults = getDefaultEmailSettings();
  const smtpUser = normalizeEmail(raw.smtp_user || defaults.smtp_user);
  const smtpPass = toCleanString(raw.smtp_pass || defaults.smtp_pass, 500);
  const fromEmailInput = normalizeEmail(raw.from_email || defaults.from_email);
  const fromEmail = fromEmailInput || (looksLikeEmail(smtpUser) ? smtpUser : "");
  return {
    welcome_auto_send: toBool(raw.welcome_auto_send, defaults.welcome_auto_send),
    smtp_host: toCleanString(raw.smtp_host || defaults.smtp_host, 200),
    smtp_port: toPort(raw.smtp_port, defaults.smtp_port),
    smtp_secure: toBool(raw.smtp_secure, defaults.smtp_secure),
    smtp_user: smtpUser,
    smtp_pass: smtpPass,
    from_name: toCleanString(raw.from_name || defaults.from_name, 120),
    from_email: fromEmail,
    reply_to: normalizeEmail(raw.reply_to || defaults.reply_to),
    brand_name: toCleanString(raw.brand_name || defaults.brand_name, 120) || "WEBTVBD",
    site_url: toUrl(raw.site_url || defaults.site_url),
    logo_url: toUrl(raw.logo_url || defaults.logo_url),
    welcome_subject: toCleanString(raw.welcome_subject || defaults.welcome_subject, 220) || defaults.welcome_subject,
    welcome_message: toCleanString(raw.welcome_message || defaults.welcome_message, 1000) || defaults.welcome_message,
    test_recipient: normalizeEmail(raw.test_recipient || defaults.test_recipient),
  };
}

export function toPublicEmailSettings(settings) {
  const normalized = normalizeEmailSettings(settings);
  return { ...normalized, smtp_pass: "", smtp_pass_set: Boolean(normalized.smtp_pass) };
}

function resolveLogoUrl(settings) {
  if (settings.logo_url) return settings.logo_url;
  if (!settings.site_url) return "";
  return `${settings.site_url.replace(/\/+$/, "")}/logo.png`;
}

function validateSmtpConfig(settings) {
  if (!settings.smtp_host) throw new Error("SMTP host is required.");
  if (!settings.smtp_port) throw new Error("SMTP port is required.");
  if (!settings.smtp_user) throw new Error("SMTP username is required.");
  if (!settings.smtp_pass) throw new Error("SMTP password is required.");
  if (!looksLikeEmail(settings.from_email)) throw new Error("From email is invalid.");
  if (settings.reply_to && !looksLikeEmail(settings.reply_to)) throw new Error("Reply-to email is invalid.");
}

export async function loadEmailSettings(adminClient) {
  const admin = adminClient || getSupabaseAdmin();
  const { data, error } = await admin
    .from(SETTINGS_TABLE)
    .select("value_json")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (error) {
    throw new Error(formatSettingsDbError(error, "Failed to load email settings."));
  }
  return normalizeEmailSettings(data?.value_json || {});
}

export async function saveEmailSettings({ adminUserId = "", patch = {}, adminClient }) {
  const admin = adminClient || getSupabaseAdmin();
  const current = await loadEmailSettings(admin);
  const patchObject = patch && typeof patch === "object" ? patch : {};
  const merged = { ...current, ...patchObject };
  const hasSmtpPass = Object.prototype.hasOwnProperty.call(patchObject, "smtp_pass");
  if (hasSmtpPass && !toCleanString(patchObject.smtp_pass, 500)) {
    merged.smtp_pass = current.smtp_pass;
  }
  const next = normalizeEmailSettings(merged);
  const payload = {
    key: SETTINGS_KEY,
    value_json: next,
    updated_by_admin: adminUserId || null,
    updated_at: new Date().toISOString(),
  };

  let { error } = await admin.from(SETTINGS_TABLE).upsert(payload, { onConflict: "key" });
  const updatedByFkError =
    String(error?.code || "") === "23503" &&
    String(error?.message || "").includes("admin_settings_updated_by_admin_fkey");
  if (updatedByFkError) {
    ({ error } = await admin.from(SETTINGS_TABLE).upsert({ ...payload, updated_by_admin: null }, { onConflict: "key" }));
  }
  if (error) {
    throw new Error(formatSettingsDbError(error, "Failed to save email settings."));
  }
  return next;
}

export async function sendSmtpEmail({ settings, to, subject, html, text, verify = false }) {
  const cfg = normalizeEmailSettings(settings || {});
  validateSmtpConfig(cfg);
  if (!isDeliverableEmail(to)) {
    throw new Error("Recipient email is invalid.");
  }

  const transport = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port,
    secure: cfg.smtp_secure,
    auth: {
      user: cfg.smtp_user,
      pass: cfg.smtp_pass,
    },
  });

  if (verify) {
    await transport.verify();
  }

  const fromName = escapeHtml(cfg.from_name || cfg.brand_name || "Support");
  const from = `${fromName} <${cfg.from_email}>`;
  const info = await transport.sendMail({
    from,
    to: normalizeEmail(to),
    replyTo: cfg.reply_to || undefined,
    subject: toCleanString(subject, 220),
    text: String(text || ""),
    html: String(html || ""),
  });

  return { messageId: String(info?.messageId || "") };
}

export function formatSmtpError(error, settings = {}) {
  const msg = String(error?.message || "SMTP request failed.");
  const code = String(error?.code || "");
  const host = String(settings?.smtp_host || "").trim();
  const port = Number(settings?.smtp_port || 0) || 0;
  const secure = Boolean(settings?.smtp_secure);

  if (code === "ETIMEDOUT" || code === "ESOCKET") {
    return `SMTP connection timeout. Could not reach ${host || "smtp host"}:${port || "?"}. Check host/port/firewall and ensure this host is a real mail server (not Cloudflare proxied).`;
  }
  if (code === "ECONNREFUSED") {
    return `SMTP connection refused by ${host || "smtp host"}:${port || "?"}. Check port/security (${secure ? "SSL/TLS enabled" : "STARTTLS/plain"}) and server access rules.`;
  }
  if (code === "EAUTH") {
    return "SMTP authentication failed. Check SMTP username/password and from email.";
  }
  return msg;
}

export function buildWelcomeEmail({ clientUser, settings }) {
  const cfg = normalizeEmailSettings(settings || {});
  const brand = cfg.brand_name || "WEBTVBD";
  const siteUrl = cfg.site_url || "";
  const logoUrl = resolveLogoUrl(cfg);
  const subject = cfg.welcome_subject || `Your ${brand} account has been approved`;
  const user = clientUser && typeof clientUser === "object" ? clientUser : {};
  const fullName = toCleanString(user.full_name || "", 200) || "Valued Client";
  const email = normalizeEmail(user.email || "");
  const mobile = toCleanString(user.mobile_number || "", 80) || "-";
  const provider = toCleanString(user.auth_provider || "password", 80) || "password";
  const approval = toCleanString(user.approval_status || "approved", 32) || "approved";
  const approvedAt = asDateLabel(user.approved_at);
  const createdAt = asDateLabel(user.created_at);
  const accountId = toCleanString(user.user_id || "", 80) || "-";
  const messageBody = cfg.welcome_message || "Welcome. Your account has been approved.";
  const safeSite = escapeHtml(siteUrl || "");

  const detailRows = [
    ["Full Name", fullName],
    ["Email", email || "-"],
    ["Mobile", mobile],
    ["Approval", approval],
    ["Auth Provider", provider],
    ["Approved At", approvedAt],
    ["Created At", createdAt],
    ["Account ID", accountId],
  ];

  const detailsHtml = detailRows
    .map(
      ([k, v]) => `<tr>
        <th style="padding:10px 12px;border-bottom:1px solid #e3e9f7;text-align:left;font-size:13px;line-height:1.35;color:#324868;width:38%;vertical-align:top;">${escapeHtml(k)}</th>
        <td style="padding:10px 12px;border-bottom:1px solid #e3e9f7;font-size:14px;line-height:1.45;color:#10213d;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(v)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0 !important; padding: 0 !important; background: #edf2fb; }
      @media only screen and (max-width: 600px) {
        .outer-pad { padding: 4px !important; }
        .container { width: 100% !important; max-width: 100% !important; }
        .card { padding: 10px !important; border-radius: 10px !important; border-left: 0 !important; border-right: 0 !important; }
        .hero { padding: 10px !important; border-radius: 9px !important; }
        .logo { height: 34px !important; max-width: 170px !important; }
        .heading { font-size: 31px !important; line-height: 1.06 !important; margin-bottom: 4px !important; }
        .content-text { font-size: 16px !important; line-height: 1.5 !important; margin-bottom: 10px !important; }
        .meta-table th, .meta-table td { padding: 8px !important; font-size: 14px !important; line-height: 1.35 !important; }
        .meta-table th { width: 34% !important; }
        .cta-link { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; padding: 12px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#edf2fb;font-family:Arial,sans-serif;color:#14243d;">
    <div class="outer-pad" style="padding:18px;">
      <div class="container" style="max-width:680px;width:100%;margin:0 auto;">
      <div class="card" style="background:#ffffff;border:1px solid #d7e0f4;border-radius:16px;padding:22px;">
      <div class="hero" style="margin:0 0 14px;padding:14px;border-radius:12px;background:linear-gradient(135deg,#f6f9ff,#ecf2ff);border:1px solid #e5ecff;">
        ${logoUrl ? `<div style="padding:0 0 10px;"><img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brand)}" style="height:42px;max-width:220px;object-fit:contain;display:block;" /></div>` : `<div style="padding:0 0 8px;font-size:18px;font-weight:700;color:#11223b;">${escapeHtml(brand)}</div>`}
        <h2 class="heading" style="margin:0 0 6px;font-size:36px;line-height:1.12;color:#0d2a52;">Welcome to ${escapeHtml(brand)}</h2>
        <p class="content-text" style="margin:0;font-size:16px;line-height:1.5;color:#41587a;">Your account is now approved and ready.</p>
      </div>
      <p class="content-text" style="margin:0 0 10px;font-size:16px;line-height:1.6;">Hello ${escapeHtml(fullName)},</p>
      <p class="content-text" style="margin:0 0 12px;font-size:16px;line-height:1.65;">${escapeHtml(messageBody)}</p>
      <p class="content-text" style="margin:0 0 12px;font-size:16px;line-height:1.6;">Below is your account information:</p>
      <table class="meta-table" style="width:100%;border-collapse:separate;border-spacing:0;background:#f9fbff;border:1px solid #e3e9f7;border-radius:12px;overflow:hidden;">${detailsHtml}</table>
      ${siteUrl ? `<p style="margin:18px 0 0;"><a class="cta-link" href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:12px 18px;background:linear-gradient(135deg,#0f4fcc,#2162df);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;line-height:1;">Visit Website</a></p>` : ""}
      <p style="margin:18px 0 0;font-size:14px;line-height:1.65;color:#334a6d;">${safeSite ? `Website: <a href="${escapeHtml(siteUrl)}" style="color:#2058cd;word-break:break-word;overflow-wrap:anywhere;">${safeSite}</a><br />` : ""}Thank you for staying with ${escapeHtml(brand)}.</p>
      </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `Welcome to ${brand}`,
    ``,
    `Hello ${fullName},`,
    `${messageBody}`,
    `Your account is approved. Account details:`,
    `- Full Name: ${fullName}`,
    `- Email: ${email || "-"}`,
    `- Mobile: ${mobile}`,
    `- Approval: ${approval}`,
    `- Auth Provider: ${provider}`,
    `- Approved At: ${approvedAt}`,
    `- Created At: ${createdAt}`,
    `- Account ID: ${accountId}`,
    siteUrl ? `- Website: ${siteUrl}` : null,
    ``,
    `Thank you for staying with ${brand}.`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export async function sendClientWelcomeEmail({ clientUser, settings, forceSend = false }) {
  const cfg = normalizeEmailSettings(settings || {});
  if (!forceSend && !cfg.welcome_auto_send) {
    return { sent: false, skipped: true, reason: "Auto welcome email is disabled." };
  }
  const recipient = normalizeEmail(clientUser?.email || "");
  if (!isDeliverableEmail(recipient)) {
    return { sent: false, skipped: true, reason: "Client email is missing or not deliverable." };
  }
  const { subject, html, text } = buildWelcomeEmail({ clientUser, settings: cfg });
  const res = await sendSmtpEmail({ settings: cfg, to: recipient, subject, html, text });
  return { sent: true, skipped: false, to: recipient, message_id: res.messageId };
}

export function buildTestEmail({ settings, recipient }) {
  const cfg = normalizeEmailSettings(settings || {});
  const brand = cfg.brand_name || "WEBTVBD";
  const siteUrl = cfg.site_url || "";
  const logoUrl = resolveLogoUrl(cfg);
  const to = normalizeEmail(recipient || cfg.test_recipient || "");
  const subject = `${brand} email configuration test`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f7fc;padding:18px;color:#11223b;"><div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #d7e2f3;border-radius:12px;padding:18px;">${
    logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brand)}" style="height:40px;max-width:200px;object-fit:contain;display:block;margin-bottom:12px;" />` : ""
  }<h2 style="margin:0 0 8px;">Email test successful</h2><p style="margin:0 0 8px;">If you received this email, SMTP setup is working.</p><ul style="margin:0;padding-left:18px;line-height:1.6;"><li>Brand: ${escapeHtml(brand)}</li><li>Recipient: ${escapeHtml(to || "-")}</li><li>SMTP Host: ${escapeHtml(cfg.smtp_host || "-")}</li><li>SMTP Port: ${escapeHtml(String(cfg.smtp_port || "-"))}</li>${siteUrl ? `<li>Website: <a href="${escapeHtml(siteUrl)}">${escapeHtml(siteUrl)}</a></li>` : ""}</ul></div></body></html>`;
  const text = [
    `${brand} email configuration test`,
    "",
    "If you received this email, SMTP setup is working.",
    `Recipient: ${to || "-"}`,
    `SMTP Host: ${cfg.smtp_host || "-"}`,
    `SMTP Port: ${cfg.smtp_port || "-"}`,
    siteUrl ? `Website: ${siteUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return { to, subject, html, text };
}
