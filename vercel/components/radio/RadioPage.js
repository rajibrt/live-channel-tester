"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveBrowserPlaybackUrl } from "../../lib/streamUrl";
import styles from "./radio.module.css";
import { VIZ_MODES, createBandReader, createRing3d, drawDots, drawHalo, drawHills, drawHorizon, drawMesh, drawPeaks, drawPrism, drawWave } from "./visualizers";

const FMIN = 87.5;
const FMAX = 108.0;
const ONLINE_SPAN = 2.4; // online-only stations sit on a short "WEB" segment after 108 MHz
const STARTUP_TIMEOUT_MS = 10000;
const STALL_TIMEOUT_MS = 12000;
const MODE_KEY = "webtvbd:radio-mode";
const STATION_KEY = "webtvbd:radio-station";
const FAV_KEY = "webtvbd:radio-favorites";
const SOURCE_KEY = "webtvbd:radio-source:";
const HUES = [330, 20, 200, 45, 140, 265, 175, 0, 100, 285, 55, 15, 190, 315];

function store(get, key, value) {
  try {
    if (get) return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: preferences are just not remembered
  }
  return null;
}

function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hls-script="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Hls), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
    s.async = true;
    s.dataset.hlsScript = "1";
    s.onload = () => resolve(window.Hls);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const isHls = (url) => /\.m3u8(\?|$)/i.test(url);
const dialText = (s) => (s?.frequency != null && s.band !== "Online" ? (s.band === "AM" ? String(Math.round(s.frequency)) : s.frequency.toFixed(1)) : "WEB");
const unitText = (s) => (s?.frequency != null && s.band !== "Online" ? (s.band === "AM" ? "kHz AM" : `MHz ${s.band}`) : "ONLINE");
const initials = (name) => String(name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function report(sourceId, ok) {
  if (!sourceId) return;
  fetch("/api/client/radio/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceId, ok }),
    keepalive: true,
  }).catch(() => {});
}

// Rotating bold messages inside the spectrum (set in Dashboard → Radio → Spectrum messages).
// Short text fades in and out at the top; long notices scroll across.
function SpectrumMessage({ messages, glowRef }) {
  const list = Array.isArray(messages?.list) ? messages.list.filter(Boolean) : [];
  const seconds = Number(messages?.seconds) || 8;
  const [i, setI] = useState(0);
  const text = list.length ? list[i % list.length] : "";
  const long = text.length > 46;
  const dur = long ? Math.max(seconds, Math.round(text.length * 0.22)) : seconds;
  useEffect(() => {
    if (!list.length) return undefined;
    const id = setTimeout(() => setI((n) => n + 1), dur * 1000);
    return () => clearTimeout(id);
  }, [i, dur, list.length, long]);
  if (!text) return null;
  return (
    <div className={`${styles.spMsg} ${long ? styles.spMsgLong : ""}`} ref={glowRef} aria-live="polite">
      <span key={i} className={styles.spMsgOuter} style={{ "--dur": `${dur}s` }}>
        <span className={styles.spMsgText}>{text}</span>
      </span>
    </div>
  );
}

export default function RadioPage({ stations = [], initialFavorites = [], signedIn = false, messages = null }) {
  const list = useMemo(
    () =>
      stations.map((s, i) => ({
        ...s,
        hue: HUES[i % HUES.length],
      })),
    [stations]
  );
  const regions = useMemo(() => {
    const order = ["Bangladesh", "India · Bangla", "India · Hindi", "International"];
    const present = [...new Set(list.map((s) => s.region || "Bangladesh"))];
    return present.sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99 || a.localeCompare(b));
  }, [list]);
  const [index, setIndex] = useState(0);
  const region = list[index]?.region || regions[0] || "Bangladesh";
  const [favIds, setFavIds] = useState(() => initialFavorites.map(String));
  const [favTab, setFavTab] = useState(false);
  const favSet = useMemo(() => new Set(favIds), [favIds]);
  const favStations = useMemo(() => favIds.map((id) => list.find((s) => s.id === id)).filter(Boolean), [favIds, list]);
  const view = useMemo(
    () => (favTab ? favStations : list.filter((s) => (s.region || "Bangladesh") === region)),
    [favTab, favStations, list, region]
  );
  const fmStations = view.filter((s) => s.band === "FM" && s.frequency != null);
  const webStations = view.filter((s) => !(s.band === "FM" && s.frequency != null));
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | playing | error
  const [linkInfo, setLinkInfo] = useState({ index: 0, total: 0 });
  const [mode, setMode] = useState("prism");
  const [volume, setVolume] = useState(80);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [simulated, setSimulated] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [full, setFull] = useState(false);
  const [bare, setBare] = useState(false); // full screen with every overlay hidden
  const [navOn, setNavOn] = useState(false); // style arrows: shown while the pointer moves over the spectrum
  const navTimer = useRef(null);
  const fullRef = useRef(false);
  const toggleFullRef = useRef(null);
  const stepRef = useRef(null);
  const volumeKeyRef = useRef(null);
  const startPlaybackRef = useRef(null);
  const indexRef = useRef(0);

  const station = list[index] || null;
  const scaleWrapRef = useRef(null);
  const scaleRef = useRef(null);
  const stageRef = useRef(null);
  const vizRef = useRef(null);
  const analysedRef = useRef(null); // <audio crossOrigin> routed through the analyser
  const plainRef = useRef(null); // <audio> for streams that do not allow analysis
  const acRef = useRef(null);
  const analyserRef = useRef(null);
  const hlsRef = useRef(null);
  const attemptRef = useRef(0);
  const timersRef = useRef({});
  const tunedAtRef = useRef(0);
  const ringRef = useRef(null);
  const vizStateRef = useRef({});
  const toastTimer = useRef(null);
  const readBands = useMemo(() => createBandReader(), []);
  const msgRef = useRef(null);
  const glowBuf = useRef(null);

  // Restore preferences after hydration.
  useEffect(() => {
    const m = store(true, MODE_KEY);
    if (m && VIZ_MODES.some((x) => x.id === m)) setMode(m);
    const sid = store(true, STATION_KEY);
    const i = Math.max(0, list.findIndex((s) => s.id === sid));
    setIndex(i);
    // Resume the last station (or the first one) as soon as the page opens.
    if (list[i]) startPlaybackRef.current?.(list[i], { auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  // If the browser blocked sound on open, the first touch anywhere starts it.
  useEffect(() => {
    if (!needsTap) return undefined;
    // Buttons and links handle their own tap (play, a station, a tab), so skip those here.
    const go = (e) => {
      if (e?.target?.closest?.("button, a, input, select, label")) return;
      startPlaybackRef.current?.(list[indexRef.current]);
    };
    document.addEventListener("pointerdown", go);
    document.addEventListener("keydown", go);
    return () => {
      document.removeEventListener("pointerdown", go);
      document.removeEventListener("keydown", go);
    };
  }, [needsTap, list]);

  const say = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }, []);

  // ---------- dial ----------
  const posOf = useCallback(
    (s) => {
      const span = FMAX - FMIN + ONLINE_SPAN;
      let v;
      if (s.band === "FM" && s.frequency != null) v = Math.min(FMAX, Math.max(FMIN, s.frequency)) - FMIN;
      else {
        const k = webStations.indexOf(s);
        v = FMAX - FMIN + 0.8 + (k * (ONLINE_SPAN - 1)) / Math.max(1, webStations.length - 1);
      }
      return 0.03 + 0.94 * (v / span);
    },
    [webStations]
  );

  const drawScale = useCallback(() => {
    const canvas = scaleRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const span = FMAX - FMIN + ONLINE_SPAN;
    const x = (v) => (0.03 + 0.94 * (v / span)) * w;
    const narrow = w < 520;
    for (let i = 0; i <= 100; i++) {
      const f = 88 + i * 0.2;
      const whole = i % 5 === 0;
      const major = whole && Math.round(f) % 2 === 0;
      const X = x(f - FMIN);
      ctx.strokeStyle = major ? "#c9cde0" : whole ? "#5b6178" : "#2c3042";
      ctx.lineWidth = major ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(X, 10);
      ctx.lineTo(X, major ? 34 : whole ? 26 : 18);
      ctx.stroke();
      if (major && (!narrow || Math.round(f) % 4 === 0)) {
        ctx.fillStyle = "#8d93ab";
        ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = "center";
        ctx.fillText(String(Math.round(f)), X, 48);
      }
    }
    if (webStations.length) {
      const ox = x(FMAX - FMIN + 0.5);
      ctx.fillStyle = "#3a3f55";
      ctx.fillRect(ox - 0.5, 10, 1, 24);
      ctx.fillStyle = "#8d93ab";
      ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = "left";
      ctx.fillText("WEB", ox + 6, 48);
    }
    view.forEach((s) => {
      ctx.fillStyle = `hsl(${s.hue} 90% 62%)`;
      ctx.beginPath();
      ctx.arc(posOf(s) * w, 62, s === list[index] ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [view, list, index, posOf, webStations.length]);

  const needleLeft = station ? `${posOf(station) * 100}%` : "0%";

  // ---------- playback ----------
  const clearTimers = () => {
    clearTimeout(timersRef.current.start);
    clearTimeout(timersRef.current.stall);
  };

  const stopAll = useCallback(() => {
    clearTimers();
    attemptRef.current += 1;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    for (const el of [analysedRef.current, plainRef.current]) {
      if (!el) continue;
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
  }, []);

  const ensureAudioGraph = useCallback(() => {
    if (acRef.current) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.78;
    const src = ac.createMediaElementSource(analysedRef.current);
    src.connect(analyser);
    analyser.connect(ac.destination);
    acRef.current = ac;
    analyserRef.current = analyser;
  }, []);

  // Plays station links in order. Each link is tried on the analysed element first and,
  // if the server blocks analysis (CORS), on the plain element with a simulated spectrum.
  const startStation = useCallback(
    (st) => {
      if (!st) return;
      stopAll();
      const attempt = attemptRef.current;
      const sources = [...st.sources];
      const remembered = store(true, SOURCE_KEY + st.id);
      const ri = sources.findIndex((s) => s.id === remembered);
      if (ri > 0) sources.unshift(sources.splice(ri, 1)[0]);
      const plan = [];
      for (const s of sources) {
        plan.push({ source: s, analysed: true });
        plan.push({ source: s, analysed: false });
      }
      setStatus("loading");
      tunedAtRef.current = performance.now();

      const tryStep = async (k) => {
        if (attempt !== attemptRef.current) return;
        if (k >= plan.length) {
          setStatus("error");
          setPlaying(false);
          say(`${st.name} is not playing on your network right now`);
          return;
        }
        const { source, analysed } = plan[k];
        const linkNo = sources.indexOf(source) + 1;
        setLinkInfo({ index: linkNo, total: sources.length });
        if (analysed && linkNo > 1) say(`Trying backup link ${linkNo}/${sources.length}`);
        const el = analysed ? analysedRef.current : plainRef.current;
        const other = analysed ? plainRef.current : analysedRef.current;
        other.pause();
        el.volume = volume / 100;
        const url = resolveBrowserPlaybackUrl(source.url, window.location.protocol);
        let settled = false;

        const fail = () => {
          if (settled || attempt !== attemptRef.current) return;
          settled = true;
          clearTimers();
          cleanup();
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          el.pause();
          if (!analysed) report(source.id, false);
          tryStep(k + 1);
        };
        const onPlaying = () => {
          if (attempt !== attemptRef.current) return;
          clearTimeout(timersRef.current.stall);
          if (settled) return;
          settled = true;
          clearTimeout(timersRef.current.start);
          setStatus("playing");
          setSimulated(!analysed);
          report(source.id, true);
          store(false, SOURCE_KEY + st.id, source.id);
        };
        const onWaiting = () => {
          if (!settled || attempt !== attemptRef.current) return;
          clearTimeout(timersRef.current.stall);
          timersRef.current.stall = setTimeout(() => {
            settled = false;
            report(source.id, false);
            say("Signal lost · switching link");
            fail();
          }, STALL_TIMEOUT_MS);
        };
        const onError = () => fail();
        const cleanup = () => {
          el.removeEventListener("playing", onPlaying);
          el.removeEventListener("waiting", onWaiting);
          el.removeEventListener("stalled", onWaiting);
          el.removeEventListener("error", onError);
        };
        el.addEventListener("playing", onPlaying);
        el.addEventListener("waiting", onWaiting);
        el.addEventListener("stalled", onWaiting);
        el.addEventListener("error", onError);
        timersRef.current.start = setTimeout(fail, STARTUP_TIMEOUT_MS);

        try {
          if (isHls(source.url) && !el.canPlayType("application/vnd.apple.mpegurl")) {
            const Hls = await loadHls();
            if (attempt !== attemptRef.current) return;
            if (!Hls?.isSupported()) return fail();
            const hls = new Hls({ lowLatencyMode: false, xhrSetup: (xhr) => (xhr.withCredentials = false) });
            hlsRef.current = hls;
            hls.on(Hls.Events.ERROR, (_e, data) => data?.fatal && fail());
            hls.loadSource(url);
            hls.attachMedia(el);
          } else {
            el.src = url;
          }
          await el.play();
        } catch (err) {
          if (err?.name === "NotAllowedError" && attempt === attemptRef.current) {
            // The browser blocked sound before the viewer touched the page.
            settled = true;
            clearTimers();
            cleanup();
            setStatus("idle");
            setPlaying(false);
            setNeedsTap(true);
            return;
          }
          fail();
        }
      };
      tryStep(0);
    },
    [say, stopAll, volume]
  );

  // Starts a station; returns false when the browser still needs a tap before sound may play.
  const startPlayback = useCallback(
    async (st, { auto = false } = {}) => {
      if (!st) return false;
      ensureAudioGraph();
      try {
        await acRef.current?.resume();
      } catch {
        // resume can fail on very old browsers; playback still works
      }
      if (auto && acRef.current && acRef.current.state !== "running") {
        setNeedsTap(true);
        return false;
      }
      setNeedsTap(false);
      setPlaying(true);
      startStation(st);
      return true;
    },
    [ensureAudioGraph, startStation]
  );

  const play = useCallback(() => startPlayback(station), [startPlayback, station]);
  startPlaybackRef.current = startPlayback;
  indexRef.current = index;

  const pause = useCallback(() => {
    setPlaying(false);
    setStatus("idle");
    stopAll();
  }, [stopAll]);

  const tune = useCallback(
    (i) => {
      const next = (i + list.length) % list.length;
      if (next === index && list.length > 1) {
        if (!playing) startPlayback(list[next]);
        return;
      }
      setIndex(next);
      tunedAtRef.current = performance.now();
      if (list[next]) store(false, STATION_KEY, list[next].id);
      // Choosing a station (tile, dial, tab, next/previous) always starts it.
      startPlayback(list[next]);
    },
    [list, startPlayback, index, playing]
  );

  // Previous / next stay inside the selected group.
  const step = useCallback(
    (delta) => {
      if (!view.length) return;
      const at = Math.max(0, view.indexOf(list[index]));
      tune(list.indexOf(view[(at + delta + view.length) % view.length]));
    },
    [view, list, index, tune]
  );
  const chooseRegion = (r) => {
    setFavTab(false);
    if (r === region) return;
    const first = list.findIndex((s) => (s.region || "Bangladesh") === r);
    if (first >= 0) tune(first);
  };

  // Favourites: saved to the account when signed in, otherwise on this device.
  useEffect(() => {
    if (signedIn) return;
    const raw = store(true, FAV_KEY);
    if (raw) {
      try {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setFavIds(ids.map(String));
      } catch {
        // ignore a damaged value
      }
    }
  }, [signedIn]);

  const toggleFavorite = useCallback(
    (st) => {
      if (!st) return;
      const on = !favSet.has(st.id);
      const next = on ? [st.id, ...favIds] : favIds.filter((id) => id !== st.id);
      setFavIds(next);
      say(on ? `Added ${st.name} to favourites` : `Removed ${st.name} from favourites`);
      if (!signedIn) {
        store(false, FAV_KEY, JSON.stringify(next));
        return;
      }
      fetch("/api/client/radio/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stationId: Number(st.id), favorite: on }),
      })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => {
          setFavIds(favIds);
          say("Could not save the favourite. Please try again.");
        });
    },
    [favIds, favSet, say, signedIn]
  );

  useEffect(() => {
    for (const el of [analysedRef.current, plainRef.current]) if (el) el.volume = volume / 100;
  }, [volume]);

  useEffect(() => () => stopAll(), [stopAll]);

  // Lock-screen / headset controls.
  useEffect(() => {
    if (!station || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: station.name,
        artist: `${dialText(station)} ${unitText(station)}`.trim(),
        album: "WEBTVBD Radio",
        artwork: station.logoUrl ? [{ src: station.logoUrl, sizes: "512x512" }] : [{ src: "/logo.png", sizes: "512x512" }],
      });
      navigator.mediaSession.setActionHandler("play", play);
      navigator.mediaSession.setActionHandler("pause", pause);
      navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
    } catch {
      // Media Session is optional
    }
  }, [station, play, pause, step]);

  // ---------- visualizer loop ----------
  const wakeNav = () => {
    setNavOn(true);
    clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => setNavOn(false), 2200);
  };
  const cycleMode = (delta) => {
    const i = VIZ_MODES.findIndex((x) => x.id === mode);
    const next = VIZ_MODES[(i + delta + VIZ_MODES.length) % VIZ_MODES.length];
    chooseMode(next.id);
    say(next.label);
  };
  const chooseMode = (m) => {
    setMode(m);
    store(false, MODE_KEY, m);
    vizStateRef.current = {};
  };

  useEffect(() => {
    let raf = 0;
    let disposed = false;
    const stage = stageRef.current;
    const canvas = vizRef.current;
    if (!stage || !canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let W = 0;
    let H = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = stage.clientWidth;
      H = stage.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ringRef.current?.resize(W, H);
      drawScale();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    ro.observe(scaleWrapRef.current);
    resize();

    if (mode === "ring3d" && !ringRef.current) {
      createRing3d(stage)
        .then((ring) => {
          if (disposed) return ring.dispose();
          ringRef.current = ring;
          ring.resize(W, H);
        })
        .catch(() => {
          say("3D view is not supported here · showing Halo");
          chooseMode("halo");
        });
    }
    if (mode !== "ring3d" && ringRef.current) {
      ringRef.current.dispose();
      ringRef.current = null;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = list[index];
    const loop = () => {
      const tuneProgress = Math.min(1, (performance.now() - tunedAtRef.current) / 600);
      const bands = (n) =>
        readBands(analyserRef.current, n, {
          playing: status === "playing",
          simulated,
          sampleRate: acRef.current?.sampleRate,
          tuneProgress,
        });
      const hue = st?.hue ?? 180;
      const state = vizStateRef.current;
      state.dialText = dialText(st);
      state.stationName = st?.name || "";
      if (mode === "prism") drawPrism(ctx, W, H, bands, hue, state);
      else if (mode === "dots") drawDots(ctx, W, H, bands, hue, state);
      else if (mode === "wave") drawWave(ctx, W, H, bands, hue, state);
      else if (mode === "halo") drawHalo(ctx, W, H, bands, hue, state);
      else if (mode === "horizon") drawHorizon(ctx, W, H, bands, hue, state);
      else if (mode === "peaks") drawPeaks(ctx, W, H, bands, hue, state);
      else if (mode === "mesh") drawMesh(ctx, W, H, bands, hue, state);
      else if (mode === "hills") drawHills(ctx, W, H, bands, hue, state);
      else if (mode === "ring3d") {
        ctx.clearRect(0, 0, W, H);
        ringRef.current?.frame(bands, hue);
      }
      // let the message glow breathe with the music (bass energy)
      if (msgRef.current) {
        let g = 0.15;
        const an = analyserRef.current;
        if (an && status === "playing") {
          if (!glowBuf.current || glowBuf.current.length !== an.frequencyBinCount) glowBuf.current = new Uint8Array(an.frequencyBinCount);
          an.getByteFrequencyData(glowBuf.current);
          let sum = 0;
          for (let k = 2; k < 40; k++) sum += glowBuf.current[k];
          g = sum / (38 * 255);
          if (g === 0) g = 0.35 + 0.25 * Math.sin(performance.now() / 260);
        }
        msgRef.current.style.setProperty("--glow", g.toFixed(3));
      }
      raf = reduce && status !== "playing" ? window.setTimeout(() => requestAnimationFrame(loop), 300) : requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, index, status, simulated, list, drawScale]);

  useEffect(
    () => () => {
      ringRef.current?.dispose();
      ringRef.current = null;
      acRef.current?.close?.();
    },
    []
  );

  const onScaleClick = (e) => {
    const r = scaleWrapRef.current.getBoundingClientRect();
    const p = (e.clientX - r.left) / r.width;
    let best = index;
    let bd = 9;
    view.forEach((s) => {
      const d = Math.abs(posOf(s) - p);
      if (d < bd) {
        bd = d;
        best = list.indexOf(s);
      }
    });
    tune(best);
  };

  // Full-screen spectrum: real fullscreen where the browser allows it, and a fixed
  // full-window layer everywhere (iPhone Safari cannot fullscreen a non-video element).
  const enterFull = () => {
    setFull(true);
    const el = stageRef.current;
    try {
      if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch {
      // fixed layer still covers the window
    }
  };
  const exitFull = () => {
    setFull(false);
    setBare(false);
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
    } catch {
      // nothing to exit
    }
  };
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setFull(false);
        setBare(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setFull(false);
        setBare(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = String(e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      // e.code is the physical key, so F / I work in English, Bangla (Avro, Bijoy, Probhat) or any layout
      const key = String(e.key || "");
      // Same as the TV player: left/right change station, up/down change volume.
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        stepRef.current?.(e.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        volumeKeyRef.current?.(e.key === "ArrowUp" ? 5 : -5);
        return;
      }
      if (e.code === "KeyF" || key === "f" || key === "F" || key === "ফ") {
        e.preventDefault();
        toggleFullRef.current?.();
      } else if (e.code === "KeyI" || key === "i" || key === "I" || key === "ই" || key === "ি") {
        if (!fullRef.current) return;
        e.preventDefault();
        setBare((b) => !b);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  fullRef.current = full;
  stepRef.current = step;
  volumeKeyRef.current = (delta) => {
    setVolume((v) => {
      const next = Math.max(0, Math.min(100, v + delta));
      say(`Volume ${next}%`);
      return next;
    });
  };
  toggleFullRef.current = () => (fullRef.current ? exitFull() : enterFull());
  useEffect(() => {
    document.body.style.overflow = full ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [full]);

  const q = query.trim().toLowerCase();
  const shown = (q ? list : view).filter((s) => !q || `${s.name} ${s.nameBn} ${s.frequency ?? "online"}`.toLowerCase().includes(q));
  const liveLabel = status === "playing" ? "ON AIR" : status === "loading" ? "TUNING" : status === "error" ? "NO SIGNAL" : playing ? "TUNING" : "STANDBY";
  const hint =
    status === "error"
      ? "None of this station's links are playing right now. Try another station."
      : needsTap
        ? "Tap anywhere to start listening"
        : status === "idle"
        ? "Press play to listen"
        : simulated && status === "playing"
          ? "This station does not share its audio data, so the spectrum follows the beat"
          : "";

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.topbar}>
          <a href="/" className={styles.brand}>
            <img src="/logo.png" alt="" />
            <span>
              WEBTVBD <b>Radio</b>
            </span>
          </a>
          <nav className={styles.nav} aria-label="Sections">
            <a className={styles.navLink} href="/watch">
              Live TV
            </a>
            <a className={styles.navLink} href="/watch?mode=movies">
              Movies
            </a>
            <a className={`${styles.navLink} ${styles.navActive}`} href="/radio" aria-current="page">
              Radio
            </a>
          </nav>
        </header>

        {!list.length ? (
          <div className={styles.deck}>
            <p className={styles.empty}>No radio stations are available yet. Please check back soon.</p>
          </div>
        ) : (
          <section className={styles.app} aria-label="Radio player">
            <div className={styles.deck}>
              {regions.length > 1 || favIds.length ? (
                <div className={styles.regions} role="tablist" aria-label="Station groups">
                  <button type="button" role="tab" aria-selected={favTab} className={styles.regionTab} onClick={() => setFavTab(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={favTab ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.4 5 7 5c2 0 3.6 1.1 5 2.9C13.4 6.1 15 5 17 5c3.6 0 5.8 3.6 4.5 6.8C19.5 16.4 12 21 12 21z" />
                    </svg>
                    Favourites
                    <span>{favStations.length}</span>
                  </button>
                  {regions.map((r) => (
                    <button key={r} type="button" role="tab" aria-selected={!favTab && r === region} className={styles.regionTab} onClick={() => chooseRegion(r)}>
                      {r}
                      <span>{list.filter((s) => (s.region || "Bangladesh") === r).length}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className={styles.dial}>
                <div className={styles.readout}>
                  <div className={styles.freq} aria-live="polite">
                    {dialText(station)}
                    <small>{unitText(station)}</small>
                  </div>
                  <div className={styles.now}>
                    <span className={`${styles.live} ${status === "playing" ? styles.liveOn : ""}`}>
                      <i />
                      {liveLabel}
                    </span>
                    <div className={styles.nowRow}>
                      <div className={styles.nowName}>{station?.name}</div>
                      <button
                        type="button"
                        className={`${styles.heart} ${station && favSet.has(station.id) ? styles.heartOn : ""}`}
                        onClick={() => toggleFavorite(station)}
                        aria-pressed={station ? favSet.has(station.id) : false}
                        aria-label={station && favSet.has(station.id) ? "Remove from favourites" : "Add to favourites"}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.4 5 7 5c2 0 3.6 1.1 5 2.9C13.4 6.1 15 5 17 5c3.6 0 5.8 3.6 4.5 6.8C19.5 16.4 12 21 12 21z" />
                        </svg>
                      </button>
                    </div>
                    {station?.nameBn ? <div className={styles.nowBn}>{station.nameBn}</div> : null}
                  </div>
                </div>
                <div className={styles.scaleWrap} ref={scaleWrapRef} onClick={onScaleClick} title="Tap the dial to tune">
                  <canvas ref={scaleRef} aria-hidden="true" />
                  <div className={styles.needle} style={{ left: needleLeft }} />
                </div>
                <div className={styles.bands}>
                  <span className={styles.tag}>FM 87.5 – 108.0 MHz{webStations.length ? " · Online after 108" : ""}</span>
                  <span className={styles.tag}>
                    {fmStations.length} FM · {webStations.length} online
                  </span>
                </div>
              </div>

              <div
                className={`${styles.stage} ${full ? styles.stageFull : ""} ${full && bare ? styles.stageBare : ""} ${navOn ? styles.navOn : ""}`}
                ref={stageRef}
                onPointerMove={wakeNav}
                onPointerDown={wakeNav}
                onPointerLeave={() => {
                  clearTimeout(navTimer.current);
                  setNavOn(false);
                }}
                onClick={full && bare ? () => setBare(false) : undefined}
              >
                <canvas ref={vizRef} aria-hidden="true" />
                <SpectrumMessage messages={messages} glowRef={msgRef} />
                <button type="button" className={`${styles.styleNav} ${styles.styleNavPrev}`} onClick={() => {
                    cycleMode(-1);
                    wakeNav();
                  }} aria-label="Previous spectrum style" title="Previous style">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <button type="button" className={`${styles.styleNav} ${styles.styleNavNext}`} onClick={() => {
                    cycleMode(1);
                    wakeNav();
                  }} aria-label="Next spectrum style" title="Next style">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {toast ? <div className={styles.toast}>{toast}</div> : null}
                {hint ? <div className={styles.hint}>{hint}</div> : null}
                {full ? (
                  <div className={styles.fullDock}>
                    <div className={styles.dockInfo}>
                      <img src="/logo.png" alt="WEBTVBD" className={styles.dockBrand} />
                      <span className={styles.dockDivider} aria-hidden="true" />
                      {station?.logoUrl ? (
                        <img src={station.logoUrl} alt="" className={styles.dockLogo} />
                      ) : (
                        <span className={styles.dockLogo} style={{ background: `linear-gradient(135deg,hsl(${station?.hue ?? 200} 80% 52%),hsl(${((station?.hue ?? 200) + 40) % 360} 80% 36%))` }}>
                          {initials(station?.name)}
                        </span>
                      )}
                      <div className={styles.dockText}>
                        <span className={styles.dockFreq}>
                          {dialText(station)}
                          <small>{unitText(station)}</small>
                        </span>
                        <strong>{station?.name}</strong>
                      </div>
                    </div>
                    <div className={styles.dockControls}>
                      <button type="button" className={styles.dockBtn} onClick={() => step(-1)} aria-label="Previous station">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M6 5h2v14H6zM20 5v14L9 12z" />
                        </svg>
                      </button>
                      <button type="button" className={`${styles.dockBtn} ${styles.dockPlay}`} onClick={playing ? pause : play} aria-label={playing ? "Pause" : "Play"}>
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
                        </svg>
                      </button>
                      <button type="button" className={styles.dockBtn} onClick={() => step(1)} aria-label="Next station">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
                        </svg>
                      </button>
                      <span className={styles.dockStyle}>
                        <button type="button" className={styles.dockBtn} onClick={() => cycleMode(-1)} aria-label="Previous spectrum style" title="Previous style">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                            <path d="M15 5l-7 7 7 7" />
                          </svg>
                        </button>
                        <span>{VIZ_MODES.find((x) => x.id === mode)?.label}</span>
                        <button type="button" className={styles.dockBtn} onClick={() => cycleMode(1)} aria-label="Next spectrum style" title="Next style">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </span>
                    </div>
                    <div className={styles.dockActions}>
                      <span className={styles.dockKeys} aria-hidden="true">
                        <kbd>←</kbd><kbd>→</kbd> station <kbd>↑</kbd><kbd>↓</kbd> volume <kbd>I</kbd> hide <kbd>F</kbd> exit
                      </span>
                      <button type="button" className={styles.dockBtn} onClick={() => setBare(true)} aria-label="Hide all info (I)" title="Hide all info (I)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-3 4.2M6.3 6.3C4.3 7.6 2.8 9.6 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                        </svg>
                      </button>
                      <button type="button" className={styles.dockBtn} onClick={exitFull} aria-label="Exit full screen (F or Esc)" title="Exit full screen (F or Esc)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={styles.fullBtn} onClick={enterFull} aria-label="Full screen spectrum (F)" title="Full screen (F)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                    </svg>
                  </button>
                )}
                {full && bare ? <div className={styles.bareHint}>Tap to show controls</div> : null}
              </div>

              <div className={styles.modes} role="group" aria-label="Spectrum style">
                {VIZ_MODES.map((m) => (
                  <button key={m.id} type="button" className={styles.chip} aria-pressed={mode === m.id} onClick={() => chooseMode(m.id)}>
                    {m.label}
                  </button>
                ))}
                <span className={styles.keyHint}>
                  <kbd>F</kbd> full screen · <kbd>I</kbd> hide info · <kbd>←</kbd><kbd>→</kbd> station · <kbd>↑</kbd><kbd>↓</kbd> volume
                </span>
              </div>

              <div className={styles.transport}>
                <button type="button" className={styles.btn} onClick={() => step(-1)} aria-label="Previous station">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6 5h2v14H6zM20 5v14L9 12z" />
                  </svg>
                </button>
                <button type="button" className={`${styles.btn} ${styles.play}`} onClick={playing ? pause : play} aria-label={playing ? "Pause" : "Play"}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
                  </svg>
                </button>
                <button type="button" className={styles.btn} onClick={() => step(1)} aria-label="Next station">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
                  </svg>
                </button>
                <label className={styles.vol} htmlFor="radio-volume">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7" />
                  </svg>
                  <input id="radio-volume" type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" />
                </label>
                {linkInfo.total ? (
                  <span className={styles.linkpill}>
                    Link <b>{linkInfo.index}</b>/{linkInfo.total}
                  </span>
                ) : null}
              </div>
              <audio ref={analysedRef} crossOrigin="anonymous" preload="none" playsInline />
              <audio ref={plainRef} preload="none" playsInline />
            </div>

            <aside className={styles.rack} aria-label="Stations">
              <h2>{q ? "Search results" : favTab ? "Favourites" : region}</h2>
              <input className={styles.search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or frequency" aria-label="Search stations" />
              <div className={styles.list}>
                {favTab && !q && !favStations.length ? (
                  <p className={styles.emptyList}>No favourites yet. Tap the heart next to a station name to keep it here{signedIn ? "" : " on this device"}.</p>
                ) : null}
                {shown.map((s) => {
                  const i = list.indexOf(s);
                  const fav = favSet.has(s.id);
                  return (
                    <div key={s.id} className={styles.stationWrap}>
                    <button type="button" className={styles.station} aria-current={i === index ? "true" : "false"} onClick={() => tune(i)}>
                      {s.logoUrl ? (
                        <img className={styles.logo} src={s.logoUrl} alt="" loading="lazy" />
                      ) : (
                        <span className={styles.logo} style={{ background: `linear-gradient(135deg,hsl(${s.hue} 80% 52%),hsl(${(s.hue + 40) % 360} 80% 36%))` }}>
                          {initials(s.name)}
                        </span>
                      )}
                      <span className={styles.stText}>
                        <div>{s.name}</div>
                        <small>{[s.nameBn, s.city].filter(Boolean).join(" · ") || `${s.sources.length} link${s.sources.length > 1 ? "s" : ""}`}</small>
                      </span>
                      <span className={styles.stFreq}>{dialText(s)}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.tileHeart} ${fav ? styles.heartOn : ""}`}
                      onClick={() => toggleFavorite(s)}
                      aria-pressed={fav}
                      aria-label={fav ? `Remove ${s.name} from favourites` : `Add ${s.name} to favourites`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.4 5 7 5c2 0 3.6 1.1 5 2.9C13.4 6.1 15 5 17 5c3.6 0 5.8 3.6 4.5 6.8C19.5 16.4 12 21 12 21z" />
                      </svg>
                    </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          </section>
        )}
      </div>
    </div>
  );
}
