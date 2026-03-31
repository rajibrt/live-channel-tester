'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  ArrowLeft,
  CheckCircle2,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Rewind,
  FastForward,
} from 'lucide-react'
import styles from './movies.module.css'
import {
  resolveBrowserPlaybackUrl,
  shouldForceVideoTranscode,
  toStreamTranscodeUrl,
} from '../../lib/streamUrl'

function toSeconds(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

function toSignedSeconds(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return n < 0 ? Math.ceil(n) : Math.floor(n)
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, toSeconds(totalSeconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function isHlsUrl(url) {
  return /\.m3u8(\?|$)/i.test(String(url || ''))
}

function loadHlsScript() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.Hls) return Promise.resolve(window.Hls)

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hls-script="1"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Hls || null), {
        once: true,
      })
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load HLS script.')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'
    script.async = true
    script.dataset.hlsScript = '1'
    script.onload = () => resolve(window.Hls || null)
    script.onerror = () => reject(new Error('Failed to load HLS script.'))
    document.head.appendChild(script)
  })
}

async function tryStartPlayback(video, { allowMutedFallback = false } = {}) {
  if (!video) return false
  try {
    await video.play()
    return true
  } catch {
    if (!allowMutedFallback || video.muted) return false
  }

  try {
    video.muted = true
    video.volume = 0
    await video.play()
    return true
  } catch {
    return false
  }
}

function isTranscodePlaybackUrl(value) {
  const raw = String(value || '')
  return /stream-transcode/i.test(raw)
}

function hasLikelyUnsupportedAudioInUrl(value) {
  const raw = String(value || '').toLowerCase()
  if (!raw) return false
  return /(ac-?3|eac-?3|dts|truehd|dd[\d.]+|ddp[\d.]*)/i.test(raw)
}

function isPrivateLanUrl(value) {
  try {
    const host = new URL(String(value || '')).hostname
    if (!host) return false
    if (host === 'localhost' || host === '127.0.0.1') return true
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true
    return false
  } catch {
    return false
  }
}

function shouldAvoidServerTranscode(rawUrl) {
  if (!isPrivateLanUrl(rawUrl)) return false
  if (typeof window === 'undefined') return false
  const host = String(window.location.hostname || '').toLowerCase()
  // Hosted domain/server usually cannot reach user's private LAN source.
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1'
}

function resolveCompatibilityPlaybackUrl(rawSourceUrl) {
  const raw = String(rawSourceUrl || '').trim()
  if (!raw) return ''
  return toStreamTranscodeUrl(raw, {
    video: shouldForceVideoTranscode(raw) ? 'transcode' : '',
  })
}

function extractDirectStreamTarget(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const base =
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const parsed = new URL(raw, base)
    const isProxyLike =
      /\/api\/stream-(proxy|transcode)$/i.test(parsed.pathname) ||
      /stream-(proxy|transcode)/i.test(parsed.pathname)
    if (!isProxyLike) return raw
    const target = String(parsed.searchParams.get('url') || '').trim()
    return target || raw
  } catch {
    const match = raw.match(/[?&]url=([^&]+)/i)
    if (!match?.[1]) return raw
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }
}

function getPreferredRawMovieUrl(movie) {
  const candidates = [
    movie?.rawPlaybackUrl,
    movie?.source?.rawUrl,
    extractDirectStreamTarget(movie?.source?.playbackUrl),
    extractDirectStreamTarget(movie?.playbackUrl),
  ]

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim()
    if (normalized) return normalized
  }
  return ''
}

function withTranscodeStart(value, seconds) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (!isTranscodePlaybackUrl(raw)) return raw
  try {
    const u = new URL(
      raw,
      typeof window === 'undefined'
        ? 'http://localhost'
        : window.location.origin,
    )
    u.searchParams.set('start', String(Math.max(0, toSeconds(seconds))))
    if (u.origin === 'http://localhost' && raw.startsWith('/')) {
      return `${u.pathname}${u.search}`
    }
    return u.toString()
  } catch {
    const sep = raw.includes('?') ? '&' : '?'
    return `${raw}${sep}start=${encodeURIComponent(String(Math.max(0, toSeconds(seconds))))}`
  }
}

async function diagnoseTranscodeFailure(playbackUrl) {
  const url = String(playbackUrl || '').trim()
  if (!isTranscodePlaybackUrl(url)) return ''
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Range: 'bytes=0-' },
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.ok) return ''
    const body = await res.json().catch(() => ({}))
    const reason = String(body?.reason || body?.error || '').trim()
    const details = String(body?.details || '').trim()
    return [reason, details].filter(Boolean).join(' | ').slice(0, 220)
  } catch {
    return ''
  }
}

export default function MoviePlayer({
  movie,
  startFrom = null,
  replayToken = 0,
  onRestart,
  onMarkComplete,
  onToggleFavorite,
  onBackToList,
  onProgressSaved,
  onMarkedComplete,
  onTrackActivity,
}) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const intervalRef = useRef(null)
  const onProgressSavedRef = useRef(onProgressSaved)
  const onMarkedCompleteRef = useRef(onMarkedComplete)
  const onTrackActivityRef = useRef(onTrackActivity)
  const transcodeOffsetRef = useRef(0)
  const seekStartFromRef = useRef(null)
  const [statusText, setStatusText] = useState('Ready')
  const [isPaused, setIsPaused] = useState(false)
  const [seekNonce, setSeekNonce] = useState(0)
  const [playbackSeconds, setPlaybackSeconds] = useState(0)
  const [mediaDurationSeconds, setMediaDurationSeconds] = useState(0)
  const [probedDurationSeconds, setProbedDurationSeconds] = useState(0)
  const [fallbackPlaybackUrl, setFallbackPlaybackUrl] = useState('')
  const [compatModeRequested, setCompatModeRequested] = useState(false)
  const [compatibilityDisabled, setCompatibilityDisabled] = useState(false)
  const [scrubValue, setScrubValue] = useState(null)

  useEffect(() => {
    onProgressSavedRef.current = onProgressSaved
  }, [onProgressSaved])

  useEffect(() => {
    onMarkedCompleteRef.current = onMarkedComplete
  }, [onMarkedComplete])

  useEffect(() => {
    onTrackActivityRef.current = onTrackActivity
  }, [onTrackActivity])

  useEffect(() => {
    setFallbackPlaybackUrl('')
    setCompatModeRequested(false)
    setCompatibilityDisabled(false)
    seekStartFromRef.current = null
    setSeekNonce(0)
    setScrubValue(null)
    setMediaDurationSeconds(0)
    setProbedDurationSeconds(0)
  }, [movie?.id])

  useEffect(() => {
    const rawUrl = getPreferredRawMovieUrl(movie)
    if (!rawUrl) return undefined
    const controller = new AbortController()
    const runProbe = async () => {
      try {
        const probeRes = await fetch(
          `/api/stream-probe?url=${encodeURIComponent(rawUrl)}`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            signal: controller.signal,
          },
        )
        if (!probeRes.ok) return
        const probe = await probeRes.json().catch(() => ({}))
        const duration = toSeconds(probe?.duration_seconds || 0)
        if (duration > 0) setProbedDurationSeconds(duration)
      } catch {
        // ignore probe failures
      }
    }
    runProbe()
    return () => controller.abort()
  }, [movie?.id, movie?.playbackUrl, movie?.rawPlaybackUrl, movie?.source?.playbackUrl, movie?.source?.rawUrl])

  const postProgress = useCallback(
    async (source) => {
      const id = String(movie?.id || '')
      if (!id) return
      const video = videoRef.current
      if (!video) return

      const payload = {
        position_seconds:
          toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current),
        duration_seconds: Math.max(
          Number.isFinite(Number(video.duration))
            ? toSeconds(video.duration) + toSeconds(transcodeOffsetRef.current)
            : 0,
          toSeconds(movie?.runtimeSeconds || 0),
          toSeconds(movie?.progress?.durationSeconds || 0),
          toSeconds(probedDurationSeconds || 0),
        ),
        source,
      }

      try {
        const res = await fetch(
          `/api/client/movies/${encodeURIComponent(id)}/progress`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include',
            keepalive:
              source === 'pagehide' || source === 'pause' || source === 'seek',
          },
        )
        if (!res.ok) {
          console.warn(`movie progress save failed: HTTP ${res.status}`)
          return
        }
        const data = await res.json().catch(() => ({}))
        onProgressSavedRef.current?.(id, {
          positionSeconds: Number(data?.position_seconds || 0),
          durationSeconds: Number(data?.duration_seconds || 0),
          progressPercent: Number(data?.progress_percent || 0),
          isCompleted: Boolean(data?.is_completed),
          updatedAt: new Date().toISOString(),
        })
      } catch {
        // ignore save progress failures
      }
    },
    [
      movie?.id,
      movie?.runtimeSeconds,
      movie?.progress?.durationSeconds,
      probedDurationSeconds,
    ],
  )

  const postComplete = useCallback(async () => {
    const id = String(movie?.id || '')
    if (!id) return
    try {
      const res = await fetch(
        `/api/client/movies/${encodeURIComponent(id)}/complete`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
        },
      )
      if (!res.ok) return
      onMarkedCompleteRef.current?.(id)
      onTrackActivityRef.current?.('movie_complete', { movie_id: id })
    } catch {
      // ignore completion failures
    }
  }, [movie?.id])

  const queueTranscodeSeek = useCallback((seconds) => {
    seekStartFromRef.current = Math.max(0, toSeconds(seconds))
    setSeekNonce((prev) => prev + 1)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    video.pause()
    video.removeAttribute('src')
    video.load()

    const rawMovieUrl = getPreferredRawMovieUrl(movie)
    const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawMovieUrl)
    const directPlaybackUrl = resolveBrowserPlaybackUrl(
      rawMovieUrl,
      typeof window !== 'undefined' ? window.location?.protocol : '',
    )
    const playbackUrl = String(
      fallbackPlaybackUrl ||
        directPlaybackUrl ||
        movie?.playbackUrl ||
        '',
    )
    if (!playbackUrl) {
      setStatusText('Select a movie with a playable source.')
      return undefined
    }

    setStatusText('Loading...')
    const isTranscoded = isTranscodePlaybackUrl(playbackUrl)
    const fallbackStart = toSeconds(movie?.progress?.positionSeconds)
    const requestedSeek = seekStartFromRef.current
    const requestedStart =
      requestedSeek === null
        ? startFrom === null
          ? fallbackStart
          : toSeconds(startFrom)
        : toSeconds(requestedSeek)
    const desiredStart = Math.max(0, requestedStart)
    transcodeOffsetRef.current = isTranscoded ? desiredStart : 0
    const sourceForPlayback = isTranscoded
      ? withTranscodeStart(playbackUrl, desiredStart)
      : playbackUrl
    let initialSeekApplied = false
    let initialSeekTimer = null
    let startupFallbackTimer = null

    const applyNativeSource = (source) => {
      video.src = source
      video.load()
    }

    const applyInitialSeek = () => {
      if (initialSeekApplied || isTranscoded || desiredStart <= 0) return
      if (!Number.isFinite(Number(video.duration))) return
      try {
        video.currentTime = Math.min(
          desiredStart,
          Math.max(0, Math.floor(video.duration) - 1),
        )
        initialSeekApplied = true
      } catch {
        // ignore initial seek failures
      }
    }

    const handleLoadedMetadata = () => {
      const measuredDuration = Number.isFinite(Number(video.duration))
        ? toSeconds(video.duration) + toSeconds(transcodeOffsetRef.current)
        : 0
      if (measuredDuration > 0) {
        setMediaDurationSeconds((prev) => Math.max(prev, measuredDuration))
      }
      setPlaybackSeconds(transcodeOffsetRef.current)
    }

    const handleCanPlay = () => {
      setStatusText('Ready')
    }

    const armStartupFallback = (message) => {
      if (
        isTranscoded ||
        compatibilityDisabled ||
        !shouldForceVideoTranscode(rawMovieUrl)
      ) {
        return
      }
      if (startupFallbackTimer) clearTimeout(startupFallbackTimer)
      startupFallbackTimer = setTimeout(() => {
        if (cancelled) return
        if (!video.paused && toSeconds(video.currentTime) <= 0) {
          switchToCompatibilityPlayback(message)
        }
      }, 2200)
    }

    const handlePlaying = () => {
      if (startupFallbackTimer) {
        clearTimeout(startupFallbackTimer)
        startupFallbackTimer = null
      }
      if (!initialSeekApplied && !isTranscoded && desiredStart > 0) {
        if (initialSeekTimer) clearTimeout(initialSeekTimer)
        initialSeekTimer = setTimeout(() => {
          applyInitialSeek()
        }, 350)
      }
      setStatusText('Playing')
      setIsPaused(false)
      onTrackActivityRef.current?.('movie_playback_attempt', {
        movie_id: String(movie?.id || ''),
        source_label: String(movie?.source?.label || ''),
      })
      postProgress('start')
      seekStartFromRef.current = null
    }

    const handlePause = () => {
      setStatusText('Paused')
      setIsPaused(true)
      postProgress('pause')
    }

    const handleSeeked = () => {
      postProgress('seek')
      setPlaybackSeconds(
        toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current),
      )
    }

    const handlePlay = () => {
      setIsPaused(false)
      armStartupFallback(
        'Native playback stalled after Play. Switching to compatibility mode...',
      )
    }

    const handleTimeUpdate = () => {
      if (startupFallbackTimer && video.currentTime > 0) {
        clearTimeout(startupFallbackTimer)
        startupFallbackTimer = null
      }
      setPlaybackSeconds(
        toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current),
      )
      if (Number.isFinite(Number(video.duration))) {
        const measuredDuration =
          toSeconds(video.duration) + toSeconds(transcodeOffsetRef.current)
        if (measuredDuration > 0) {
          setMediaDurationSeconds((prev) => Math.max(prev, measuredDuration))
        }
      }
    }

    const handleDurationChange = () => {
      if (!Number.isFinite(Number(video.duration))) return
      const measuredDuration =
        toSeconds(video.duration) + toSeconds(transcodeOffsetRef.current)
      if (measuredDuration > 0) {
        setMediaDurationSeconds((prev) => Math.max(prev, measuredDuration))
      }
    }

    const handleEnded = () => {
      setStatusText('Completed')
      postComplete()
    }

    let compatibilityFallbackTriggered = false
    const switchToCompatibilityPlayback = (statusMessage) => {
      if (
        compatibilityFallbackTriggered ||
        isTranscoded ||
        !compatibilityUrl ||
        compatibilityDisabled ||
        !shouldForceVideoTranscode(rawMovieUrl)
      ) {
        return false
      }
      compatibilityFallbackTriggered = true
      const currentAbs =
        toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current)
      seekStartFromRef.current = currentAbs
      setCompatModeRequested(true)
      setFallbackPlaybackUrl(compatibilityUrl)
      setStatusText(statusMessage || 'Switching to compatibility mode...')
      return true
    }

    const handleError = () => {
      const rawUrl = getPreferredRawMovieUrl(movie)
      const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawUrl)
      if (
        switchToCompatibilityPlayback(
          'Native playback failed. Switching to compatibility mode...',
        )
      ) {
        return
      }
      if (
        !isTranscoded &&
        shouldAvoidServerTranscode(rawUrl) &&
        !compatModeRequested
      ) {
        setStatusText(
          'Playback failed (server cannot access private source; using direct LAN playback only)',
        )
      } else if (
        !isTranscoded &&
        shouldAvoidServerTranscode(rawUrl) &&
        compatModeRequested
      ) {
        setStatusText(
          'Playback failed (compatibility mode needs LAN-reachable transcode server)',
        )
      } else {
        setStatusText(
          compatibilityUrl
            ? 'Playback failed. Try Compatibility Mode if this source has unsupported audio.'
            : 'Playback failed',
        )
      }
      if (isTranscoded) {
        diagnoseTranscodeFailure(playbackUrl).then((info) => {
          if (!info) return
          const lower = info.toLowerCase()
          const networkBlocked =
            lower.includes('operation timed out') ||
            lower.includes('connection to tcp') ||
            lower.includes('error opening input file')
          if (networkBlocked) {
            // Domain cannot reach LAN source for server-side transcode.
            // Fall back to normal mode and stop auto-retrying compat.
            setCompatibilityDisabled(true)
            setCompatModeRequested(false)
            setFallbackPlaybackUrl('')
            setStatusText(
              'Compatibility mode unavailable on domain (LAN source unreachable). Switched to normal mode.',
            )
            return
          }
          setStatusText(`Playback failed (${info})`)
        })
      }
      onTrackActivityRef.current?.('movie_playback_failed', {
        movie_id: String(movie?.id || ''),
      })
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('play', handlePlay)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    setIsPaused(video.paused)

    let cancelled = false
    const startNativePlayback = () => {
      video.muted = false
      video.volume = 1
      applyNativeSource(sourceForPlayback)
      if (!isTranscoded && !compatModeRequested) {
        setIsPaused(true)
        setStatusText('Ready. Press Play to start normal mode.')
        return
      }
      if (
        !isTranscoded &&
        !compatibilityDisabled &&
        shouldForceVideoTranscode(rawMovieUrl)
      ) {
        armStartupFallback(
          'Native playback stalled. Switching to compatibility mode...',
        )
      }
      tryStartPlayback(video)
        .then((started) => {
          if (!started) {
            setIsPaused(true)
            setStatusText('Ready. Press Play to start normal mode.')
          }
        })
        .catch(() => setStatusText('Ready'))
    }

    const startPlayback = async () => {
      if (!isTranscoded && isHlsUrl(sourceForPlayback)) {
        try {
          const Hls = await loadHlsScript()
          if (cancelled) return
          if (Hls?.isSupported?.()) {
            const hls = new Hls({ lowLatencyMode: true, maxBufferLength: 30 })
            hlsRef.current = hls
            hls.loadSource(sourceForPlayback)
            hls.attachMedia(video)
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (cancelled) return
              video.muted = false
              video.volume = 1
              tryStartPlayback(video).catch(() => {})
            })
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data?.fatal || cancelled) return
              hls.destroy()
              hlsRef.current = null
              startNativePlayback()
            })
            return
          }
        } catch {
          // fall back to native assignment below
        }
        const canPlayNatively =
          video.canPlayType('application/vnd.apple.mpegurl') ||
          video.canPlayType('application/x-mpegURL')
        if (!canPlayNatively) {
          try {
            startNativePlayback()
            return
          } catch {
            // ignore startup failures
          }
        }
      }
      startNativePlayback()
    }

    startPlayback()

    intervalRef.current = setInterval(() => {
      if (!video.paused && !video.ended) postProgress('interval')
    }, 20000)

    const onPageHide = () => postProgress('pagehide')
    const onForcePause = () => {
      const active = videoRef.current
      if (!active || active.paused || active.ended) return
      active.pause()
      postProgress('pause')
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onPageHide()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    window.addEventListener('movie-force-pause', onForcePause)

    return () => {
      cancelled = true
      if (initialSeekTimer) clearTimeout(initialSeekTimer)
      if (startupFallbackTimer) clearTimeout(startupFallbackTimer)
      clearInterval(intervalRef.current)
      intervalRef.current = null
      postProgress('unmount')
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
      window.removeEventListener('movie-force-pause', onForcePause)
    }
  }, [
    fallbackPlaybackUrl,
    movie?.id,
    movie?.playbackUrl,
    movie?.rawPlaybackUrl,
    movie?.source?.playbackUrl,
    movie?.source?.rawUrl,
    postComplete,
    postProgress,
    replayToken,
    seekNonce,
    startFrom,
  ])

  const favoriteActive = Boolean(movie?.isFavorite)
  const browserResolvedPlaybackUrl = resolveBrowserPlaybackUrl(
    getPreferredRawMovieUrl(movie),
    typeof window !== 'undefined' ? window.location?.protocol : '',
  )
  const hasPlayableMovie = Boolean(
    fallbackPlaybackUrl || browserResolvedPlaybackUrl || movie?.playbackUrl,
  )
  const isTranscodedPlayback = isTranscodePlaybackUrl(
    fallbackPlaybackUrl || browserResolvedPlaybackUrl || movie?.playbackUrl,
  )
  const rawSourceUrl = getPreferredRawMovieUrl(movie)
  const privateHostedMode = shouldAvoidServerTranscode(rawSourceUrl)
  const showPlayAction = isPaused || !hasPlayableMovie
  const videoElementKey = `${movie?.id || 'movie'}:${fallbackPlaybackUrl || rawSourceUrl || movie?.playbackUrl || ''}`
  const watchedSeconds = Number(
    playbackSeconds || movie?.progress?.positionSeconds || 0,
  )
  const durationSeconds = Number(
    Math.max(
      toSeconds(movie?.progress?.durationSeconds || 0),
      toSeconds(movie?.runtimeSeconds || 0),
      toSeconds(probedDurationSeconds || 0),
      toSeconds(mediaDurationSeconds || 0),
    ),
  )
  const watchedPercent =
    durationSeconds > 0
      ? Math.round(
          (Math.max(0, Math.min(watchedSeconds, durationSeconds)) /
            durationSeconds) *
            100,
        )
      : Number(movie?.progress?.progressPercent || 0)
  const isMarkedWatched =
    Boolean(movie?.progress?.isCompleted) || watchedPercent >= 95
  const watchTimeText = `${formatClock(watchedSeconds)} / ${formatClock(durationSeconds)}`
  const watchProgressText =
    watchedPercent > 0
      ? `${Math.round(watchedPercent)}% watched`
      : 'Not started'
  const nativeDurationBroken = Boolean(
    !isTranscodedPlayback &&
      durationSeconds > 60 &&
      mediaDurationSeconds > 0 &&
      mediaDurationSeconds < Math.max(15, Math.floor(durationSeconds * 0.25)),
  )
  const scrubDuration = Math.max(
    0,
    toSeconds(durationSeconds || movie?.runtimeSeconds || 0),
  )
  const scrubCurrent = Math.min(
    scrubDuration || 0,
    Math.max(0, toSeconds(scrubValue == null ? watchedSeconds : scrubValue)),
  )
  const handleTogglePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) {
      if (video.ended) {
        try {
          video.currentTime = 0
        } catch {
          // ignore seek failures
        }
      }
      video.play().catch(() => {})
      return
    }
    video.pause()
  }, [])

  const jumpBySeconds = useCallback(
    (delta) => {
      const video = videoRef.current
      if (!video) return
      const base =
        toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current)
      const target = Math.max(0, base + toSignedSeconds(delta))
      if (isTranscodedPlayback) {
        queueTranscodeSeek(target)
        return
      }
      const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawSourceUrl)
      if (nativeDurationBroken && compatibilityUrl) {
        seekStartFromRef.current = target
        setCompatibilityDisabled(false)
        setCompatModeRequested(true)
        setFallbackPlaybackUrl(compatibilityUrl)
        setStatusText('Switching to compatibility seek...')
        return
      }
      try {
        video.currentTime = target
      } catch {
        // ignore seek failures
      }
    },
    [isTranscodedPlayback, nativeDurationBroken, queueTranscodeSeek, rawSourceUrl],
  )

  const jumpToSeconds = useCallback(
    (targetSeconds) => {
      const target = Math.max(0, toSeconds(targetSeconds))
      const video = videoRef.current
      if (!video) return
      if (isTranscodedPlayback) {
        queueTranscodeSeek(target)
        setScrubValue(null)
        return
      }
      const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawSourceUrl)
      if (nativeDurationBroken && compatibilityUrl) {
        seekStartFromRef.current = target
        setCompatibilityDisabled(false)
        setCompatModeRequested(true)
        setFallbackPlaybackUrl(compatibilityUrl)
        setStatusText('Switching to compatibility seek...')
        setScrubValue(null)
        return
      }
      try {
        video.currentTime = target
      } catch {
        // ignore seek failures
      }
      setScrubValue(null)
    },
    [isTranscodedPlayback, nativeDurationBroken, queueTranscodeSeek, rawSourceUrl],
  )

  const toggleCompatibilityMode = useCallback(() => {
    const rawUrl = getPreferredRawMovieUrl(movie)
    if (!rawUrl) return
    const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawUrl)
    const video = videoRef.current
    const currentAbs = video
      ? toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current)
      : toSeconds(playbackSeconds || movie?.progress?.positionSeconds || 0)
    seekStartFromRef.current = currentAbs
    if (isTranscodedPlayback) {
      setCompatibilityDisabled(true)
      setCompatModeRequested(false)
      setFallbackPlaybackUrl('')
      setStatusText('Switched to normal mode')
      return
    }
    if (!compatibilityUrl) {
      setStatusText(
        'Compatibility mode unavailable (gateway not configured for private source)',
      )
      return
    }
    setCompatibilityDisabled(false)
    setCompatModeRequested(true)
    setFallbackPlaybackUrl(compatibilityUrl)
    if (privateHostedMode) {
      setStatusText(
        'Trying compatibility mode (requires transcode server access to LAN source)...',
      )
    } else {
      setStatusText('Switching to compatibility mode...')
    }
  }, [
    isTranscodedPlayback,
    movie?.progress?.positionSeconds,
    movie?.playbackUrl,
    movie?.rawPlaybackUrl,
    movie?.source?.playbackUrl,
    movie?.source?.rawUrl,
    playbackSeconds,
    privateHostedMode,
  ])

  return (
    <section className={styles.playerWrap}>
      <div className={styles.videoShell}>
        <video
          key={videoElementKey}
          ref={videoRef}
          className={styles.video}
          controls
          playsInline
          preload='metadata'
        />
      </div>
      <div className={styles.moviePlayerControlsRow}>
        <div className={styles.moviePlayerButtons}>
          <div className={styles.moviePlayerButtonRowTop}>
          <button
            type='button'
            className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
            onClick={onBackToList}
            aria-label='Back to movie list'
            title='Back to movie list'
          >
            <ArrowLeft size={15} />
            <span className={styles.movieBtnText}>Back to Movie List</span>
          </button>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${showPlayAction ? styles.movieNavBtnInactive : styles.movieNavBtnActive}`}
              onClick={handleTogglePlayPause}
              disabled={!hasPlayableMovie}
              aria-label={showPlayAction ? 'Play' : 'Pause'}
              title={showPlayAction ? 'Play' : 'Pause'}
            >
              {showPlayAction ? <Play size={15} /> : <Pause size={15} />}
              <span className={styles.movieBtnText}>
                {showPlayAction ? 'Play' : 'Pause'}
              </span>
            </button>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
              onClick={() => onRestart?.(movie)}
            >
              <RotateCcw size={15} />
              <span className={styles.movieBtnText}>Restart</span>
            </button>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
              onClick={() => jumpBySeconds(-10)}
              disabled={!hasPlayableMovie}
            >
              <Rewind size={15} />
              <span className={styles.movieBtnText}>-10s</span>
            </button>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
              onClick={() => jumpBySeconds(10)}
              disabled={!hasPlayableMovie}
            >
              <FastForward size={15} />
              <span className={styles.movieBtnText}>+10s</span>
            </button>
          </div>
          <div className={styles.moviePlayerButtonRowBottom}>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${isMarkedWatched ? styles.movieNavBtnSuccess : styles.movieNavBtnInactive}`}
              onClick={() => onMarkComplete?.(movie)}
              aria-label={isMarkedWatched ? 'Watched' : 'Mark Watched'}
              title={isMarkedWatched ? 'Already watched' : 'Mark Watched'}
            >
              <CheckCircle2
                size={15}
                fill={isMarkedWatched ? 'currentColor' : 'none'}
              />
              <span className={styles.movieBtnText}>
                {isMarkedWatched ? 'Watched' : 'Mark Watched'}
              </span>
            </button>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive} ${styles.movieNavBtnLabelled}`}
              onClick={toggleCompatibilityMode}
              disabled={!rawSourceUrl}
              aria-label={
                isTranscodedPlayback ? 'Normal Mode' : 'Compatibility Mode'
              }
              title={
                isTranscodedPlayback
                  ? 'Switch to normal mode'
                  : 'Switch to compatibility mode'
              }
            >
              <AudioLines size={15} className={styles.movieBtnIcon} />
              <span className={styles.movieBtnText}>
                {isTranscodedPlayback ? 'Normal Mode' : 'Compatibility Mode'}
              </span>
              <span className={styles.movieBtnTextMobileHint}>
                {isTranscodedPlayback ? 'Normal Mode' : 'Compatibility Mode'}
              </span>
            </button>
            <button
              type='button'
              className={`${styles.movieFavoriteBtn} ${favoriteActive ? styles.movieFavoriteBtnActive : styles.movieFavoriteBtnInactive}`}
              onClick={() => onToggleFavorite?.(movie)}
              aria-label={favoriteActive ? 'Favorited' : 'Add Favorite'}
              title={favoriteActive ? 'Favorited' : 'Add Favorite'}
            >
              <Heart size={15} fill={favoriteActive ? 'currentColor' : 'none'} />
              <span className={styles.movieBtnText}>
                {favoriteActive ? 'Favorited' : 'Add Favorite'}
              </span>
            </button>
          </div>
        </div>
      </div>
      {scrubDuration > 0 ? (
        <div className={styles.playerInfoPanel} style={{ marginTop: 8 }}>
          <input
            type='range'
            min={0}
            max={scrubDuration}
            step={1}
            value={scrubCurrent}
            onChange={(e) => setScrubValue(Number(e.target.value || 0))}
            onMouseUp={(e) => jumpToSeconds(Number(e.currentTarget.value || 0))}
            onTouchEnd={(e) =>
              jumpToSeconds(Number(e.currentTarget.value || 0))
            }
          />
          <div className={styles.playerInfoTop}>
            <span className={styles.playerInfoPill}>
              {formatClock(scrubCurrent)}
            </span>
            <span className={styles.playerInfoPill}>
              {formatClock(scrubDuration)}
            </span>
          </div>
        </div>
      ) : null}
      <div className={styles.playerInfoPanel}>
        <div className={styles.playerInfoTop}>
          <span className={styles.playerInfoPill}>
            {movie?.releaseYear || 'Year N/A'}
          </span>
          <span className={styles.playerInfoPill}>{watchTimeText}</span>
          <span className={styles.playerInfoPill}>{watchProgressText}</span>
        </div>
        <p className={styles.playerStatusText}>
          Status: <span className={styles.playerStatusValue}>{statusText}</span>
        </p>
        <p className={styles.playerHintText}>
          Resume starts when progress is at least 30s. Watched is 95%+.
        </p>
        {isTranscodedPlayback ? (
          <p className={styles.playerHintText}>
            Compatibility mode active (AAC fallback). Use -10s/+10s for reliable
            seeking.
          </p>
        ) : null}
        {!isTranscodedPlayback &&
        privateHostedMode &&
        likelyUnsupportedAudio ? (
          <p className={styles.playerHintText}>
            This source likely has unsupported browser audio codec. Try
            Compatibility Mode.
          </p>
        ) : null}
      </div>
    </section>
  )
}
