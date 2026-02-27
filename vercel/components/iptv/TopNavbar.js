"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

function stripHtml(value) {
  const decoded = String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  return decoded
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function TopNavbar({
  isDark,
  isTvMode,
  onToggleTheme,
  onToggleTvMode,
  onToggleLeftSidebar,
  onToggleRightPanel,
  debugStats,
  clientLabel,
  clientProfile,
}) {
  const [open, setOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState(clientLabel || "Client");
  const [tickerItems, setTickerItems] = useState([]);
  const [tickerSpeedSeconds, setTickerSpeedSeconds] = useState(34);
  const [tickerIconText, setTickerIconText] = useState("•");
  const [activeTickerArticle, setActiveTickerArticle] = useState(null);
  const [form, setForm] = useState({
    full_name: String(clientProfile?.fullName || ""),
    email: String(clientProfile?.email || ""),
    mobile_number: String(clientProfile?.mobileNumber || ""),
    current_password: "",
    new_password: "",
  });

  const readonlyEmail = useMemo(() => String(clientProfile?.email || ""), [clientProfile?.email]);
  const readonlyMobile = useMemo(() => String(clientProfile?.mobileNumber || ""), [clientProfile?.mobileNumber]);

  useEffect(() => {
    let active = true;
    const loadPinned = async () => {
      try {
        const res = await fetch("/api/client/announcements", { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !active) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const speed = Math.min(80, Math.max(8, Math.round(Number(payload?.speed_seconds || 34))));
        const iconText = String(payload?.icon_text || "•").replace(/\s+/g, " ").trim().slice(0, 16) || "•";
        setTickerSpeedSeconds(speed);
        setTickerIconText(iconText);
        const mapped = items
          .map((row) => {
            const useTitle = !!row?.show_title_in_ticker;
            const title = stripHtml(row?.title || "");
            const body = stripHtml(row?.content_html || "");
            const text = useTitle ? title : body || title;
            return {
              id: String(row?.id || ""),
              title: title || "Announcement",
              content_html: String(row?.content_html || ""),
              show_title_in_ticker: useTitle,
              text,
            };
          })
          .filter((row) => row.text);
        setTickerItems(mapped);
      } catch {
        if (active) {
          setTickerItems([]);
          setTickerSpeedSeconds(34);
          setTickerIconText("•");
        }
      }
    };
    loadPinned();
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.new_password && form.new_password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (form.new_password && !form.current_password) {
      setError("Current password is required to set a new password.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          current_password: form.current_password,
          new_password: form.new_password,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update profile.");
      const nextName = String(payload?.item?.full_name || "").trim();
      setDisplayName(nextName || displayName);
      setForm((prev) => ({ ...prev, current_password: "", new_password: "" }));
      setMessage("Profile updated.");
      setOpen(false);
    } catch (err) {
      setError(err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  const renderTickerChunk = (prefix, ariaHidden = false) => (
    <span className={styles.announcementTickerChunk} aria-hidden={ariaHidden}>
      {tickerItems.map((item, index) => (
        <span className={styles.announcementTickerItemWrap} key={`${prefix}-${item.id || index}-${index}`}>
          <span className={styles.announcementTickerItemIcon} aria-hidden="true">
            {tickerIconText}
          </span>
          {item.show_title_in_ticker ? (
            <button
              type="button"
              className={styles.announcementTickerTitleBtn}
              onClick={() => setActiveTickerArticle(item)}
            >
              {item.text}
            </button>
          ) : (
            <span className={styles.announcementTickerText}>{item.text}</span>
          )}
        </span>
      ))}
    </span>
  );

  return (
    <header className={`${styles.topNavbar} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
      <div className={styles.topLeft}>
        <Button type="button" variant="ghost" size="icon" onClick={onToggleLeftSidebar} className={`${styles.iconBtn} ${styles.mobileOnly}`}>
          <Icon name="Menu" size={18} />
        </Button>
        <div className={styles.brandWrap}>
          <div className={styles.brandLogo}>
            <img src="/favicon-32x32.png" alt="WEBTV BD" className={styles.brandLogoImg} />
          </div>
          <h1 className={styles.brandText}>WEBTV BD</h1>
        </div>
      </div>

      <div className={styles.topMiddle}>
        {tickerItems.length ? (
          <div className={styles.announcementTickerDesktop} aria-live="polite">
            <div className={styles.announcementTickerTrack} style={{ "--ticker-duration": `${tickerSpeedSeconds}s` }}>
              {renderTickerChunk("a")}
              {renderTickerChunk("b", true)}
            </div>
          </div>
        ) : null}
        <div className={`${styles.debugBadge} ${styles.debugBadgeDesktop}`}>
          <strong>Debug</strong>
          <span>links: {debugStats.total}</span>
          <span>live: {debugStats.live}</span>
          <span>home: {debugStats.home}</span>
          <span>categories: {debugStats.categories}</span>
        </div>
      </div>

      <div className={styles.topRight}>
        <Button type="button" variant="ghost" size="icon" onClick={onToggleRightPanel} className={`${styles.iconBtn} ${styles.mobileOnly}`}>
          <Icon name="Grid3x3" size={18} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleTvMode}
          className={`${styles.iconBtn} ${styles.tvControl} ${isTvMode ? styles.tvBtnActive : ""}`}
          title="Toggle TV Remote Mode"
          aria-label="Toggle TV Remote Mode"
        >
          <Icon name="MonitorPlay" size={18} />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onToggleTheme} className={styles.iconBtn}>
          {isDark ? <Icon name="Sun" size={18} stroke="var(--primary)" /> : <Icon name="Moon" size={18} stroke="var(--primary)" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className={`${styles.iconBtn} ${styles.hideSm}`}>
          <Icon name="Bell" size={18} />
          <span className={styles.badge}>3</span>
        </Button>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className={styles.iconBtn} title="Profile">
              <Icon name="User" size={18} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className={styles.profileModal}>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Profile</AlertDialogTitle>
              <AlertDialogDescription>
                You can update your name and password. Email and mobile are currently locked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form onSubmit={saveProfile} className={styles.profileForm}>
              <label className={styles.profileField}>
                <span>Full Name</span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Your display name"
                />
              </label>
              <label className={styles.profileField}>
                <span>Email Address (Locked)</span>
                <input type="text" value={readonlyEmail || "-"} readOnly disabled />
              </label>
              <label className={styles.profileField}>
                <span>Mobile Number (Locked)</span>
                <input type="text" value={readonlyMobile || "-"} readOnly disabled />
              </label>
              <label className={styles.profileField}>
                <span>Current Password</span>
                <div className={styles.passwordInputWrap}>
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={form.current_password}
                    onChange={(e) => setForm((prev) => ({ ...prev, current_password: e.target.value }))}
                    placeholder="Required only for password change"
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    <Icon name={showCurrentPassword ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </label>
              <label className={styles.profileField}>
                <span>New Password</span>
                <div className={styles.passwordInputWrap}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={form.new_password}
                    onChange={(e) => setForm((prev) => ({ ...prev, new_password: e.target.value }))}
                    minLength={8}
                    placeholder="Leave empty if no change"
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    <Icon name={showNewPassword ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </label>
              {error ? <p className={styles.profileError}>{error}</p> : null}
              {message ? <p className={styles.profileSuccess}>{message}</p> : null}
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <button type="button" className={styles.profileSecondaryBtn}>Cancel</button>
                </AlertDialogCancel>
                <button type="submit" className={styles.profilePrimaryBtn} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
        <form action="/api/client/auth/logout" method="post" className={styles.clientAuthForm}>
          <span className={`${styles.clientName} ${styles.hideSm}`} title={displayName || "Client"}>
            {displayName || "Client"}
          </span>
          <Button type="submit" size="icon" className={styles.userBtn} title="Logout">
            <Icon name="LogOut" size={17} />
          </Button>
        </form>
      </div>

      <AlertDialog
        open={!!activeTickerArticle}
        onOpenChange={(openState) => {
          if (!openState) setActiveTickerArticle(null);
        }}
      >
        <AlertDialogContent className={styles.announcementArticleModal}>
          <AlertDialogHeader>
            <AlertDialogTitle>{activeTickerArticle?.title || "Announcement"}</AlertDialogTitle>
            <AlertDialogDescription>
              Full article view from pinned announcement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className={styles.announcementArticleBody}
            dangerouslySetInnerHTML={{ __html: activeTickerArticle?.content_html || "" }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">Close</Button>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
