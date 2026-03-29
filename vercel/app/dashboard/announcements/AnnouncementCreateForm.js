"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import styles from "../page.module.css";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import RichArticleEditor from "./RichArticleEditor";

const EMPTY_FORM = {
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

export default function AnnouncementCreateForm({ mode: sectionMode = "articles", initialData = null, editId = "" }) {
  const router = useRouter();
  const isAnnouncementMode = sectionMode === "announcements";
  const isEditing = !!String(editId || "").trim();
  const baseForm = useMemo(() => ({
    ...EMPTY_FORM,
    ...initialData,
    content_type: isAnnouncementMode ? "announcement" : "article",
    show_title_in_ticker: isAnnouncementMode ? true : !!initialData?.show_title_in_ticker,
    is_pinned: isAnnouncementMode ? !!initialData?.is_pinned : false,
  }), [initialData, isAnnouncementMode]);
  const [form, setForm] = useState(baseForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  async function uploadArticleImage(file) {
    try {
      if (!file) return;
      setUploadingImage(true);
      setError("");
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
    } catch (err) {
      setError(err?.message || "Failed to upload article image.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(event, mode = "publish") {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(isEditing ? `/api/admin/announcements/${encodeURIComponent(editId)}` : "/api/admin/announcements", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          content_type: isAnnouncementMode ? "announcement" : "article",
          show_title_in_ticker: isAnnouncementMode ? true : !!form.show_title_in_ticker,
          is_published: mode === "draft" ? false : !!form.is_published,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `Failed to ${isEditing ? "update" : "create"} article.`);
      router.push(isAnnouncementMode ? "/dashboard/announcements" : "/dashboard/articles");
      router.refresh();
    } catch (err) {
      setError(err?.message || `Failed to ${isEditing ? "update" : "create"} article.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>
            {isEditing ? (isAnnouncementMode ? "Edit Announcement" : "Edit Article") : (isAnnouncementMode ? "New Announcement" : "New Article")}
          </h2>
          <p className={styles.hint}>
            {isEditing
              ? isAnnouncementMode
                ? "Update the announcement on its own page."
                : "Update the article on its own page."
              : isAnnouncementMode
              ? "Create a ticker-friendly announcement on its own page instead of inside a modal."
              : "Create a full article on its own page instead of inside a modal."}
          </p>
        </div>
      </div>

      <form className={styles.form} onSubmit={(event) => handleSubmit(event, "publish")}>
        <label className={styles.field}>
          <span>Title</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Bangladesh Television: The Pioneer of Broadcasting in Bangladesh"
            required
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

        <label className={styles.field}>
          <span>Content / Article</span>
          <RichArticleEditor
            value={form.content_html}
            onChange={(value) => setForm((prev) => ({ ...prev, content_html: value }))}
          />
        </label>

        <div className={styles.formGrid}>
          <label className={styles.checkRow}>
            <Switch
              checked={!!form.is_published}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_published: checked }))}
            />
            <span>Publish now</span>
          </label>
          <label className={styles.checkRow}>
            <Switch
              checked={!!form.is_pinned}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_pinned: checked }))}
            />
            <span>Pin to top</span>
          </label>
          {!isAnnouncementMode ? (
            <label className={styles.checkRow}>
              <Switch
                checked={!!form.show_title_in_ticker}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, show_title_in_ticker: checked }))}
              />
              <span>Show title in ticker and open article in modal on click</span>
            </label>
          ) : null}
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.controlRowEnd}>
          <div className={styles.controlRow}>
            <Link href={isAnnouncementMode ? "/dashboard/announcements" : "/dashboard/articles"} className={styles.secondaryBtn}>
              Cancel
            </Link>
            <Button
              type="button"
              variant="outline"
              className={styles.secondaryBtn}
              disabled={saving}
              onClick={(event) => handleSubmit(event, "draft")}
            >
              <Save size={16} />
              <span>{saving ? "Saving..." : "Save as Draft"}</span>
            </Button>
            <Button type="submit" className={styles.primaryBtn} disabled={saving}>
              <Save size={16} />
              <span>
                {saving
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : isAnnouncementMode
                      ? "Create Announcement"
                      : "Create Article"}
              </span>
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
