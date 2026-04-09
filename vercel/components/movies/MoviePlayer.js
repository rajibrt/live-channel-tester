'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Rewind,
  FastForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import styles from './movies.module.css'
import { resolveBrowserPlaybackUrl } from '../../lib/streamUrl'

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

function getFullscreenElement() {
  if (typeof document === 'undefined') return null
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  )
}

async function requestElementFullscreen(element, video) {
  if (element?.requestFullscreen) {
    await element.requestFullscreen()
    return true
  }
  if (element?.webkitRequestFullscreen) {
    element.webkitRequestFullscreen()
    return true
  }
  if (element?.mozRequestFullScreen) {
    element.mozRequestFullScreen()
    return true
  }
  if (element?.msRequestFullscreen) {
    element.msRequestFullscreen()
    return true
  }
  if (video?.webkitEnterFullscreen) {
    video.webkitEnterFullscreen()
    return true
  }
  return false
}

async function exitDocumentFullscreen() {
  if (typeof document === 'undefined') return false
  if (document.exitFullscreen) {
    await document.exitFullscreen()
    return true
  }
  if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen()
    return true
  }
  if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen()
    return true
  }
  if (document.msExitFullscreen) {
    document.msExitFullscreen()
    return true
  }
  return false
}

function isTypingTarget(target) {
  if (!target || typeof target !== 'object') return false
  const tagName = String(target.tagName || '').toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  )
}

export default function MoviePlayer({
  movie,
  isTvMode = false,
  startFrom = null,
  replayToken = 0,
  autoStartPlayback = false,
  autoEnterFullscreen = false,
  onRestart,
  onMarkComplete,
  onToggleFavorite,
  onBackToList,
  onProgressSaved,
  onMarkedComplete,
  onTrackActivity,
}) {
  const playerWrapRef = useRef(null)
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const intervalRef = useRef(null)
  const autoLandscapeFullscreenRef = useRef(false)
  const onProgressSavedRef = useRef(onProgressSaved)
  const onMarkedCompleteRef = useRef(onMarkedComplete)
  const onTrackActivityRef = useRef(onTrackActivity)
  const transcodeOffsetRef = useRef(0)
  const seekStartFromRef = useRef(null)
  const volumeIndicatorTimerRef = useRef(null)
  const [statusText, setStatusText] = useState('Ready')
  const [isPaused, setIsPaused] = useState(false)
  const [seekNonce, setSeekNonce] = useState(0)
  const [playbackSeconds, setPlaybackSeconds] = useState(0)
  const [mediaDurationSeconds, setMediaDurationSeconds] = useState(0)
  const [probedDurationSeconds, setProbedDurationSeconds] = useState(0)
  const [scrubValue, setScrubValue] = useState(null)
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false)
  const [volumeIndicator, setVolumeIndicator] = useState(null)

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
    seekStartFromRef.current = null
    setSeekNonce(0)
    setScrubValue(null)
    setMediaDurationSeconds(0)
    setProbedDurationSeconds(0)
  }, [movie?.id])

  useEffect(() => {
    if (!autoEnterFullscreen || typeof window === 'undefined') return undefined
    const playerWrap = playerWrapRef.current
    const video = videoRef.current
    if (!playerWrap || !video) return undefined
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      requestElementFullscreen(playerWrap, video).catch?.(() => {})
    }, 40)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [autoEnterFullscreen, movie?.id, replayToken])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const syncFullscreenState = () => {
      const fullscreenElement = getFullscreenElement()
      setIsPlayerFullscreen(fullscreenElement === playerWrapRef.current)
    }
    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
    }
  }, [])

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
    const directPlaybackUrl = resolveBrowserPlaybackUrl(
      rawMovieUrl,
      typeof window !== 'undefined' ? window.location?.protocol : '',
    )
    const playbackUrl = String(directPlaybackUrl || movie?.playbackUrl || '')
    if (!playbackUrl) {
      setStatusText('Select a movie with a playable source.')
      return undefined
    }

    setStatusText('Loading...')
    const fallbackStart = toSeconds(movie?.progress?.positionSeconds)
    const requestedSeek = seekStartFromRef.current
    const requestedStart =
      requestedSeek === null
        ? startFrom === null
          ? fallbackStart
          : toSeconds(startFrom)
        : toSeconds(requestedSeek)
    const desiredStart = Math.max(0, requestedStart)
    transcodeOffsetRef.current = 0
    const sourceForPlayback = playbackUrl
    let initialSeekApplied = false
    let initialSeekTimer = null

    const applyNativeSource = (source) => {
      video.src = source
      video.load()
    }

    const applyInitialSeek = () => {
      if (initialSeekApplied || desiredStart <= 0) return
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

    const handlePlaying = () => {
      if (!initialSeekApplied && desiredStart > 0) {
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
    }

    const handleTimeUpdate = () => {
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

    const handleError = () => {
      if (shouldAvoidServerTranscode(rawMovieUrl)) {
        setStatusText(
          'Playback failed (server cannot access private source; using direct playback only)',
        )
      } else {
        setStatusText('Playback failed')
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
      if (!autoStartPlayback) {
        setIsPaused(true)
        setStatusText('Ready. Press Play to start normal mode.')
        return
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
      if (isHlsUrl(sourceForPlayback)) {
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
    autoStartPlayback,
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
  const hasPlayableMovie = Boolean(browserResolvedPlaybackUrl || movie?.playbackUrl)
  const rawSourceUrl = getPreferredRawMovieUrl(movie)
  const showPlayAction = isPaused || !hasPlayableMovie
  const videoElementKey = `${movie?.id || 'movie'}:${rawSourceUrl || movie?.playbackUrl || ''}`
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
  const scrubDuration = Math.max(
    0,
    toSeconds(durationSeconds || movie?.runtimeSeconds || 0),
  )
  const scrubCurrent = Math.min(
    scrubDuration || 0,
    Math.max(0, toSeconds(scrubValue == null ? watchedSeconds : scrubValue)),
  )
  const hideTvFullscreenChrome = isTvMode && isPlayerFullscreen
  const volumeIndicatorLevel = Math.round(Math.max(0, Math.min(1, Number(volumeIndicator?.volume || 0))) * 100)
  const handleTogglePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) {
      if (autoEnterFullscreen) {
        requestElementFullscreen(playerWrapRef.current, video).catch?.(() => {})
      }
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
  }, [autoEnterFullscreen])

  const showVolumeIndicator = useCallback((payload) => {
    setVolumeIndicator(payload)
    if (typeof window === 'undefined') return
    if (volumeIndicatorTimerRef.current) {
      window.clearTimeout(volumeIndicatorTimerRef.current)
    }
    volumeIndicatorTimerRef.current = window.setTimeout(() => {
      setVolumeIndicator(null)
      volumeIndicatorTimerRef.current = null
    }, 850)
  }, [])

  const togglePlayerFullscreen = useCallback(async () => {
    const playerWrap = playerWrapRef.current
    const video = videoRef.current
    if (!playerWrap || !video) return
    const fullscreenElement = getFullscreenElement()
    if (fullscreenElement === playerWrap) {
      await exitDocumentFullscreen().catch(() => {})
      return
    }
    await requestElementFullscreen(playerWrap, video).catch(() => {})
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    showVolumeIndicator({
      muted: video.muted,
      volume: video.muted ? 0 : Number(video.volume || 0),
    })
  }, [showVolumeIndicator])

  const adjustVolume = useCallback((delta) => {
    const video = videoRef.current
    if (!video) return
    const currentVolume = Number.isFinite(Number(video.volume)) ? Number(video.volume) : 1
    const nextVolume = Math.max(0, Math.min(1, currentVolume + delta))
    video.volume = nextVolume
    if (nextVolume > 0 && video.muted) video.muted = false
    if (nextVolume === 0) video.muted = true
    showVolumeIndicator({
      muted: video.muted,
      volume: nextVolume,
    })
  }, [showVolumeIndicator])

  const jumpBySeconds = useCallback(
    (delta) => {
      const video = videoRef.current
      if (!video) return
      const base =
        toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current)
      const target = Math.max(0, base + toSignedSeconds(delta))
      try {
        video.currentTime = target
      } catch {
        // ignore seek failures
      }
    },
    [],
  )

  const jumpToSeconds = useCallback(
    (targetSeconds) => {
      const target = Math.max(0, toSeconds(targetSeconds))
      const video = videoRef.current
      if (!video) return
      try {
        video.currentTime = target
      } catch {
        // ignore seek failures
      }
      setScrubValue(null)
    },
    [],
  )

  useEffect(() => {
    if (!isTvMode || typeof window === 'undefined') return undefined

    const onPlayPause = () => handleTogglePlayPause()
    const onPlay = () => {
      const video = videoRef.current
      if (!video || !video.paused) return
      if (autoEnterFullscreen) {
        requestElementFullscreen(playerWrapRef.current, video).catch?.(() => {})
      }
      video.play().catch(() => {})
    }
    const onPause = () => {
      const video = videoRef.current
      if (!video || video.paused) return
      video.pause()
    }
    const onStop = () => {
      const video = videoRef.current
      if (!video) return
      video.pause()
      try {
        video.currentTime = 0
      } catch {
        // ignore seek failures
      }
    }
    const onForward = () => jumpBySeconds(10)
    const onBackward = () => jumpBySeconds(-10)

    window.addEventListener('tv-media-playpause', onPlayPause)
    window.addEventListener('tv-media-play', onPlay)
    window.addEventListener('tv-media-pause', onPause)
    window.addEventListener('tv-media-stop', onStop)
    window.addEventListener('tv-media-forward', onForward)
    window.addEventListener('tv-media-backward', onBackward)

    return () => {
      window.removeEventListener('tv-media-playpause', onPlayPause)
      window.removeEventListener('tv-media-play', onPlay)
      window.removeEventListener('tv-media-pause', onPause)
      window.removeEventListener('tv-media-stop', onStop)
      window.removeEventListener('tv-media-forward', onForward)
      window.removeEventListener('tv-media-backward', onBackward)
    }
  }, [autoEnterFullscreen, handleTogglePlayPause, isTvMode, jumpBySeconds])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const onKeyDown = (event) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return

      const key = String(event.key || '')
      if (key === ' ' || key === 'Spacebar' || key === 'Space') {
        event.preventDefault()
        handleTogglePlayPause()
        return
      }
      if (key === 'f' || key === 'F') {
        event.preventDefault()
        togglePlayerFullscreen()
        return
      }
      if (key === 'm' || key === 'M') {
        event.preventDefault()
        toggleMute()
        return
      }
      if (key === 'ArrowLeft') {
        event.preventDefault()
        jumpBySeconds(-10)
        return
      }
      if (key === 'ArrowRight') {
        event.preventDefault()
        jumpBySeconds(10)
        return
      }
      if (key === 'ArrowUp') {
        event.preventDefault()
        adjustVolume(0.1)
        return
      }
      if (key === 'ArrowDown') {
        event.preventDefault()
        adjustVolume(-0.1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [adjustVolume, handleTogglePlayPause, jumpBySeconds, toggleMute, togglePlayerFullscreen])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && volumeIndicatorTimerRef.current) {
        window.clearTimeout(volumeIndicatorTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncLandscapeFullscreen = async () => {
      const playerWrap = playerWrapRef.current
      const video = videoRef.current
      if (!playerWrap || !video) return

      const isTouchDevice =
        window.matchMedia?.('(pointer: coarse)')?.matches ||
        navigator.maxTouchPoints > 0
      const isSmallScreen = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 900
      const isLandscape = window.innerWidth > window.innerHeight
      const fullscreenElement = getFullscreenElement()
      const wrapperIsFullscreen = fullscreenElement === playerWrap

      if (isTouchDevice && isSmallScreen && isLandscape) {
        if (!fullscreenElement) {
          try {
            const entered = await requestElementFullscreen(playerWrap, video)
            if (entered) autoLandscapeFullscreenRef.current = true
          } catch {
            // ignore fullscreen request failures
          }
        }
        return
      }

      if (autoLandscapeFullscreenRef.current && wrapperIsFullscreen) {
        try {
          await exitDocumentFullscreen()
        } catch {
          // ignore exit failures
        }
      }
      autoLandscapeFullscreenRef.current = false
    }

    const handleViewportChange = () => {
      syncLandscapeFullscreen().catch(() => {})
    }

    const handleFullscreenChange = () => {
      const playerWrap = playerWrapRef.current
      const fullscreenElement = getFullscreenElement()
      if (fullscreenElement !== playerWrap) {
        autoLandscapeFullscreenRef.current = false
      }
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('orientationchange', handleViewportChange)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

    syncLandscapeFullscreen().catch(() => {})

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('orientationchange', handleViewportChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [movie?.id])

  return (
    <section ref={playerWrapRef} className={`${styles.playerWrap} ${isTvMode ? styles.playerWrapTv : ""}`}>
      <div className={`${styles.videoShell} ${isTvMode ? styles.videoShellTv : ""}`}>
        <video
          key={videoElementKey}
          ref={videoRef}
          className={styles.video}
          controls
          playsInline
          preload='metadata'
        />
        {volumeIndicator ? (
          <div className={`${styles.volumeIndicator} ${isTvMode ? styles.volumeIndicatorTv : ''}`} aria-hidden='true'>
            {volumeIndicator.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{volumeIndicatorLevel}%</span>
          </div>
        ) : null}
      </div>
      {!hideTvFullscreenChrome ? (
      <div className={`${styles.moviePlayerControlsRow} ${isTvMode ? styles.moviePlayerControlsRowTv : ""}`}>
        <div className={`${styles.moviePlayerButtons} ${isTvMode ? styles.moviePlayerButtonsTv : ""}`}>
          <div className={`${styles.moviePlayerButtonRowTop} ${isTvMode ? styles.moviePlayerButtonRowTv : ""}`}>
          <button
            type='button'
            className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
            onClick={onBackToList}
            aria-label='Back to movie list'
            title='Back to movie list'
            data-tv-focusable={isTvMode ? 'true' : undefined}
            data-tv-focus-scope={isTvMode ? 'movie-content' : undefined}
            data-tv-focus-id={isTvMode ? 'movie-watch-back' : undefined}
            data-tv-default-focus={isTvMode ? 'true' : undefined}
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
              data-tv-focusable={isTvMode ? 'true' : undefined}
              data-tv-focus-scope={isTvMode ? 'movie-content' : undefined}
              data-tv-focus-id={isTvMode ? 'movie-watch-playpause' : undefined}
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
              data-tv-focusable={isTvMode ? 'true' : undefined}
              data-tv-focus-scope={isTvMode ? 'movie-content' : undefined}
              data-tv-focus-id={isTvMode ? 'movie-watch-restart' : undefined}
            >
              <RotateCcw size={15} />
              <span className={styles.movieBtnText}>Restart</span>
            </button>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
              onClick={() => jumpBySeconds(-10)}
              disabled={!hasPlayableMovie}
              data-tv-focusable={isTvMode ? 'true' : undefined}
              data-tv-focus-scope={isTvMode ? 'movie-content' : undefined}
              data-tv-focus-id={isTvMode ? 'movie-watch-rewind' : undefined}
            >
              <Rewind size={15} />
              <span className={styles.movieBtnText}>-10s</span>
            </button>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
              onClick={() => jumpBySeconds(10)}
              disabled={!hasPlayableMovie}
              data-tv-focusable={isTvMode ? 'true' : undefined}
              data-tv-focus-scope={isTvMode ? 'movie-content' : undefined}
              data-tv-focus-id={isTvMode ? 'movie-watch-forward' : undefined}
            >
              <FastForward size={15} />
              <span className={styles.movieBtnText}>+10s</span>
            </button>
          </div>
          <div className={`${styles.moviePlayerButtonRowBottom} ${isTvMode ? styles.moviePlayerButtonRowTv : ""}`}>
            <button
              type='button'
              className={`${styles.movieNavBtn} ${isMarkedWatched ? styles.movieNavBtnSuccess : styles.movieNavBtnInactive}`}
              onClick={() => onMarkComplete?.(movie)}
              aria-label={isMarkedWatched ? 'Watched' : 'Mark Watched'}
              title={isMarkedWatched ? 'Already watched' : 'Mark Watched'}
              data-tv-focusable={isTvMode ? 'true' : undefined}
              data-tv-focus-scope={isTvMode ? 'movie-content' : undefined}
              data-tv-focus-id={isTvMode ? 'movie-watch-mark-complete' : undefined}
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
              className={`${styles.movieFavoriteBtn} ${favoriteActive ? styles.movieFavoriteBtnActive : styles.movieFavoriteBtnInactive}`}
              onClick={() => onToggleFavorite?.(movie)}
              aria-label={favoriteActive ? 'Favorited' : 'Add Favorite'}
              title={favoriteActive ? 'Favorited' : 'Add Favorite'}
              data-tv-focusable={isTvMode ? 'true' : undefined}
              data-tv-focus-scope={isTvMode ? 'movie-content' : undefined}
              data-tv-focus-id={isTvMode ? 'movie-watch-favorite' : undefined}
            >
              <Heart size={15} fill={favoriteActive ? 'currentColor' : 'none'} />
              <span className={styles.movieBtnText}>
                {favoriteActive ? 'Favorited' : 'Add Favorite'}
              </span>
            </button>
          </div>
        </div>
      </div>
      ) : null}
      {!hideTvFullscreenChrome && scrubDuration > 0 ? (
        <div className={`${styles.playerInfoPanel} ${isTvMode ? styles.playerInfoPanelTv : ""}`} style={{ marginTop: 8 }}>
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
      {!hideTvFullscreenChrome ? (
      <div className={`${styles.playerInfoPanel} ${isTvMode ? styles.playerInfoPanelTv : ""}`}>
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
      </div>
      ) : null}
    </section>
  )
}
