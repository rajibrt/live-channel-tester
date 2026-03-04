'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bell,
  Film,
  Languages,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Menu,
  Megaphone,
  MonitorPlay,
  Settings,
  Tv,
  Users,
  X,
} from 'lucide-react'
import styles from './dashboard-shell.module.css'
import { useI18n } from '../../components/i18n/LanguageProvider'

const BUILD_VERSION = String(process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev').trim() || 'dev'
const SW_URL = `/sw.js?v=${encodeURIComponent(BUILD_VERSION)}`
const nextLocale = (locale) => (locale === 'bn' ? 'en' : 'bn')

function createNavGroups(t) {
  return [
    {
      label: t('dashboardShell.groupMain'),
      items: [{ href: '/dashboard', label: t('dashboardShell.navOverview'), icon: LayoutDashboard }],
    },
    {
      label: t('dashboardShell.groupContent'),
      items: [
        { href: '/dashboard/playlists', label: t('dashboardShell.navPlaylists'), icon: ListVideo },
        { href: '/dashboard/channels', label: t('dashboardShell.navAddChannel'), icon: Tv },
        { href: '/dashboard/movies', label: t('dashboardShell.navMovies'), icon: Film },
        { href: '/dashboard/announcements', label: t('dashboardShell.navAnnouncements'), icon: Megaphone },
      ],
    },
    {
      label: t('dashboardShell.groupOperations'),
      items: [{ href: '/dashboard/local-check', label: t('dashboardShell.navLocalCheck'), icon: Activity }],
    },
    {
      label: t('dashboardShell.groupAccess'),
      items: [{ href: '/dashboard/clients', label: t('dashboardShell.navClients'), icon: Users }],
    },
    {
      label: t('dashboardShell.groupSystem'),
      items: [{ href: '/dashboard/settings', label: t('dashboardShell.navSettings'), icon: Settings }],
    },
  ]
}

function sectionMeta(pathname, t) {
  if (!pathname) return { title: t('dashboardShell.titleOverview'), subtitle: t('dashboardShell.subtitleOverview') }
  if (pathname === '/dashboard')
    return { title: t('dashboardShell.titleOverview'), subtitle: t('dashboardShell.subtitleOverview') }
  if (pathname.startsWith('/dashboard/playlists/')) {
    const slug = pathname.split('/').filter(Boolean).at(-1) || 'playlist'
    return { title: t('dashboardShell.titlePlaylistEditor'), subtitle: `${t('dashboardShell.subtitleEditing')} ${slug}` }
  }
  if (pathname.startsWith('/dashboard/playlists')) {
    return {
      title: t('dashboardShell.titlePlaylists'),
      subtitle: t('dashboardShell.subtitlePlaylists'),
    }
  }
  if (pathname.startsWith('/dashboard/channels')) {
    return {
      title: t('dashboardShell.titleAddChannel'),
      subtitle: t('dashboardShell.subtitleAddChannel'),
    }
  }
  if (pathname.startsWith('/dashboard/movies')) {
    return {
      title: t('dashboardShell.titleMovies'),
      subtitle: t('dashboardShell.subtitleMovies'),
    }
  }
  if (pathname.startsWith('/dashboard/announcements')) {
    return {
      title: t('dashboardShell.titleAnnouncements'),
      subtitle: t('dashboardShell.subtitleAnnouncements'),
    }
  }
  if (pathname.startsWith('/dashboard/local-check')) {
    return {
      title: t('dashboardShell.titleLocalCheck'),
      subtitle: t('dashboardShell.subtitleLocalCheck'),
    }
  }
  if (pathname.startsWith('/dashboard/settings')) {
    return {
      title: t('dashboardShell.titleSettings'),
      subtitle: t('dashboardShell.subtitleSettings'),
    }
  }
  if (pathname.startsWith('/dashboard/clients')) {
    return {
      title: t('dashboardShell.titleClients'),
      subtitle: t('dashboardShell.subtitleClients'),
    }
  }
  return { title: t('dashboardShell.titleDashboard'), subtitle: t('dashboardShell.subtitleDashboard') }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function DashboardShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { locale, setLocale, t } = useI18n()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushReady, setPushReady] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const vapidPublicKeyRef = useRef(String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim())
  const lastUnreadRef = useRef(0)
  const notificationMenuRef = useRef(null)
  const meta = useMemo(() => sectionMeta(pathname, t), [pathname, t])
  const navGroups = useMemo(() => createNavGroups(t), [t])

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  useEffect(() => {
    let active = true
    const loadNotifications = async () => {
      setNotificationsLoading(true)
      setNotificationError('')
      try {
        const res = await fetch('/api/admin/notifications', { cache: 'no-store' })
        const payload = await res.json().catch(() => ({}))
        if (!active) return
        if (!res.ok) throw new Error(payload?.error || t('dashboardShell.failedLoadNotifications'))
        const items = Array.isArray(payload?.items) ? payload.items : []
        setNotifications(items)
        setUnreadCount(Math.max(0, Number(payload?.unread_count || 0)))
      } catch (err) {
        if (!active) return
        setNotificationError(err?.message || t('dashboardShell.failedLoadNotifications'))
      } finally {
        if (active) setNotificationsLoading(false)
      }
    }
    loadNotifications()
    const timer = setInterval(loadNotifications, 30000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [t])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const canPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushReady(canPush)
    setPushEnabled(false)
    if (!canPush) return

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_URL)
        const existing = await registration.pushManager.getSubscription()
        setPushEnabled(Boolean(existing))
        if (existing) {
          await fetch('/api/admin/push-subscriptions', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subscription: existing, user_agent: navigator.userAgent }),
          }).catch(() => {})
        }
      } catch {
        // ignore service worker registration failure
      }
    }
    registerServiceWorker()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prev = Number(lastUnreadRef.current || 0)
    const next = Number(unreadCount || 0)
    lastUnreadRef.current = next
    if (next <= prev) return
    if (!notifications.length) return
    const top = notifications.find((item) => !item?.is_read) || notifications[0]
    if (!top) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return
    try {
      new Notification(top.title || t('dashboardShell.newAdminNotification'), {
        body: String(top.message || '').slice(0, 160),
      })
    } catch {
      // ignore notification runtime errors
    }
  }, [unreadCount, notifications, t])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!(event.target instanceof Node)) return
      if (!notificationMenuRef.current?.contains(event.target)) setNotificationMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [])

  const markNotificationsRead = async ({ notificationId = '', markAll = false } = {}) => {
    try {
      const res = await fetch('/api/admin/notifications/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(markAll ? { mark_all: true } : { notification_id: notificationId }),
      })
      if (!res.ok) return false
      setNotifications((prev) =>
        prev.map((item) =>
          markAll || String(item?.id || '') === String(notificationId)
            ? { ...item, is_read: true, read_at: new Date().toISOString() }
            : item
        )
      )
      setUnreadCount((prev) => (markAll ? 0 : Math.max(0, prev - 1)))
      return true
    } catch {
      return false
    }
  }

  const resolveNotificationUserId = (item) => {
    const payload = item?.payload_json && typeof item.payload_json === 'object' ? item.payload_json : {}
    const candidates = [
      payload?.user_id,
      payload?.client_user_id,
      payload?.client_id,
      payload?.userId,
    ]
    for (const candidate of candidates) {
      const id = String(candidate || '').trim()
      if (id) return id
    }
    return ''
  }

  const onNotificationClick = async (item) => {
    if (!item) return
    if (!item.is_read) await markNotificationsRead({ notificationId: item.id })

    const userId = resolveNotificationUserId(item)
    setNotificationMenuOpen(false)
    if (!userId) return

    if (pathname?.startsWith('/dashboard/clients')) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('admin-open-client-user', {
            detail: { userId, source: 'admin_notification', notificationId: String(item?.id || '') },
          })
        )
      }
      return
    }

    const params = new URLSearchParams({
      openUser: userId,
      openSource: 'admin_notification',
      notif: String(item?.id || ''),
    })
    router.push(`/dashboard/clients?${params.toString()}`)
  }

  const resolveVapidPublicKey = async () => {
    const existing = String(vapidPublicKeyRef.current || '').trim()
    if (existing) return existing
    try {
      const res = await fetch('/api/admin/push-config', { cache: 'no-store' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) return ''
      const key = String(payload?.public_key || '').trim()
      if (key) vapidPublicKeyRef.current = key
      return key
    } catch {
      return ''
    }
  }

  const enablePushNotifications = async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    const vapidPublicKey = await resolveVapidPublicKey()
    if (!vapidPublicKey) {
      window.alert(t('dashboardShell.pushNotConfigured'))
      return
    }

    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushBusy(false)
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

      const saveRes = await fetch('/api/admin/push-subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription, user_agent: navigator.userAgent }),
      })
      if (!saveRes.ok) throw new Error(t('dashboardShell.failedSavePushSubscription'))
      setPushEnabled(true)
    } catch {
      setPushEnabled(false)
      // ignore push setup errors
    } finally {
      setPushBusy(false)
    }
  }

  const disablePushNotifications = async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    setPushBusy(true)
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
        await fetch('/api/admin/push-subscriptions', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {})
      }
      setPushEnabled(false)
    } catch {
      // ignore push disable errors
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.sidebarTop}>
          <div className={styles.brandMark}>IP</div>
          <div>
            <p className={styles.brandKicker}>Admin Workspace</p>
            <h1 className={styles.brandTitle}>WEBTVBD</h1>
          </div>
        </div>

        <nav className={styles.navWrap}>
          {navGroups.map((group) => (
            <section key={group.label} className={styles.navGroup}>
              <p className={styles.groupLabel}>{group.label}</p>
              <div className={styles.navList}>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <item.icon size={16} aria-hidden='true' />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href='/' className={styles.viewerLink}>
            <MonitorPlay size={16} aria-hidden='true' />
            <span>{t('dashboardShell.openClientView')}</span>
          </Link>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          aria-label={t('dashboardShell.closeSidebar')}
        />
      ) : null}

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              type='button'
              className={styles.mobileMenuBtn}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={16} aria-hidden='true' /> : <Menu size={16} aria-hidden='true' />}
              {t('common.menu')}
            </button>
            <p className={styles.headerKicker}>{t('common.dashboard')}</p>
            <h2 className={styles.headerTitle}>{meta.title}</h2>
            <p className={styles.headerSubtitle}>{meta.subtitle}</p>
          </div>
          <div className={styles.headerRight}>
            <button
              type='button'
              className={`${styles.iconBtn} ${styles.languageBtn}`}
              aria-label={`${t('dashboardShell.language')}: ${locale.toUpperCase()}`}
              onClick={() => {
                const selectedLocale = nextLocale(locale)
                setLocale(selectedLocale)
                router.refresh()
              }}
            >
              <Languages size={16} aria-hidden='true' />
              <span>{locale === 'bn' ? 'বাংলা' : 'EN'}</span>
            </button>
            <div className={styles.notificationMenuWrap} ref={notificationMenuRef}>
              <button
                type='button'
                className={styles.iconBtn}
                aria-label={t('dashboardShell.adminNotifications')}
                aria-haspopup='menu'
                aria-expanded={notificationMenuOpen}
                onClick={() => {
                  setNotificationMenuOpen((prev) => !prev)
                  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission().catch(() => {})
                  }
                }}
              >
                <Bell size={16} aria-hidden='true' />
                {unreadCount > 0 ? <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
              </button>
              {notificationMenuOpen ? (
                <div className={styles.notificationDropdown} role='menu' aria-label={t('dashboardShell.adminNotifications')}>
                <div className={styles.notificationHeader}>
                  <strong>{t('dashboardShell.notifications')}</strong>
                  <div className={styles.notificationHeaderActions}>
                    <button
                      type='button'
                      className={styles.notificationMarkAllBtn}
                      disabled={unreadCount <= 0}
                      onClick={() => markNotificationsRead({ markAll: true })}
                    >
                      {t('dashboardShell.markAllRead')}
                    </button>
                    <button
                      type='button'
                      className={`${styles.notificationMarkAllBtn} ${pushEnabled ? styles.notificationPushEnabledBtn : ''}`}
                      disabled={!pushReady || pushBusy}
                      onClick={pushEnabled ? disablePushNotifications : enablePushNotifications}
                    >
                      {pushBusy
                        ? (pushEnabled ? t('dashboardShell.disabling') : t('dashboardShell.enabling'))
                        : pushEnabled
                          ? t('dashboardShell.disablePush')
                          : t('dashboardShell.enablePush')}
                    </button>
                  </div>
                </div>
                  <div className={styles.notificationList}>
                    {notificationsLoading ? <p className={styles.notificationState}>{t('common.loading')}</p> : null}
                    {notificationError && !notificationsLoading ? <p className={styles.notificationState}>{notificationError}</p> : null}
                    {!notificationsLoading && !notificationError && !notifications.length ? (
                      <p className={styles.notificationState}>{t('dashboardShell.noNotifications')}</p>
                    ) : null}
                    {!notificationsLoading && !notificationError
                      ? notifications.map((item) => (
                          <button
                            key={item.id}
                            type='button'
                            className={`${styles.notificationItem} ${item.is_read ? styles.notificationItemRead : ''}`}
                            role='menuitem'
                            onClick={() => onNotificationClick(item)}
                          >
                            <div className={styles.notificationItemTop}>
                              <span className={styles.notificationItemTitle}>{item.title || t('dashboardShell.notifications')}</span>
                              {!item.is_read ? <span className={styles.notificationDot} aria-hidden='true' /> : null}
                            </div>
                            <span className={styles.notificationItemMeta}>
                              {item.message || '-'}
                            </span>
                            <span className={styles.notificationItemMeta}>
                              {item.created_at ? new Date(item.created_at).toLocaleString() : t('common.unknown')}
                            </span>
                          </button>
                        ))
                      : null}
                  </div>
                </div>
              ) : null}
            </div>
            <form action='/api/auth/logout' method='post'>
              <button type='submit' className={styles.logoutBtn}>
                <LogOut size={16} aria-hidden='true' />
                <span>{t('common.logout')}</span>
              </button>
            </form>
          </div>
        </header>

        <section className={styles.content}>{children}</section>
      </main>
    </div>
  )
}
