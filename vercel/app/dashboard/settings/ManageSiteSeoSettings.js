"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, ImagePlus, Save, ScanSearch, Type } from "lucide-react";
import styles from "../page.module.css";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../components/i18n/LanguageProvider";

const DEFAULT_FORM = {
  site_name: "WEBTVBD",
  home_title: "WEBTVBD || TV Beyond Borders",
  home_description: "WEBTVBD live streaming platform for channels, categories, and on-demand viewer access.",
  og_title: "WEBTVBD || TV Beyond Borders",
  og_description: "Watch live channels, movies, and viewer content on WEBTVBD.",
  og_image_url: "",
  og_image_alt: "WEBTVBD social preview",
  og_image_path: "",
  og_image_bucket: "",
};

const OG_IMAGE_HINT = "Recommended: 1200 x 630 px, ratio 1.91:1, JPG/PNG/WebP, under 5MB.";
const SOCIAL_PREVIEW_HOST = "webtvbd.com";
const PREVIEW_PLATFORMS = ["facebook", "whatsapp", "telegram"];

export default function ManageSiteSeoSettings() {
  const { t } = useI18n();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState("facebook");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const titleLength = useMemo(() => String(form.og_title || "").trim().length, [form.og_title]);
  const descriptionLength = useMemo(() => String(form.og_description || "").trim().length, [form.og_description]);
  const imageReady = Boolean(String(form.og_image_url || "").trim());
  const previewTitle = String(form.og_title || form.home_title || form.site_name || "WEBTVBD").trim();
  const previewDescription = String(form.og_description || form.home_description || "").trim();
  const previewSiteName = String(form.site_name || "WEBTVBD").trim();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/site-seo-settings", { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || t("settings.failedLoadSeoSettings"));
        if (!active) return;
        setForm((prev) => ({ ...prev, ...(payload || {}) }));
      } catch (err) {
        if (!active) return;
        setError(err?.message || t("settings.failedLoadSeoSettings"));
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
      const res = await fetch("/api/admin/site-seo-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || t("settings.failedSaveSeoSettings"));
      setForm((prev) => ({ ...prev, ...(payload?.settings || {}) }));
      setMessage(t("settings.seoSettingsSaved"));
    } catch (err) {
      setError(err?.message || t("settings.failedSaveSeoSettings"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadOgImage(file) {
    try {
      if (!file) return;
      setUploading(true);
      setError("");
      setMessage("");
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/admin/media/og-image-upload", {
        method: "POST",
        body: data,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to upload Open Graph image.");
      setForm((prev) => ({
        ...prev,
        og_image_url: String(payload?.url || ""),
        og_image_path: String(payload?.path || ""),
        og_image_bucket: String(payload?.bucket || ""),
      }));
      setMessage("Open Graph image uploaded successfully.");
    } catch (err) {
      setError(err?.message || "Failed to upload Open Graph image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className={`${styles.form} ${styles.settingsLayout}`}>
      <div className={`${styles.stats} ${styles.statsCompact3} ${styles.settingsStatusGrid}`}>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><Type size={14} /><span>OG Title</span></p>
          <strong>{titleLength}</strong>
          <span className={styles.metaMuted}>Ideal 40-70 chars</span>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><ScanSearch size={14} /><span>OG Description</span></p>
          <strong>{descriptionLength}</strong>
          <span className={styles.metaMuted}>Ideal 110-160 chars</span>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabelWithIcon}><Globe size={14} /><span>Share Image</span></p>
          <strong>{imageReady ? t("settings.ready") : t("settings.incomplete")}</strong>
          <span className={styles.metaMuted}>{imageReady ? "Image linked" : "Upload or paste URL"}</span>
        </article>
      </div>

      <div className={`${styles.controlRowEnd} ${styles.settingsActionBar}`}>
        <div className={styles.controlRow}>
          <Button type="button" className={styles.primaryBtn} disabled={loading || saving} onClick={saveSettings}>
            <Save size={16} />
            <span>{saving ? t("settings.saving") : t("settings.saveSeoSettings")}</span>
          </Button>
        </div>
        {message ? <p className={styles.successText}>{message}</p> : null}
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><Globe size={17} /> Homepage SEO</h3>
          <p className={styles.settingsPanelHint}>These values are used when the homepage is shared on Facebook, Messenger, WhatsApp, Telegram, X, and similar platforms.</p>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Site Name</span>
            <input
              type="text"
              value={form.site_name}
              onChange={(e) => setForm((prev) => ({ ...prev, site_name: e.target.value }))}
              placeholder="WEBTVBD"
            />
          </label>

          <label className={styles.field}>
            <span>Homepage Title</span>
            <input
              type="text"
              value={form.home_title}
              onChange={(e) => setForm((prev) => ({ ...prev, home_title: e.target.value }))}
              placeholder="WEBTVBD || TV Beyond Borders"
            />
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Homepage Description</span>
            <textarea
              rows={3}
              value={form.home_description}
              onChange={(e) => setForm((prev) => ({ ...prev, home_description: e.target.value }))}
              placeholder="Short homepage description for search and social sharing."
            />
          </label>
        </div>
      </section>

      <section className={styles.settingsPanel}>
        <header className={styles.settingsPanelHead}>
          <h3 className={styles.settingsPanelTitle}><ImagePlus size={17} /> Open Graph Card</h3>
          <p className={styles.settingsPanelHint}>Use a wide banner image so the share card looks clean across social platforms.</p>
        </header>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Open Graph Title</span>
            <input
              type="text"
              value={form.og_title}
              onChange={(e) => setForm((prev) => ({ ...prev, og_title: e.target.value }))}
              placeholder="Title shown on social share card"
            />
          </label>

          <label className={styles.field}>
            <span>Image Alt Text</span>
            <input
              type="text"
              value={form.og_image_alt}
              onChange={(e) => setForm((prev) => ({ ...prev, og_image_alt: e.target.value }))}
              placeholder="Describe the social preview image"
            />
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            <span>Open Graph Description</span>
            <textarea
              rows={3}
              value={form.og_description}
              onChange={(e) => setForm((prev) => ({ ...prev, og_description: e.target.value }))}
              placeholder="Description shown in social media preview card"
            />
          </label>

          <div className={`${styles.field} ${styles.full}`}>
            <span>Open Graph Image</span>
            <div className={styles.logoFieldRow}>
              <input
                className={styles.inlineInput}
                type="url"
                value={form.og_image_url}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    og_image_url: e.target.value,
                    og_image_path: "",
                    og_image_bucket: "",
                  }))
                }
                placeholder="https://your-site.example/social-card.jpg"
              />
              <label className={styles.uploadLogoBtn}>
                {uploading ? "Uploading..." : "Upload image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(e) => uploadOgImage(e.target.files?.[0])}
                  style={{ display: "none" }}
                />
              </label>
            </div>
            <small className={styles.fieldHint}>{OG_IMAGE_HINT}</small>
          </div>
        </div>

        <div className={styles.settingsHintTile}>
          <p className={styles.settingsHintTitle}>Best social image size</p>
          <p className={styles.settingsHintText}>{OG_IMAGE_HINT}</p>
        </div>

        {imageReady ? (
          <div className={styles.socialPreviewCard}>
            <p className={styles.settingsHintTitle}>Social card preview</p>
            <div className={styles.previewToggleRow}>
              {PREVIEW_PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={`${styles.previewToggleBtn} ${previewPlatform === platform ? styles.previewToggleBtnActive : ""}`}
                  onClick={() => setPreviewPlatform(platform)}
                >
                  {platform}
                </button>
              ))}
            </div>
            <div className={`${styles.socialPreviewShell} ${styles[`socialPreviewShell${previewPlatform[0].toUpperCase()}${previewPlatform.slice(1)}`]}`}>
              <div className={styles.socialPreviewPlatformBar}>
                <span className={styles.socialPreviewDot} />
                <span className={styles.socialPreviewDot} />
                <span className={styles.socialPreviewDot} />
                <span className={styles.socialPreviewPlatformLabel}>{previewPlatform}</span>
              </div>
              <div className={styles.socialPreviewFrame}>
                <img
                  src={form.og_image_url}
                  alt={form.og_image_alt || "Open Graph preview"}
                  className={styles.socialPreviewImage}
                />
                <div className={styles.socialPreviewMeta}>
                  <p className={styles.socialPreviewUrl}>{SOCIAL_PREVIEW_HOST}</p>
                  <h4 className={styles.socialPreviewTitle}>{previewTitle}</h4>
                  <p className={styles.socialPreviewDescription}>{previewDescription || "Your homepage description will appear here."}</p>
                  <div className={styles.socialPreviewFooter}>
                    <span className={styles.socialPreviewBadge}>{previewSiteName || "WEBTVBD"}</span>
                    <span className={styles.socialPreviewType}>{previewPlatform}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
