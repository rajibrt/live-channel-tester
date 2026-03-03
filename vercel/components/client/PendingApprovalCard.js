'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Copy, LogOut } from 'lucide-react'

function normalizeMessengerUrl(rawUrl) {
  const raw = String(rawUrl || '').trim()
  if (!raw) return 'https://www.facebook.com/messages/t/WEBTVBD'
  const normalized = /^https?:\/\//i.test(raw)
    ? raw
    : `https://${raw.replace(/^\/+/, '')}`
  return normalized
}

function toMobileMessengerUrl(rawUrl) {
  const normalized = normalizeMessengerUrl(rawUrl)
  try {
    const url = new URL(normalized)
    const host = String(url.hostname || '').toLowerCase()
    const parts = String(url.pathname || '')
      .split('/')
      .filter(Boolean)

    if (
      host.includes('facebook.com') &&
      parts[0] === 'messages' &&
      parts[1] === 't' &&
      parts[2]
    ) {
      return `https://m.me/${parts[2]}`
    }
    if (
      host.includes('facebook.com') &&
      parts.length === 1 &&
      parts[0] &&
      !['profile.php', 'pages'].includes(parts[0].toLowerCase())
    ) {
      return `https://m.facebook.com/messages/t/${parts[0]}`
    }
    return normalized
  } catch {
    return normalized
  }
}

function isSmallScreenNow() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 820px)').matches
}

const DEFAULT_FB_INBOX_URL = normalizeMessengerUrl(
  process.env.NEXT_PUBLIC_FACEBOOK_INBOX_URL ||
    'https://www.facebook.com/messages/t/WEBTVBD',
)

function toDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

export default function PendingApprovalCard({
  isRejected = false,
  initialMobile = '',
}) {
  const [mobile, setMobile] = useState(String(initialMobile || ''))
  const [approvalMessage, setApprovalMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [messengerUrl, setMessengerUrl] = useState(DEFAULT_FB_INBOX_URL)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [toast, setToast] = useState({
    open: false,
    type: 'success',
    title: '',
    description: '',
  })
  const toastTimerRef = useRef(null)

  useEffect(() => {
    const update = () => setIsSmallScreen(isSmallScreenNow())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const canSubmit = useMemo(() => toDigits(mobile).length >= 11, [mobile])
  const actionMessengerUrl = useMemo(
    () => (isSmallScreen ? toMobileMessengerUrl(messengerUrl) : normalizeMessengerUrl(messengerUrl)),
    [isSmallScreen, messengerUrl],
  )

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!canSubmit) {
      setError('সঠিক মোবাইল নম্বর দিন (কমপক্ষে ১১ ডিজিট)।')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/client/approval-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mobile_number: mobile }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(payload?.error || 'রিকোয়েস্ট সাবমিট করা যায়নি।')

      const rawInboxUrl = normalizeMessengerUrl(
        payload?.messenger_url || DEFAULT_FB_INBOX_URL,
      )
      const nextUrl = rawInboxUrl
      const messageText = String(payload?.message_text || '').trim()
      setMessengerUrl(nextUrl)
      setApprovalMessage(messageText)

      if (messageText && navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(messageText)
          setSuccess(
            'রিকোয়েস্ট সাবমিট হয়েছে। মেসেজ কপি হয়েছে, এখন WebTVBD ইনবক্সে পেস্ট করে পাঠান।',
          )
          showToast({
            type: 'success',
            title: 'মেসেজ কপি হয়েছে',
            description:
              'নিচের WEBTVBD Facebook Inbox বাটনে ক্লিক করে মেসেজটি পেস্ট করে পাঠান।',
          })
        } catch {
          setSuccess(
            'রিকোয়েস্ট সাবমিট হয়েছে। এখন Messenger ওপেন করে মেসেজ পাঠান।',
          )
          showToast({
            type: 'error',
            title: 'অটো কপি হয়নি',
            description:
              'নিচের টেক্সট থেকে মেসেজ কপি করে WEBTVBD Facebook Inbox-এ পাঠান।',
          })
        }
      } else {
        setSuccess(
          'রিকোয়েস্ট সাবমিট হয়েছে। এখন Messenger ওপেন করে মেসেজ পাঠান।',
        )
        showToast({
          type: 'error',
          title: 'অটো কপি হয়নি',
          description:
            'নিচের টেক্সট থেকে মেসেজ কপি করে WEBTVBD Facebook Inbox-এ পাঠান।',
        })
      }
    } catch (err) {
      setError(err?.message || 'রিকোয়েস্ট সাবমিট করা যায়নি।')
    } finally {
      setBusy(false)
    }
  }

  function showToast(nextToast) {
    setToast({ open: true, ...nextToast })
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }))
    }, 5200)
  }

  async function copyMessageAgain() {
    if (!approvalMessage) return
    try {
      await navigator.clipboard.writeText(approvalMessage)
      setSuccess('মেসেজ আবার কপি হয়েছে। এখন WebTVBD ইনবক্সে পেস্ট করে পাঠান।')
      setError('')
      showToast({
        type: 'success',
        title: 'মেসেজ কপি হয়েছে',
        description: 'এখন WEBTVBD Facebook Inbox-এ গিয়ে মেসেজটি পাঠান।',
      })
    } catch {
      setError('মেসেজ কপি করা যায়নি। আবার চেষ্টা করুন।')
      showToast({
        type: 'error',
        title: 'কপি ব্যর্থ',
        description:
          'আবার চেষ্টা করুন অথবা ম্যানুয়ালি মেসেজ সিলেক্ট করে কপি করুন।',
      })
    }
  }

  return (
    <>
      <h1 style={{ margin: '0 0 10px', fontSize: '26px' }}>
        {isRejected ? 'প্রোফাইল এখনো অনুমোদিত হয়নি' : 'প্রোফাইল রিভিউতে আছে'}
      </h1>
      <p style={{ margin: '0 0 8px', color: 'var(--muted-foreground)' }}>
        {isRejected
          ? 'আপনার প্রোফাইল এখনো অনুমোদন পায়নি। মোবাইল নম্বর দিয়ে আবার রিকোয়েস্ট দিন।'
          : 'আপনার অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু অ্যাডমিন অনুমোদন এখনো বাকি আছে।'}
      </p>
      <p style={{ margin: '0 0 14px', color: 'var(--muted-foreground)' }}>
        অনুমোদন সম্পন্ন না হওয়া পর্যন্ত চ্যানেল দেখা বন্ধ থাকবে।
      </p>

      <div
        style={{
          margin: '0 0 14px',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          background: 'color-mix(in oklab, var(--card) 86%, transparent)',
          color: 'var(--muted-foreground)',
          fontSize: '14px',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--foreground)' }}>কি কি করতে হবে:</strong>
        <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
          <li>আপনার একটিভ মোবাইল নম্বর লিখে `Submit` করুন।</li>
          <li>অটোমেটিক কপি হওয়া মেসেজটি রেখে দিন (প্রয়োজনে আবার কপি করুন)।</li>
          <li>`WEBTVBD Facebook Inbox` বাটনে ক্লিক করে ইনবক্স খুলুন।</li>
          <li>কপি করা মেসেজ ইনবক্সে পেস্ট করে পাঠান।</li>
        </ol>
      </div>

      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}
      >
        <label
          style={{
            display: 'grid',
            gap: '6px',
            fontSize: '14px',
            color: 'var(--muted-foreground)',
          }}
        >
          মোবাইল নম্বর
          <input
            type='tel'
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder='উদাহরণ: +8801XXXXXXXXX'
            style={{
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 12px',
              font: 'inherit',
              color: 'var(--foreground)',
              background: 'var(--card)',
            }}
          />
        </label>
        <button
          type='submit'
          disabled={busy || !canSubmit}
          style={{
            border: '0',
            borderRadius: '10px',
            padding: '10px 14px',
            fontWeight: 600,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            cursor: busy || !canSubmit ? 'not-allowed' : 'pointer',
            opacity: busy || !canSubmit ? 0.65 : 1,
          }}
        >
          {busy ? 'সাবমিট হচ্ছে...' : 'অ্যাপ্রুভাল রিকোয়েস্ট সাবমিট করুন'}
        </button>
      </form>

      {approvalMessage ? (
        <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
          <label
            style={{
              display: 'grid',
              gap: '6px',
              fontSize: '14px',
              color: 'var(--muted-foreground)',
            }}
          >
            কপি করা মেসেজ
            <textarea
              readOnly
              value={approvalMessage}
              rows={7}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 12px',
                font: 'inherit',
                color: 'var(--foreground)',
                background: 'var(--card)',
                resize: 'vertical',
              }}
            />
          </label>
          <button
            type='button'
            onClick={copyMessageAgain}
            style={{
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontWeight: 600,
              background: 'var(--card)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              width: 'fit-content',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Copy size={16} />
            মেসেজ আবার কপি করুন
          </button>
        </div>
      ) : null}

      {error ? (
        <p
          style={{
            margin: '0 0 10px',
            color: 'var(--destructive)',
            fontSize: '14px',
          }}
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          style={{
            margin: '0 0 10px',
            color: 'var(--chart-2)',
            fontSize: '14px',
          }}
        >
          {success}
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '8px',
        }}
      >
        <a
          href={actionMessengerUrl}
          target='_blank'
          rel='noopener noreferrer'
          style={{
            border: '1px solid #1877F2',
            borderRadius: '10px',
            padding: '10px 14px',
            fontWeight: 600,
            textDecoration: 'none',
            background: '#1877F2',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            aria-hidden='true'
            focusable='false'
            style={{ display: 'block' }}
          >
            <path
              fill='currentColor'
              d='M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073c0 6.022 4.388 11.014 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.02 1.792-4.687 4.533-4.687 1.313 0 2.686.236 2.686.236v2.965h-1.514c-1.49 0-1.956.93-1.956 1.885v2.261h3.328l-.532 3.49h-2.796V24C19.612 23.087 24 18.095 24 12.073z'
            />
          </svg>
          WEBTVBD Facebook Inbox
        </a>
        <form action='/api/client/auth/logout' method='post'>
          <button
            type='submit'
            style={{
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontWeight: 600,
              background: 'var(--card)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <LogOut size={16} />
            লগআউট
          </button>
        </form>
      </div>
      <div
        style={{
          marginTop: '4px',
          padding: '10px 12px',
          borderRadius: '10px',
          border: '1px solid #f59e0b',
          background: 'color-mix(in oklab, #f59e0b 18%, var(--card))',
          color: '#fde68a',
          fontSize: '15px',
          fontWeight: 700,
          lineHeight: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
        }}
      >
        <AlertTriangle
          size={18}
          style={{ marginTop: '2px', flex: '0 0 auto' }}
        />
        <span>
          গুরুত্বপূর্ণ: WebTVBD ইনবক্সে মেসেজ না পাঠালে আপনার অ্যাকাউন্ট
          অ্যাক্টিভ করা হবে না।
        </span>
      </div>

      {toast.open ? (
        <div
          role='status'
          aria-live='polite'
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            width: 'min(420px, calc(100vw - 32px))',
            borderRadius: 12,
            padding: '12px 14px',
            border: '1px solid var(--border)',
            background:
              toast.type === 'error'
                ? 'color-mix(in oklab, var(--destructive) 16%, var(--card))'
                : 'color-mix(in oklab, var(--chart-2) 16%, var(--card))',
            color: 'var(--foreground)',
            boxShadow: '0 12px 28px rgba(0,0,0,.38)',
            zIndex: 1200,
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            {toast.title}
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: 'var(--muted-foreground)',
            }}
          >
            {toast.description}
          </p>
        </div>
      ) : null}
    </>
  )
}
