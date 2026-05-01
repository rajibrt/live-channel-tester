'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Icon } from './icons'
import styles from './iptv.module.css'

const BUILD_VERSION = String(process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev').trim() || 'dev'
const SW_URL = `/sw.js?v=${encodeURIComponent(BUILD_VERSION)}`
const ANDROID_APP_URL = String(process.env.NEXT_PUBLIC_ANDROID_APP_URL || '').trim()

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function stripHtml(value) {
  const decoded = String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")

  return decoded
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripLeadingTitle(body, title) {
  const safeBody = String(body || '').trim()
  const safeTitle = String(title || '').trim()
  if (!safeBody || !safeTitle) return safeBody

  const normalizedBody = safeBody.replace(/\s+/g, ' ').trim()
  const normalizedTitle = safeTitle.replace(/\s+/g, ' ').trim()
  const titlePattern = new RegExp(`^${escapeRegExp(normalizedTitle)}(?:\\s*[|:।,-]+\\s*|\\s+)`, 'i')
  return normalizedBody.replace(titlePattern, '').trim() || normalizedBody
}

function isInstallCtaDismissed(
  storageKey,
  windowRef,
  cooldownMs = 24 * 60 * 60 * 1000,
) {
  try {
    const raw = String(windowRef.localStorage.getItem(storageKey) || '').trim()
    if (!raw || raw === '1') return false
    const dismissedAt = Number(raw)
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false
    return Date.now() - dismissedAt < cooldownMs
  } catch {
    return false
  }
}

function getAndroidInstallHelpMessage(windowRef) {
  const ua = String(windowRef?.navigator?.userAgent || '').toLowerCase()
  const isWebView =
    /\bwv\b/.test(ua) ||
    /fbav|fb_iab|instagram|line\/|micromessenger|telegram/.test(ua)
  const isChrome =
    /chrome\/\d+/.test(ua) &&
    !/edg\//.test(ua) &&
    !/opr\//.test(ua) &&
    !/samsungbrowser\//.test(ua)

  if (isWebView) {
    return 'Install app option in-app browser এ আসে না। Chrome app এ webtvbd.com খুলে আবার চেষ্টা করুন।'
  }
  if (!isChrome) {
    return "এই browser-এ 'Install app' নাও থাকতে পারে। Google Chrome app দিয়ে webtvbd.com খুলে menu থেকে 'Install app' দিন।"
  }
  return "এই মুহূর্তে browser install prompt detect করছে না। Chrome এ page reload করে 20-30 সেকেন্ড পরে আবার menu চেক করুন, তারপরও না এলে site data clear করে আবার চেষ্টা করুন।"
}

function isValidInstallUrl(value) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const PUSH_REMINDER_DELAY_MS = 2 * 60 * 1000

function isNativeAppRuntime(windowRef) {
  try {
    const cap = windowRef?.Capacitor
    const ua = String(windowRef?.navigator?.userAgent || '').toLowerCase()
    const isAndroid = /android/.test(ua)
    const fromAppQuery = (() => {
      try {
        const params = new URL(windowRef.location.href).searchParams
        return params.get('app') === '1'
      } catch {
        return false
      }
    })()
    const persistedFlag = (() => {
      try {
        return windowRef.localStorage.getItem('webtvbd:native-runtime') === '1'
      } catch {
        return false
      }
    })()
    const hasCapacitorUaTag = ua.includes('webtvbdapp')
    const isLikelyAndroidWebView =
      isAndroid && (/;\s*wv\)/.test(ua) || /version\/4\.0/.test(ua))
    if (fromAppQuery) {
      try {
        windowRef.localStorage.setItem('webtvbd:native-runtime', '1')
      } catch {
        // ignore localStorage errors
      }
    }
    if (fromAppQuery || persistedFlag || hasCapacitorUaTag || isLikelyAndroidWebView)
      return true
    if (!cap) return false
    if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true
    if (typeof cap.getPlatform === 'function') {
      const platform = String(cap.getPlatform() || '').toLowerCase()
      if (platform === 'android' || platform === 'ios') return true
    }
    return false
  } catch {
    return false
  }
}

function isBrowserInstallContext(windowRef) {
  try {
    const isBrowserDisplayMode = Boolean(
      windowRef.matchMedia?.('(display-mode: browser)')?.matches,
    )
    return isBrowserDisplayMode && !isNativeAppRuntime(windowRef)
  } catch {
    return false
  }
}

function AnnouncementTicker({
  className,
  tickerItems,
  tickerSpeedSeconds,
  tickerIconText,
  onSelectItem,
}) {
  const [tickerChunkRepeatCount, setTickerChunkRepeatCount] = useState(2)
  const [tickerShiftPx, setTickerShiftPx] = useState(0)
  const [tickerViewportWidthPx, setTickerViewportWidthPx] = useState(0)
  const tickerViewportRef = useRef(null)
  const tickerBaseChunkRef = useRef(null)

  useEffect(() => {
    if (!tickerItems.length) {
      setTickerChunkRepeatCount(2)
      setTickerShiftPx(0)
      setTickerViewportWidthPx(0)
      return
    }

    const viewportEl = tickerViewportRef.current
    const baseChunkEl = tickerBaseChunkRef.current
    if (!viewportEl || !baseChunkEl) return

    let frame = null
    const measureTicker = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const viewportWidth = viewportEl.getBoundingClientRect().width
        const baseChunkWidth = baseChunkEl.getBoundingClientRect().width
        if (!viewportWidth || !baseChunkWidth) return

        const repeatCount = Math.max(
          2,
          Math.ceil(viewportWidth / baseChunkWidth) + 1,
        )
        setTickerChunkRepeatCount((prev) =>
          prev === repeatCount ? prev : repeatCount,
        )
        setTickerViewportWidthPx((prev) =>
          Math.abs(prev - viewportWidth) < 0.5 ? prev : viewportWidth,
        )
        setTickerShiftPx((prev) =>
          Math.abs(prev - baseChunkWidth) < 0.5 ? prev : baseChunkWidth,
        )
      })
    }

    measureTicker()
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measureTicker)
        : null
    resizeObserver?.observe(viewportEl)
    resizeObserver?.observe(baseChunkEl)
    window.addEventListener('resize', measureTicker)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measureTicker)
    }
  }, [tickerItems, tickerIconText])

  const renderTickerChunk = (
    prefix,
    { ariaHidden = false, chunkRef = null } = {},
  ) => (
    <span
      key={prefix}
      className={styles.announcementTickerChunk}
      aria-hidden={ariaHidden}
      ref={chunkRef}
    >
      {tickerItems.map((item, index) => (
        <span
          className={styles.announcementTickerItemWrap}
          key={`${prefix}-${item.id || index}-${index}`}
        >
          <span
            className={styles.announcementTickerItemIcon}
            aria-hidden='true'
          >
            {tickerIconText}
          </span>
          {item.show_title_in_ticker ? (
            <button
              type='button'
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
  )

  if (!tickerItems.length) return null

  const safeSpeedSeconds = Math.min(
    80,
    Math.max(1, Math.round(Number(tickerSpeedSeconds || 34))),
  )
  const safeViewportPx = Math.max(1, tickerViewportWidthPx || 1)
  const safeShiftPx = Math.max(1, tickerShiftPx || 1)
  // Keep visual speed constant: admin value is treated as time to traverse one viewport width.
  const computedDurationSeconds = Math.max(
    1,
    (safeShiftPx * safeSpeedSeconds) / safeViewportPx,
  )

  return (
    <div className={className} aria-live='polite' ref={tickerViewportRef}>
      <div
        className={styles.announcementTickerTrack}
        style={{
          '--ticker-duration': `${computedDurationSeconds}s`,
          '--ticker-shift': `${Math.round(safeShiftPx)}px`,
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
  )
}

export default function TopNavbar({
  isDark,
  isTvMode,
  showChannelMenu = true,
  onToggleTvMode,
  onToggleLeftSidebar,
  onToggleRightPanel,
  onProfileIconClick,
  debugStats,
  clientLabel,
  clientProfile,
  language = 'bn',
  isGuest = false,
}) {
  const [open, setOpen] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [displayName, setDisplayName] = useState(clientLabel || 'Client')
  const [tickerItems, setTickerItems] = useState([])
  const [tickerSpeedSeconds, setTickerSpeedSeconds] = useState(34)
  const [tickerIconText, setTickerIconText] = useState('•')
  const [activeTickerArticle, setActiveTickerArticle] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const notificationMenuRef = useRef(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null)
  const [isIosInstallHint, setIsIosInstallHint] = useState(false)
  const [isAndroidInstallHint, setIsAndroidInstallHint] = useState(false)
  const [isNativeRuntime, setIsNativeRuntime] = useState(false)
  const [isBrowserInstallCtx, setIsBrowserInstallCtx] = useState(false)
  const [pushReady, setPushReady] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [showInstallCta, setShowInstallCta] = useState(false)
  const [showPushCta, setShowPushCta] = useState(false)
  const [pushDialogLanguage, setPushDialogLanguage] = useState('bn')
  const vapidPublicKeyRef = useRef(
    String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim(),
  )
  const installDismissKeyRef = useRef('iptv:install-cta-dismissed')
  const pushPromptedKeyRef = useRef('iptv:push-prompted')
  const [form, setForm] = useState({
    full_name: String(clientProfile?.fullName || ''),
    email: String(clientProfile?.email || ''),
    mobile_number: String(clientProfile?.mobileNumber || ''),
    current_password: '',
    new_password: '',
  })

  const readonlyEmail = useMemo(
    () => String(clientProfile?.email || ''),
    [clientProfile?.email],
  )
  const readonlyMobile = useMemo(
    () => String(clientProfile?.mobileNumber || ''),
    [clientProfile?.mobileNumber],
  )
  const copy = useMemo(() => {
    const isBn = String(pushDialogLanguage || 'bn').trim().toLowerCase() !== 'en'
    return isBn
      ? {
          pushTitle: 'পুশ নোটিফিকেশন চালু করুন',
          pushDescription:
            'ঘোষণা ও আপডেটের ইনস্ট্যান্ট অ্যালার্ট পেতে পুশ নোটিফিকেশন চালু রাখা প্রয়োজন।',
          pushProgress: 'পুশ সেটআপ চলছে।',
          pushEnabled: 'পুশ নোটিফিকেশন চালু আছে।',
          pushDisabled: 'পুশ নোটিফিকেশন বর্তমানে বন্ধ আছে।',
          pushEnableBtn: 'পুশ চালু করুন',
          pushEnablingBtn: 'চালু করা হচ্ছে...',
          pushCloseBtn: 'বন্ধ করুন',
          pushSwitchBtn: 'English',
        }
      : {
          pushTitle: 'Enable Push Notifications',
          pushDescription:
            'Push notifications must stay enabled to receive instant alerts for announcements and updates.',
          pushProgress: 'Push setup is in progress.',
          pushEnabled: 'Push notifications are enabled.',
          pushDisabled: 'Push notifications are currently off.',
          pushEnableBtn: 'Enable Push',
          pushEnablingBtn: 'Enabling...',
          pushCloseBtn: 'Close',
          pushSwitchBtn: 'বাংলা',
        }
  }, [pushDialogLanguage])

  useEffect(() => {
    if (showPushCta) {
      setPushDialogLanguage('bn')
    }
  }, [showPushCta])

  useEffect(() => {
    if (!pushReady || pushEnabled || showPushCta) return undefined
    const timer = window.setTimeout(() => {
      setShowPushCta(true)
    }, PUSH_REMINDER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [pushReady, pushEnabled, showPushCta])

  useEffect(() => {
    if (!isTvMode || !notificationMenuOpen) return
    const frame = window.requestAnimationFrame(() => {
      const firstAction = notificationMenuRef.current?.querySelector(
        "[data-tv-menu-default='true']",
      )
      if (firstAction instanceof HTMLElement) firstAction.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isTvMode, notificationMenuOpen])

  useEffect(() => {
    if (!isTvMode || !userMenuOpen) return
    const frame = window.requestAnimationFrame(() => {
      const firstAction = userMenuRef.current?.querySelector(
        "[data-tv-menu-default='true']",
      )
      if (firstAction instanceof HTMLElement) firstAction.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isTvMode, userMenuOpen])

  useEffect(() => {
    let active = true
    const loadPinned = async () => {
      try {
        const res = await fetch('/api/client/announcements', {
          cache: 'no-store',
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || !active) return
        const items = Array.isArray(payload?.items) ? payload.items : []
        const speed = Math.min(
          80,
          Math.max(1, Math.round(Number(payload?.speed_seconds || 34))),
        )
        const iconText =
          String(payload?.icon_text || '•')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 16) || '•'
        setTickerSpeedSeconds(speed)
        setTickerIconText(iconText)
        const mapped = items
          .map((row) => {
            const useTitle = !!row?.show_title_in_ticker
            const title = stripHtml(row?.title || '')
            const body = stripHtml(row?.content_html || '')
            const bodyOnly = stripLeadingTitle(body, title)
            const text = useTitle ? title : bodyOnly || body || title
            return {
              id: String(row?.id || ''),
              title: title || 'Announcement',
              content_html: String(row?.content_html || ''),
              show_title_in_ticker: useTitle,
              text,
            }
          })
          .filter((row) => row.text)
        setTickerItems(mapped)
      } catch {
        if (active) {
          setTickerItems([])
          setTickerSpeedSeconds(34)
          setTickerIconText('•')
        }
      }
    }
    loadPinned()
    return () => {
      active = false
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    if (isGuest) {
      setNotifications([])
      setUnreadCount(0)
      setNotificationsLoading(false)
      setNotificationsError('')
      return
    }
    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      const res = await fetch('/api/client/notifications', {
        cache: 'no-store',
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(payload?.error || 'Failed to load notifications.')
      const items = Array.isArray(payload?.items) ? payload.items : []
      setNotifications(items)
      setUnreadCount(Math.max(0, Number(payload?.unread_count || 0)))
    } catch (err) {
      setNotificationsError(err?.message || 'Failed to load notifications.')
    } finally {
      setNotificationsLoading(false)
    }
  }, [isGuest])

  useEffect(() => {
    if (isGuest) return undefined
    loadNotifications()
    const timer = setInterval(loadNotifications, 60000)
    return () => clearInterval(timer)
  }, [loadNotifications, isGuest])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const nativeRuntime = isNativeAppRuntime(window)
    const browserInstallCtx = isBrowserInstallContext(window)
    setIsNativeRuntime(nativeRuntime)
    setIsBrowserInstallCtx(browserInstallCtx)
    if (nativeRuntime || !browserInstallCtx) {
      setIsIosInstallHint(false)
      setIsAndroidInstallHint(false)
      setDeferredInstallPrompt(null)
      setShowInstallCta(false)
      return undefined
    }
    const nav = window.navigator
    const ua = String(nav?.userAgent || '').toLowerCase()
    const isIos = /iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua) && !/windows phone/.test(ua)
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      nav?.standalone === true
    setIsIosInstallHint(isIos && !isStandalone)
    setIsAndroidInstallHint(isAndroid && !isStandalone)

    const syncCapturedPrompt = () => {
      const captured = window.__pwaDeferredInstallPrompt
      if (!captured?.prompt) return
      setDeferredInstallPrompt(captured)
      const dismissed = isInstallCtaDismissed(
        installDismissKeyRef.current,
        window,
      )
      setShowInstallCta(!dismissed)
    }

    syncCapturedPrompt()

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      window.__pwaDeferredInstallPrompt = event
      setDeferredInstallPrompt(event)
      const dismissed = isInstallCtaDismissed(
        installDismissKeyRef.current,
        window,
      )
      setShowInstallCta(!dismissed)
    }
    const onInstalled = () => {
      window.__pwaDeferredInstallPrompt = null
      setDeferredInstallPrompt(null)
      setIsIosInstallHint(false)
      setIsAndroidInstallHint(false)
      setShowInstallCta(false)
    }

    window.addEventListener('pwa-install-available', syncCapturedPrompt)
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('pwa-install-available', syncCapturedPrompt)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let checks = 0
    const timer = window.setInterval(() => {
      checks += 1
      const nativeRuntime = isNativeAppRuntime(window)
      const browserInstallCtx = isBrowserInstallContext(window)
      setIsNativeRuntime(nativeRuntime)
      setIsBrowserInstallCtx(browserInstallCtx)
      if (nativeRuntime || !browserInstallCtx) {
        setIsIosInstallHint(false)
        setIsAndroidInstallHint(false)
        setDeferredInstallPrompt(null)
        setShowInstallCta(false)
      }
      if (checks >= 10) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isNativeRuntime || !isBrowserInstallCtx) {
      setShowInstallCta(false)
      return
    }
    const shouldShow = Boolean(
      deferredInstallPrompt || isIosInstallHint || isAndroidInstallHint,
    )
    if (!shouldShow) {
      setShowInstallCta(false)
      return
    }
    const dismissed = isInstallCtaDismissed(
      installDismissKeyRef.current,
      window,
    )
    setShowInstallCta(!dismissed)
  }, [deferredInstallPrompt, isIosInstallHint, isAndroidInstallHint, isNativeRuntime, isBrowserInstallCtx])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register(SW_URL).catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isGuest) return
    const canPush =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    setPushReady(canPush)
    setPushEnabled(false)
    if (!canPush) return

    const initPush = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_URL)
        const existing = await registration.pushManager.getSubscription()
        setPushEnabled(Boolean(existing))
        if (existing) {
          await fetch('/api/client/push-subscriptions', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              subscription: existing,
              user_agent: navigator.userAgent,
            }),
          }).catch(() => {})
        } else {
          setShowPushCta(true)
        }
      } catch {
        setPushReady(false)
      }
    }
    initPush()
  }, [isGuest])

  const resolveVapidPublicKey = useCallback(async () => {
    if (isGuest) return ''
    const existing = String(vapidPublicKeyRef.current || '').trim()
    if (existing) return existing
    try {
      const res = await fetch('/api/client/push-config', { cache: 'no-store' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) return ''
      const key = String(payload?.public_key || '').trim()
      if (key) vapidPublicKeyRef.current = key
      return key
    } catch {
      return ''
    }
  }, [isGuest])

  const enablePushNotifications = useCallback(async () => {
    if (isGuest) return
    if (typeof window === 'undefined') return
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    )
      return
    const vapidPublicKey = await resolveVapidPublicKey()
    if (!vapidPublicKey) {
      setPushError('Push is not configured yet. Please try again later.')
      return
    }

    setPushBusy(true)
    setPushError('')
    try {
      const permission = await Notification.requestPermission()
      try {
        window.localStorage.setItem(pushPromptedKeyRef.current, '1')
      } catch {
        // ignore localStorage errors
      }
      setShowPushCta(false)
      if (permission !== 'granted') {
        setPushEnabled(false)
        return
      }

      const registration = await navigator.serviceWorker.register(SW_URL)
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }
      const saveRes = await fetch('/api/client/push-subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription, user_agent: navigator.userAgent }),
      })
      if (!saveRes.ok) throw new Error('Failed to enable push notifications.')
      setPushEnabled(true)
      setShowPushCta(false)
    } catch (err) {
      setPushEnabled(false)
      setShowPushCta(true)
      setPushError(err?.message || 'Failed to enable push notifications.')
    } finally {
      setPushBusy(false)
    }
  }, [resolveVapidPublicKey, isGuest])

  const disablePushNotifications = useCallback(async () => {
    if (isGuest) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    setPushBusy(true)
    setPushError('')
    try {
      const registration = await navigator.serviceWorker.register(SW_URL)
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setPushEnabled(false)
        return
      }
      const endpoint = String(subscription.endpoint || '').trim()
      await subscription.unsubscribe().catch(() => {})
      if (endpoint) {
        await fetch('/api/client/push-subscriptions', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {})
      }
      setPushEnabled(false)
      setShowPushCta(true)
    } catch (err) {
      setPushError(err?.message || 'Failed to disable push notifications.')
    } finally {
      setPushBusy(false)
    }
  }, [])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!(event.target instanceof Node)) return
      if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false)
      if (!notificationMenuRef.current?.contains(event.target))
        setNotificationMenuOpen(false)
    }
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
        setNotificationMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    window.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  async function markNotificationsRead({
    announcementId = '',
    markAll = false,
  } = {}) {
    if (isGuest) return false
    try {
      const res = await fetch('/api/client/notifications/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          markAll ? { mark_all: true } : { announcement_id: announcementId },
        ),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(payload?.error || 'Failed to update notifications.')
      await loadNotifications()
      return true
    } catch {
      return false
    }
  }

  async function triggerInstallPrompt() {
    if (isNativeRuntime || !isBrowserInstallCtx) return
    if (deferredInstallPrompt?.prompt) {
      try {
        await deferredInstallPrompt.prompt()
        const choice = await deferredInstallPrompt.userChoice.catch(() => null)
        if (choice?.outcome === 'accepted') {
          setShowInstallCta(false)
        }
      } catch {
        // ignore install prompt errors
      } finally {
        window.__pwaDeferredInstallPrompt = null
        setDeferredInstallPrompt(null)
      }
      return
    }
    if (isIosInstallHint) {
      window.alert(
        "To install this app on iPhone: tap Share, then choose 'Add to Home Screen'.",
      )
      return
    }
    if (isAndroidInstallHint) {
      if (isValidInstallUrl(ANDROID_APP_URL)) {
        window.location.href = ANDROID_APP_URL
        return
      }
      window.alert(getAndroidInstallHelpMessage(window))
    }
  }

  function dismissInstallCta() {
    setShowInstallCta(false)
    try {
      window.localStorage.setItem(
        installDismissKeyRef.current,
        String(Date.now()),
      )
    } catch {
      // ignore localStorage errors
    }
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (isGuest) return
    setError('')
    setMessage('')

    if (form.new_password && form.new_password.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (form.new_password && !form.current_password) {
      setError('Current password is required to set a new password.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/client/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          current_password: form.current_password,
          new_password: form.new_password,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(payload?.error || 'Failed to update profile.')
      const nextName = String(payload?.item?.full_name || '').trim()
      setDisplayName(nextName || displayName)
      setForm((prev) => ({ ...prev, current_password: '', new_password: '' }))
      setMessage('Profile updated.')
      setOpen(false)
    } catch (err) {
      setError(err?.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const canDownloadAndroidApp =
    !isNativeRuntime &&
    isBrowserInstallCtx &&
    isAndroidInstallHint &&
    !deferredInstallPrompt?.prompt &&
    isValidInstallUrl(ANDROID_APP_URL)
  const installTitle = canDownloadAndroidApp
    ? 'Install WEBTVBD Android App'
    : 'Install WEBTVBD App'
  const installSubtitle = canDownloadAndroidApp
    ? 'Browser prompt না এলে Android app directly install করুন।'
    : 'Get quick access from your mobile home screen.'
  const installButtonLabel = canDownloadAndroidApp ? 'Download App' : 'Install'

  return (
    <header
      className={`${styles.topNavbar} ${isDark ? styles.darkGlass : styles.lightGlass}`}
    >
      <div className={styles.topLeft}>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={onToggleLeftSidebar}
          className={`${styles.iconBtn} ${styles.mobileOnly}`}
          data-tv-focusable='true'
          data-tv-focus-scope='top-nav'
          data-tv-focus-id='topnav-menu'
          data-tv-default-focus='true'
        >
          <Icon name='Menu' size={18} />
        </Button>
        <Link
          href='/'
          className={styles.brandWrap}
          data-tv-focusable='true'
          data-tv-focus-scope='top-nav'
          data-tv-focus-id='topnav-home'
        >
          <div className={styles.brandLogo}>
            <img
              src='/favicon-32x32.png'
              alt='WEBTVBD'
              className={styles.brandLogoImg}
            />
          </div>
          <h1 className={styles.brandText}>WEBTVBD</h1>
        </Link>
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
        {showChannelMenu ? (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={onToggleRightPanel}
            className={`${styles.iconBtn} ${styles.mobileOnly}`}
            data-tv-focusable='true'
            data-tv-focus-scope='top-nav'
            data-tv-focus-id='topnav-channels'
          >
            <Icon name='Grid3x3' size={18} />
          </Button>
        ) : null}
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={onToggleTvMode}
          className={`${styles.iconBtn} ${styles.tvControl} ${isTvMode ? styles.tvBtnActive : ''}`}
          title='Toggle TV Remote Mode'
          aria-label='Toggle TV Remote Mode'
          data-tv-focusable='true'
          data-tv-focus-scope='top-nav'
          data-tv-focus-id='topnav-tv-mode'
          data-tv-active={isTvMode ? 'true' : 'false'}
        >
          <Icon name='MonitorPlay' size={18} />
        </Button>
        {!isNativeRuntime &&
        isBrowserInstallCtx &&
        (deferredInstallPrompt || isIosInstallHint || isAndroidInstallHint) ? (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={triggerInstallPrompt}
            className={styles.iconBtn}
            title='Install App'
            aria-label='Install App'
            data-tv-focusable='true'
            data-tv-focus-scope='top-nav'
            data-tv-focus-id='topnav-install'
          >
            <Icon name='Download' size={18} />
          </Button>
        ) : null}
        <div className={styles.notificationMenuWrap} ref={notificationMenuRef}>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className={styles.iconBtn}
            title='Notifications'
            aria-haspopup='menu'
            aria-expanded={notificationMenuOpen}
            onClick={() => {
              setUserMenuOpen(false)
              const nextOpen = !notificationMenuOpen
              setNotificationMenuOpen(nextOpen)
              if (nextOpen) loadNotifications()
            }}
            data-tv-focusable='true'
            data-tv-focus-scope='top-nav'
            data-tv-focus-id='topnav-notifications'
            data-tv-active={notificationMenuOpen ? 'true' : 'false'}
          >
            <Icon name='Bell' size={18} />
            {unreadCount > 0 ? (
              <span className={styles.badge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Button>
          {notificationMenuOpen ? (
            <div
              className={styles.notificationDropdown}
              role='menu'
              aria-label='Notifications'
            >
              <div className={styles.notificationHeader}>
                <strong>Notifications</strong>
                <div className={styles.notificationHeaderActions}>
                  {pushReady ? (
                    <button
                      type='button'
                      className={`${styles.notificationMarkAllBtn} ${styles.pushHeaderBtn} ${pushEnabled ? styles.pushBtnActive : styles.pushBtnInactive}`}
                      onClick={
                        pushEnabled
                          ? disablePushNotifications
                          : enablePushNotifications
                      }
                      title={
                        pushEnabled
                          ? 'Push: ON (click to disable)'
                          : 'Push: OFF (click to enable)'
                      }
                      aria-label={
                        pushEnabled
                          ? 'Push notification is ON. Click to disable.'
                          : 'Push notification is OFF. Click to enable.'
                      }
                      disabled={pushBusy}
                      data-tv-focusable='true'
                      data-tv-focus-scope='top-nav'
                      data-tv-focus-id='topnav-menu-push-toggle'
                      data-tv-menu-default='true'
                    >
                      <Icon
                        name={pushEnabled ? 'BellRing' : 'BellOff'}
                        size={14}
                      />
                      <span>
                        {pushBusy
                          ? '...'
                          : pushEnabled
                            ? 'Push ON'
                            : 'Push OFF'}
                      </span>
                      <span
                        className={`${styles.pushStateDot} ${pushEnabled ? styles.pushStateDotOn : styles.pushStateDotOff}`}
                        aria-hidden='true'
                      />
                    </button>
                  ) : null}
                  <span>{unreadCount} unread</span>
                  <button
                    type='button'
                    className={styles.notificationMarkAllBtn}
                    disabled={!notifications.length || unreadCount <= 0}
                    onClick={() => markNotificationsRead({ markAll: true })}
                    data-tv-focusable='true'
                    data-tv-focus-scope='top-nav'
                    data-tv-focus-id='topnav-menu-mark-read'
                  >
                    Mark all read
                  </button>
                </div>
              </div>
              <div className={styles.notificationList}>
                {notificationsLoading ? (
                  <p className={styles.notificationState}>Loading...</p>
                ) : null}
                {notificationsError && !notificationsLoading ? (
                  <p className={styles.notificationState}>
                    {notificationsError}
                  </p>
                ) : null}
                {!notificationsLoading &&
                !notificationsError &&
                !notifications.length ? (
                  <p className={styles.notificationState}>
                    No notifications yet.
                  </p>
                ) : null}
                {!notificationsLoading && !notificationsError
                  ? notifications.map((item) => (
                      <button
                        key={item.id}
                        type='button'
                        className={`${styles.notificationItem} ${item.is_read ? styles.notificationItemRead : ''}`}
                        role='menuitem'
                        onClick={async () => {
                          if (!item.is_read)
                            await markNotificationsRead({
                              announcementId: item.id,
                            })
                          setNotificationMenuOpen(false)
                          if (
                            String(item.content_type || '').trim().toLowerCase() ===
                              'article' &&
                            String(item.path || '').startsWith('/articles/')
                          ) {
                            window.open(String(item.path), '_blank', 'noopener,noreferrer')
                            return
                          }
                          setActiveTickerArticle({
                            id: item.id,
                            title: item.title || 'Announcement',
                            content_html: item.content_html || '',
                          })
                        }}
                        data-tv-focusable='true'
                        data-tv-focus-scope='top-nav'
                        data-tv-focus-id={`topnav-notification-${item.id}`}
                      >
                        <div className={styles.notificationItemTop}>
                          <span className={styles.notificationItemTitle}>
                            {item.title || 'Announcement'}
                          </span>
                          {!item.is_read ? (
                            <span
                              className={styles.notificationDot}
                              aria-hidden='true'
                            />
                          ) : null}
                        </div>
                        <span className={styles.notificationItemMeta}>
                          {item.updated_at
                            ? new Date(item.updated_at).toLocaleString()
                            : 'Recently updated'}
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
            setOpen(nextOpen)
            if (nextOpen) {
              setUserMenuOpen(false)
              setNotificationMenuOpen(false)
            }
          }}
        >
          <AlertDialogContent className={styles.profileModal}>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Profile</AlertDialogTitle>
              <AlertDialogDescription>
                You can update your name and password. Email and mobile are
                currently locked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form onSubmit={saveProfile} className={styles.profileForm}>
              <label className={styles.profileField}>
                <span>Full Name</span>
                <input
                  type='text'
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  placeholder='Your display name'
                />
              </label>
              <label className={styles.profileField}>
                <span>Email Address (Locked)</span>
                <input
                  type='text'
                  value={readonlyEmail || '-'}
                  readOnly
                  disabled
                />
              </label>
              <label className={styles.profileField}>
                <span>Mobile Number (Locked)</span>
                <input
                  type='text'
                  value={readonlyMobile || '-'}
                  readOnly
                  disabled
                />
              </label>
              <label className={styles.profileField}>
                <span>Current Password</span>
                <div className={styles.passwordInputWrap}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={form.current_password}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        current_password: e.target.value,
                      }))
                    }
                    placeholder='Required only for password change'
                  />
                  <button
                    type='button'
                    className={styles.passwordToggle}
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={
                      showCurrentPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    <Icon
                      name={showCurrentPassword ? 'EyeOff' : 'Eye'}
                      size={16}
                    />
                  </button>
                </div>
              </label>
              <label className={styles.profileField}>
                <span>New Password</span>
                <div className={styles.passwordInputWrap}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={form.new_password}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        new_password: e.target.value,
                      }))
                    }
                    minLength={8}
                    placeholder='Leave empty if no change'
                  />
                  <button
                    type='button'
                    className={styles.passwordToggle}
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={
                      showNewPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    <Icon name={showNewPassword ? 'EyeOff' : 'Eye'} size={16} />
                  </button>
                </div>
              </label>
              {error ? <p className={styles.profileError}>{error}</p> : null}
              {message ? (
                <p className={styles.profileSuccess}>{message}</p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <button type='button' className={styles.profileSecondaryBtn}>
                    Cancel
                  </button>
                </AlertDialogCancel>
                <button
                  type='submit'
                  className={styles.profilePrimaryBtn}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
        <div className={styles.userMenuWrap} ref={userMenuRef}>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className={styles.iconBtn}
            title='Profile Menu'
            aria-haspopup='menu'
            aria-expanded={userMenuOpen}
            onClick={() => {
              if (typeof onProfileIconClick === 'function') onProfileIconClick()
              setNotificationMenuOpen(false)
              setUserMenuOpen((prev) => !prev)
            }}
            data-tv-focusable='true'
            data-tv-focus-scope='top-nav'
            data-tv-focus-id='topnav-profile'
            data-tv-active={userMenuOpen ? 'true' : 'false'}
          >
            <Icon name='User' size={18} />
          </Button>
          {userMenuOpen ? (
            <div
              className={styles.userMenuDropdown}
              role='menu'
              aria-label='User menu'
            >
              <div className={styles.userMenuHeader}>
                <strong title={displayName || 'Client'}>
                  {displayName || 'Client'}
                </strong>
                <span title={readonlyEmail || '-'}>{readonlyEmail || '-'}</span>
              </div>
              {isGuest ? (
                <Link
                  href='/client-login'
                  className={styles.userMenuItem}
                  role='menuitem'
                  data-tv-focusable='true'
                  data-tv-focus-scope='top-nav'
                  data-tv-focus-id='topnav-user-login'
                  data-tv-menu-default='true'
                >
                  <Icon name='User' size={16} />
                  Login
                </Link>
              ) : (
                <>
                  <button
                    type='button'
                    className={styles.userMenuItem}
                    role='menuitem'
                    onClick={() => {
                      setOpen(true)
                      setUserMenuOpen(false)
                    }}
                    data-tv-focusable='true'
                    data-tv-focus-scope='top-nav'
                    data-tv-focus-id='topnav-user-edit'
                    data-tv-menu-default='true'
                  >
                    <Icon name='Settings' size={16} />
                    Edit Profile
                  </button>
                  <form action='/api/client/auth/logout' method='post'>
                    <button
                      type='submit'
                      className={`${styles.userMenuItem} ${styles.userMenuItemDanger}`}
                      role='menuitem'
                      data-tv-focusable='true'
                      data-tv-focus-scope='top-nav'
                      data-tv-focus-id='topnav-user-logout'
                    >
                      <Icon name='LogOut' size={16} />
                      Logout
                    </button>
                  </form>
                </>
              )}
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
      {showInstallCta && !isNativeRuntime && isBrowserInstallCtx ? (
        <div
          className={styles.mobileActionPrompt}
          role='status'
          aria-live='polite'
        >
          <div className={styles.mobileActionPromptText}>
            <strong>{installTitle}</strong>
            <span>{installSubtitle}</span>
          </div>
          <div className={styles.mobileActionPromptActions}>
            <button
              type='button'
              className={styles.mobilePromptBtn}
              onClick={triggerInstallPrompt}
            >
              <Icon name='Download' size={14} />
              {installButtonLabel}
            </button>
            <button
              type='button'
              className={styles.mobilePromptGhostBtn}
              onClick={dismissInstallCta}
            >
              Later
            </button>
          </div>
        </div>
      ) : null}
      {pushError ? <p className={styles.pushInlineError}>{pushError}</p> : null}

      <AlertDialog
        open={showPushCta && pushReady}
        onOpenChange={(nextOpen) => {
          if (!pushReady) return
          setShowPushCta(nextOpen)
        }}
      >
        <AlertDialogContent className={`${styles.profileModal} ${styles.pushModal}`}>
          <AlertDialogHeader>
            <AlertDialogTitle
              style={{
                fontSize:
                  pushDialogLanguage === 'bn'
                    ? 'clamp(16px, 4.8vw, 30px)'
                    : 'clamp(18px, 4.6vw, 28px)',
                lineHeight: 1.2,
                letterSpacing: '-0.03em',
                whiteSpace: 'nowrap',
              }}
            >
              {copy.pushTitle}
            </AlertDialogTitle>
            <AlertDialogDescription
              style={{
                fontSize: pushDialogLanguage === 'bn' ? '18px' : '17px',
                lineHeight: pushDialogLanguage === 'bn' ? 1.7 : 1.65,
              }}
            >
              {copy.pushDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className={styles.pushModalBody}>
            <div className={styles.pushModalLanguageRow}>
              <button
                type='button'
                className={styles.profileSecondaryBtn}
                onClick={() =>
                  setPushDialogLanguage((prev) => (prev === 'en' ? 'bn' : 'en'))
                }
              >
                {copy.pushSwitchBtn}
              </button>
            </div>
            <p
              className={styles.pushModalStatus}
              style={{
                margin: 0,
                fontSize: pushDialogLanguage === 'bn' ? '16px' : '15px',
                lineHeight: pushDialogLanguage === 'bn' ? 1.7 : 1.6,
              }}
            >
              <span>
                {pushBusy
                  ? copy.pushProgress
                  : pushEnabled
                    ? copy.pushEnabled
                    : copy.pushDisabled}
              </span>
            </p>
          </div>
          <AlertDialogFooter>
            <button
              type='button'
              className={styles.profileSecondaryBtn}
              onClick={() => setShowPushCta(false)}
              disabled={pushBusy}
            >
              {copy.pushCloseBtn}
            </button>
            <button
              type='button'
              className={styles.profilePrimaryBtn}
              onClick={enablePushNotifications}
              disabled={pushBusy}
            >
              {pushBusy ? copy.pushEnablingBtn : copy.pushEnableBtn}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!activeTickerArticle}
        onOpenChange={(openState) => {
          if (!openState) setActiveTickerArticle(null)
        }}
      >
        <AlertDialogContent className={styles.announcementArticleModal}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {activeTickerArticle?.title || 'Announcement'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Full article view from pinned announcement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className={styles.announcementArticleBody}
            dangerouslySetInnerHTML={{
              __html: activeTickerArticle?.content_html || '',
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type='button' variant='outline'>
                Close
              </Button>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
