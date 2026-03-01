"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

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

function AnnouncementTicker({
  className,
  tickerItems,
  tickerSpeedSeconds,
  tickerIconText,
  onSelectItem,
}) {
  const [tickerChunkRepeatCount, setTickerChunkRepeatCount] = useState(2);
  const [tickerShiftPx, setTickerShiftPx] = useState(0);
  const [tickerViewportWidthPx, setTickerViewportWidthPx] = useState(0);
  const tickerViewportRef = useRef(null);
  const tickerBaseChunkRef = useRef(null);

  useEffect(() => {
    if (!tickerItems.length) {
      setTickerChunkRepeatCount(2);
      setTickerShiftPx(0);
      setTickerViewportWidthPx(0);
      return;
    }

    const viewportEl = tickerViewportRef.current;
    const baseChunkEl = tickerBaseChunkRef.current;
    if (!viewportEl || !baseChunkEl) return;

    let frame = null;
    const measureTicker = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewportWidth = viewportEl.getBoundingClientRect().width;
        const baseChunkWidth = baseChunkEl.getBoundingClientRect().width;
        if (!viewportWidth || !baseChunkWidth) return;

        const repeatCount = Math.max(2, Math.ceil(viewportWidth / baseChunkWidth) + 1);
        setTickerChunkRepeatCount((prev) => (prev === repeatCount ? prev : repeatCount));
        setTickerViewportWidthPx((prev) => (Math.abs(prev - viewportWidth) < 0.5 ? prev : viewportWidth));
        setTickerShiftPx((prev) => (Math.abs(prev - baseChunkWidth) < 0.5 ? prev : baseChunkWidth));
      });
    };

    measureTicker();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureTicker) : null;
    resizeObserver?.observe(viewportEl);
    resizeObserver?.observe(baseChunkEl);
    window.addEventListener("resize", measureTicker);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureTicker);
    };
  }, [tickerItems, tickerIconText]);

  const renderTickerChunk = (prefix, { ariaHidden = false, chunkRef = null } = {}) => (
    <span className={styles.announcementTickerChunk} aria-hidden={ariaHidden} ref={chunkRef}>
      {tickerItems.map((item, index) => (
        <span className={styles.announcementTickerItemWrap} key={`${prefix}-${item.id || index}-${index}`}>
          <span className={styles.announcementTickerItemIcon} aria-hidden="true">
            {tickerIconText}
          </span>
          {item.show_title_in_ticker ? (
            <button
              type="button"
              className={styles.announcementTickerTitleBtn}
              onClick={() => onSelectItem(item)}
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

  if (!tickerItems.length) return null;

  const safeSpeedSeconds = Math.min(80, Math.max(1, Math.round(Number(tickerSpeedSeconds || 34))));
  const safeViewportPx = Math.max(1, tickerViewportWidthPx || 1);
  const safeShiftPx = Math.max(1, tickerShiftPx || 1);
  // Keep visual speed constant: admin value is treated as time to traverse one viewport width.
  const computedDurationSeconds = Math.max(1, (safeShiftPx * safeSpeedSeconds) / safeViewportPx);

  return (
    <div className={className} aria-live="polite" ref={tickerViewportRef}>
      <div
        className={styles.announcementTickerTrack}
        style={{
          "--ticker-duration": `${computedDurationSeconds}s`,
          "--ticker-shift": `${Math.round(safeShiftPx)}px`,
        }}
      >
        {Array.from({ length: tickerChunkRepeatCount }).map((_, chunkIndex) =>
          renderTickerChunk(`chunk-${chunkIndex}`, {
            ariaHidden: chunkIndex > 0,
            chunkRef: chunkIndex === 0 ? tickerBaseChunkRef : null,
          }),
        )}
      </div>
    </div>
  );
}

export default function TopNavbar({
  isDark,
  isTvMode,
  onToggleTvMode,
  onToggleLeftSidebar,
  onToggleRightPanel,
  onProfileIconClick,
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
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const notificationMenuRef = useRef(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isIosInstallHint, setIsIosInstallHint] = useState(false);
  const [pushReady, setPushReady] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const [showInstallCta, setShowInstallCta] = useState(false);
  const [showPushCta, setShowPushCta] = useState(false);
  const vapidPublicKeyRef = useRef(String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim());
  const installDismissKeyRef = useRef("iptv:install-cta-dismissed");
  const pushPromptedKeyRef = useRef("iptv:push-prompted");
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
        const speed = Math.min(80, Math.max(1, Math.round(Number(payload?.speed_seconds || 34))));
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

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const res = await fetch("/api/client/notifications", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to load notifications.");
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setNotifications(items);
      setUnreadCount(Math.max(0, Number(payload?.unread_count || 0)));
    } catch (err) {
      setNotificationsError(err?.message || "Failed to load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 60000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const nav = window.navigator;
    const ua = String(nav?.userAgent || "").toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || nav?.standalone === true;
    setIsIosInstallHint(isIos && !isStandalone);

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
      try {
        const dismissed = window.localStorage.getItem(installDismissKeyRef.current) === "1";
        setShowInstallCta(!dismissed);
      } catch {
        setShowInstallCta(true);
      }
    };
    const onInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsIosInstallHint(false);
      setShowInstallCta(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isIosInstallHint) {
      try {
        const dismissed = window.localStorage.getItem(installDismissKeyRef.current) === "1";
        setShowInstallCta(!dismissed);
      } catch {
        setShowInstallCta(true);
      }
    }
  }, [isIosInstallHint]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushReady(canPush);
    setPushEnabled(false);
    if (!canPush) return;

    const initPush = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        setPushEnabled(Boolean(existing));
        if (existing) {
          await fetch("/api/client/push-subscriptions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ subscription: existing, user_agent: navigator.userAgent }),
          }).catch(() => {});
        } else if (Notification.permission === "default") {
          try {
            const prompted = window.localStorage.getItem(pushPromptedKeyRef.current) === "1";
            if (!prompted) setShowPushCta(true);
          } catch {
            setShowPushCta(true);
          }
        }
      } catch {
        setPushReady(false);
      }
    };
    initPush();
  }, []);

  const resolveVapidPublicKey = useCallback(async () => {
    const existing = String(vapidPublicKeyRef.current || "").trim();
    if (existing) return existing;
    try {
      const res = await fetch("/api/client/push-config", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return "";
      const key = String(payload?.public_key || "").trim();
      if (key) vapidPublicKeyRef.current = key;
      return key;
    } catch {
      return "";
    }
  }, []);

  const enablePushNotifications = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const vapidPublicKey = await resolveVapidPublicKey();
    if (!vapidPublicKey) {
      setPushError("Push is not configured yet. Please try again later.");
      return;
    }

    setPushBusy(true);
    setPushError("");
    try {
      const permission = await Notification.requestPermission();
      try {
        window.localStorage.setItem(pushPromptedKeyRef.current, "1");
      } catch {
        // ignore localStorage errors
      }
      setShowPushCta(false);
      if (permission !== "granted") {
        setPushEnabled(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const saveRes = await fetch("/api/client/push-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription, user_agent: navigator.userAgent }),
      });
      if (!saveRes.ok) throw new Error("Failed to enable push notifications.");
      setPushEnabled(true);
    } catch (err) {
      setPushEnabled(false);
      setPushError(err?.message || "Failed to enable push notifications.");
    } finally {
      setPushBusy(false);
    }
  }, [resolveVapidPublicKey]);

  const disablePushNotifications = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setPushBusy(true);
    setPushError("");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setPushEnabled(false);
        return;
      }
      const endpoint = String(subscription.endpoint || "").trim();
      await subscription.unsubscribe().catch(() => {});
      if (endpoint) {
        await fetch("/api/client/push-subscriptions", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
      setPushEnabled(false);
    } catch (err) {
      setPushError(err?.message || "Failed to disable push notifications.");
    } finally {
      setPushBusy(false);
    }
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!(event.target instanceof Node)) return;
      if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false);
      if (!notificationMenuRef.current?.contains(event.target)) setNotificationMenuOpen(false);
    };
    const onEscape = (event) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setNotificationMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  async function markNotificationsRead({ announcementId = "", markAll = false } = {}) {
    try {
      const res = await fetch("/api/client/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(markAll ? { mark_all: true } : { announcement_id: announcementId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to update notifications.");
      await loadNotifications();
      return true;
    } catch {
      return false;
    }
  }

  async function triggerInstallPrompt() {
    if (deferredInstallPrompt?.prompt) {
      try {
        await deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
      } catch {
        // ignore install prompt errors
      } finally {
        setDeferredInstallPrompt(null);
        setShowInstallCta(false);
        try {
          window.localStorage.setItem(installDismissKeyRef.current, "1");
        } catch {
          // ignore localStorage errors
        }
      }
      return;
    }
    if (isIosInstallHint) {
      window.alert("To install this app on iPhone: tap Share, then choose 'Add to Home Screen'.");
    }
  }

  function dismissInstallCta() {
    setShowInstallCta(false);
    try {
      window.localStorage.setItem(installDismissKeyRef.current, "1");
    } catch {
      // ignore localStorage errors
    }
  }

  function dismissPushCta() {
    setShowPushCta(false);
    try {
      window.localStorage.setItem(pushPromptedKeyRef.current, "1");
    } catch {
      // ignore localStorage errors
    }
  }

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
        <AnnouncementTicker
          className={styles.announcementTickerDesktop}
          tickerItems={tickerItems}
          tickerSpeedSeconds={tickerSpeedSeconds}
          tickerIconText={tickerIconText}
          onSelectItem={setActiveTickerArticle}
        />
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
        {(deferredInstallPrompt || isIosInstallHint) ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={triggerInstallPrompt}
            className={styles.iconBtn}
            title="Install App"
            aria-label="Install App"
          >
            <Icon name="Download" size={18} />
          </Button>
        ) : null}
        <div className={styles.notificationMenuWrap} ref={notificationMenuRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.iconBtn}
            title="Notifications"
            aria-haspopup="menu"
            aria-expanded={notificationMenuOpen}
            onClick={() => {
              setUserMenuOpen(false);
              const nextOpen = !notificationMenuOpen;
              setNotificationMenuOpen(nextOpen);
              if (nextOpen) loadNotifications();
            }}
          >
            <Icon name="Bell" size={18} />
            {unreadCount > 0 ? <span className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
          </Button>
          {notificationMenuOpen ? (
            <div className={styles.notificationDropdown} role="menu" aria-label="Notifications">
              <div className={styles.notificationHeader}>
                <strong>Notifications</strong>
                <div className={styles.notificationHeaderActions}>
                  {pushReady ? (
                    <button
                      type="button"
                      className={`${styles.notificationMarkAllBtn} ${styles.pushHeaderBtn} ${pushEnabled ? styles.pushBtnActive : styles.pushBtnInactive}`}
                      onClick={pushEnabled ? disablePushNotifications : enablePushNotifications}
                      title={pushEnabled ? "Push: ON (click to disable)" : "Push: OFF (click to enable)"}
                      aria-label={pushEnabled ? "Push notification is ON. Click to disable." : "Push notification is OFF. Click to enable."}
                      disabled={pushBusy}
                    >
                      <Icon name={pushEnabled ? "BellRing" : "BellOff"} size={14} />
                      <span>{pushBusy ? "..." : pushEnabled ? "Push ON" : "Push OFF"}</span>
                      <span
                        className={`${styles.pushStateDot} ${pushEnabled ? styles.pushStateDotOn : styles.pushStateDotOff}`}
                        aria-hidden="true"
                      />
                    </button>
                  ) : null}
                  <span>{unreadCount} unread</span>
                  <button
                    type="button"
                    className={styles.notificationMarkAllBtn}
                    disabled={!notifications.length || unreadCount <= 0}
                    onClick={() => markNotificationsRead({ markAll: true })}
                  >
                    Mark all read
                  </button>
                </div>
              </div>
              <div className={styles.notificationList}>
                {notificationsLoading ? <p className={styles.notificationState}>Loading...</p> : null}
                {notificationsError && !notificationsLoading ? <p className={styles.notificationState}>{notificationsError}</p> : null}
                {!notificationsLoading && !notificationsError && !notifications.length ? (
                  <p className={styles.notificationState}>No notifications yet.</p>
                ) : null}
                {!notificationsLoading && !notificationsError
                  ? notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.notificationItem} ${item.is_read ? styles.notificationItemRead : ""}`}
                        role="menuitem"
                        onClick={async () => {
                          if (!item.is_read) await markNotificationsRead({ announcementId: item.id });
                          setActiveTickerArticle({
                            id: item.id,
                            title: item.title || "Announcement",
                            content_html: item.content_html || "",
                          });
                          setNotificationMenuOpen(false);
                        }}
                      >
                        <div className={styles.notificationItemTop}>
                          <span className={styles.notificationItemTitle}>{item.title || "Announcement"}</span>
                          {!item.is_read ? <span className={styles.notificationDot} aria-hidden="true" /> : null}
                        </div>
                        <span className={styles.notificationItemMeta}>
                          {item.updated_at ? new Date(item.updated_at).toLocaleString() : "Recently updated"}
                        </span>
                      </button>
                    ))
                  : null}
              </div>
            </div>
          ) : null}
        </div>

        <AlertDialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) {
              setUserMenuOpen(false);
              setNotificationMenuOpen(false);
            }
          }}
        >
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
        <div className={styles.userMenuWrap} ref={userMenuRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.iconBtn}
            title="Profile Menu"
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            onClick={() => {
              if (typeof onProfileIconClick === "function") onProfileIconClick();
              setNotificationMenuOpen(false);
              setUserMenuOpen((prev) => !prev);
            }}
          >
            <Icon name="User" size={18} />
          </Button>
          {userMenuOpen ? (
            <div className={styles.userMenuDropdown} role="menu" aria-label="User menu">
              <div className={styles.userMenuHeader}>
                <strong title={displayName || "Client"}>{displayName || "Client"}</strong>
                <span title={readonlyEmail || "-"}>{readonlyEmail || "-"}</span>
              </div>
              <button
                type="button"
                className={styles.userMenuItem}
                role="menuitem"
                onClick={() => {
                  setOpen(true);
                  setUserMenuOpen(false);
                }}
              >
                <Icon name="Settings" size={16} />
                Edit Profile
              </button>
              <form action="/api/client/auth/logout" method="post">
                <button type="submit" className={`${styles.userMenuItem} ${styles.userMenuItemDanger}`} role="menuitem">
                  <Icon name="LogOut" size={16} />
                  Logout
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
      <AnnouncementTicker
        className={styles.announcementTickerMobile}
        tickerItems={tickerItems}
        tickerSpeedSeconds={tickerSpeedSeconds}
        tickerIconText={tickerIconText}
        onSelectItem={setActiveTickerArticle}
      />
      {showInstallCta ? (
        <div className={styles.mobileActionPrompt} role="status" aria-live="polite">
          <div className={styles.mobileActionPromptText}>
            <strong>Install WEBTV BD App</strong>
            <span>Get quick access from your mobile home screen.</span>
          </div>
          <div className={styles.mobileActionPromptActions}>
            <button type="button" className={styles.mobilePromptBtn} onClick={triggerInstallPrompt}>
              <Icon name="Download" size={14} />
              Install
            </button>
            <button type="button" className={styles.mobilePromptGhostBtn} onClick={dismissInstallCta}>
              Later
            </button>
          </div>
        </div>
      ) : null}
      {showPushCta && pushReady && !showInstallCta ? (
        <div className={styles.mobileActionPrompt} role="status" aria-live="polite">
          <div className={styles.mobileActionPromptText}>
            <strong>Enable Push Notifications</strong>
            <span>Get instant alerts for new announcements.</span>
          </div>
          <div className={styles.mobileActionPromptActions}>
            <button type="button" className={styles.mobilePromptBtn} onClick={enablePushNotifications} disabled={pushBusy}>
              <Icon name="Bell" size={14} />
              {pushBusy ? "Enabling..." : "Allow"}
            </button>
            <button type="button" className={styles.mobilePromptGhostBtn} onClick={dismissPushCta}>
              Later
            </button>
          </div>
        </div>
      ) : null}
      {pushError ? <p className={styles.pushInlineError}>{pushError}</p> : null}

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
