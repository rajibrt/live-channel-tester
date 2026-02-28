'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bell,
  CircleUserRound,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Megaphone,
  MonitorPlay,
  Tv,
  Users,
} from 'lucide-react'
import styles from './dashboard-shell.module.css'

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    label: 'Content',
    items: [
      { href: '/dashboard/playlists', label: 'Playlists', icon: ListVideo },
      { href: '/dashboard/channels', label: 'Add New Channel', icon: Tv },
      { href: '/dashboard/announcements', label: 'Announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/local-check', label: 'Local Check', icon: Activity },
    ],
  },
  {
    label: 'Access',
    items: [{ href: '/dashboard/clients', label: 'Clients', icon: Users }],
  },
]

function sectionMeta(pathname) {
  if (!pathname) return { title: 'Overview', subtitle: 'Admin control center' }
  if (pathname === '/dashboard')
    return { title: 'Overview', subtitle: 'Admin control center' }
  if (pathname.startsWith('/dashboard/playlists/')) {
    const slug = pathname.split('/').filter(Boolean).at(-1) || 'playlist'
    return { title: 'Playlist Editor', subtitle: `Editing: ${slug}` }
  }
  if (pathname.startsWith('/dashboard/playlists')) {
    return {
      title: 'Playlists',
      subtitle: 'Manage playlists and public token links',
    }
  }
  if (pathname.startsWith('/dashboard/channels')) {
    return {
      title: 'Add New Channel',
      subtitle: 'Manage channel metadata and assignments',
    }
  }
  if (pathname.startsWith('/dashboard/announcements')) {
    return {
      title: 'Announcements',
      subtitle: 'Publish updates, notices, and article posts',
    }
  }
  if (pathname.startsWith('/dashboard/local-check')) {
    return {
      title: 'Local Check',
      subtitle: 'Run route-aware stream health verification',
    }
  }
  if (pathname.startsWith('/dashboard/clients')) {
    return {
      title: 'Client Users',
      subtitle: 'Create and control viewer login accounts',
    }
  }
  return { title: 'Dashboard', subtitle: 'Admin workspace' }
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushReady, setPushReady] = useState(false)
  const lastUnreadRef = useRef(0)
  const notificationMenuRef = useRef(null)
  const meta = useMemo(() => sectionMeta(pathname), [pathname])

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
        if (!res.ok) throw new Error(payload?.error || 'Failed to load notifications.')
        const items = Array.isArray(payload?.items) ? payload.items : []
        setNotifications(items)
        setUnreadCount(Math.max(0, Number(payload?.unread_count || 0)))
      } catch (err) {
        if (!active) return
        setNotificationError(err?.message || 'Failed to load notifications.')
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
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const canPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushReady(canPush)
    if (!canPush) return

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        const existing = await registration.pushManager.getSubscription()
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
      new Notification(top.title || 'New admin notification', {
        body: String(top.message || '').slice(0, 160),
      })
    } catch {
      // ignore notification runtime errors
    }
  }, [unreadCount, notifications])

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

  const enablePushNotifications = async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    const vapidPublicKey = String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim()
    if (!vapidPublicKey) {
      window.alert('Push is not configured yet. Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.')
      return
    }

    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushBusy(false)
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      await fetch('/api/admin/push-subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription, user_agent: navigator.userAgent }),
      })
    } catch {
      // ignore push setup errors
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
          {NAV_GROUPS.map((group) => (
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
            <span>Open Client View</span>
          </Link>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          aria-label='Close sidebar'
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
              <CircleUserRound size={16} aria-hidden='true' />
              Menu
            </button>
            <p className={styles.headerKicker}>Dashboard</p>
            <h2 className={styles.headerTitle}>{meta.title}</h2>
            <p className={styles.headerSubtitle}>{meta.subtitle}</p>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.notificationMenuWrap} ref={notificationMenuRef}>
              <button
                type='button'
                className={styles.iconBtn}
                aria-label='Admin notifications'
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
                <div className={styles.notificationDropdown} role='menu' aria-label='Admin notifications'>
                <div className={styles.notificationHeader}>
                  <strong>Notifications</strong>
                  <div className={styles.notificationHeaderActions}>
                    <button
                      type='button'
                      className={styles.notificationMarkAllBtn}
                      disabled={unreadCount <= 0}
                      onClick={() => markNotificationsRead({ markAll: true })}
                    >
                      Mark all read
                    </button>
                    <button
                      type='button'
                      className={styles.notificationMarkAllBtn}
                      disabled={!pushReady || pushBusy}
                      onClick={enablePushNotifications}
                    >
                      {pushBusy ? 'Enabling...' : 'Enable Push'}
                    </button>
                  </div>
                </div>
                  <div className={styles.notificationList}>
                    {notificationsLoading ? <p className={styles.notificationState}>Loading...</p> : null}
                    {notificationError && !notificationsLoading ? <p className={styles.notificationState}>{notificationError}</p> : null}
                    {!notificationsLoading && !notificationError && !notifications.length ? (
                      <p className={styles.notificationState}>No notifications yet.</p>
                    ) : null}
                    {!notificationsLoading && !notificationError
                      ? notifications.map((item) => (
                          <button
                            key={item.id}
                            type='button'
                            className={`${styles.notificationItem} ${item.is_read ? styles.notificationItemRead : ''}`}
                            role='menuitem'
                            onClick={async () => {
                              if (!item.is_read) await markNotificationsRead({ notificationId: item.id })
                            }}
                          >
                            <div className={styles.notificationItemTop}>
                              <span className={styles.notificationItemTitle}>{item.title || 'Notification'}</span>
                              {!item.is_read ? <span className={styles.notificationDot} aria-hidden='true' /> : null}
                            </div>
                            <span className={styles.notificationItemMeta}>
                              {item.message || '-'}
                            </span>
                            <span className={styles.notificationItemMeta}>
                              {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently'}
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
                <span>Logout</span>
              </button>
            </form>
          </div>
        </header>

        <section className={styles.content}>{children}</section>
      </main>
    </div>
  )
}
