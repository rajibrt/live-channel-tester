// Spectrum renderers for the Radio page. Canvas 2D for most styles; the 3D ring
// loads three.js on demand so the page stays light for everyone else.

export const VIZ_MODES = [
  { id: "prism", label: "Prism bars" },
  { id: "dots", label: "Dot matrix" },
  { id: "wave", label: "Neon wave" },
  { id: "halo", label: "Halo" },
  { id: "ring3d", label: "3D ring" },
  { id: "horizon", label: "Neon horizon" },
  { id: "peaks", label: "Particle peaks" },
  { id: "mesh", label: "Wave mesh" },
  { id: "hills", label: "Glow hills" },
];

// Turns analyser bytes (or a simulated beat when the stream cannot be analysed) into
// n log-spaced bands in 0..1.
export function createBandReader() {
  let freqData = null;
  // Some browsers (notably iPhone Safari with live streams) play the sound but hand the
  // analyser only zeros. After ~1.5 s of silence-while-playing we switch to the beat motion.
  let silentFrames = 0;
  return function read(analyser, n, { playing, simulated, sampleRate, tuneProgress }) {
    const out = new Float32Array(n);
    const t = performance.now() / 1000;
    if (!playing) silentFrames = 0;
    let useAnalyser = playing && analyser && !simulated && silentFrames < 90;
    if (useAnalyser) {
      if (!freqData || freqData.length !== analyser.frequencyBinCount) freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);
      let peak = 0;
      for (let k = 0; k < freqData.length; k += 8) if (freqData[k] > peak) peak = freqData[k];
      silentFrames = peak === 0 ? silentFrames + 1 : 0;
      if (silentFrames >= 90) useAnalyser = false;
    }
    if (useAnalyser) {
      const ny = (sampleRate || 44100) / 2;
      const len = freqData.length;
      for (let i = 0; i < n; i++) {
        const f0 = 40 * Math.pow(16000 / 40, i / n);
        const f1 = 40 * Math.pow(16000 / 40, (i + 1) / n);
        const a = Math.floor((f0 / ny) * len);
        const b = Math.max(a + 1, Math.floor((f1 / ny) * len));
        let s = 0;
        for (let k = a; k < b && k < len; k++) s = Math.max(s, freqData[k]);
        // noise gate: hiss / near-silence (below ~60 of 255) stays flat instead of lighting up
        out[i] = Math.pow(Math.max(0, (s - 60) / 195), 1.3);
      }
    } else if (playing) {
      // No real audio data for this station: a slow, calm swell that clearly is not a beat
      // (user feedback: a fake rhythm looked the same for music, speech and hiss).
      for (let i = 0; i < n; i++) {
        const p = i / n;
        out[i] = 0.1 + 0.07 * Math.sin(t * 0.6 + p * 5) + 0.04 * Math.sin(t * 0.35 + p * 11);
      }
    } else {
      for (let i = 0; i < n; i++) out[i] = 0.08 + 0.06 * Math.sin(t * 1.3 + i * 0.35) + 0.05 * Math.sin(t * 2.1 + i * 0.9);
    }
    if (tuneProgress < 1) {
      for (let i = 0; i < n; i++) out[i] *= 0.25 + 0.75 * tuneProgress + Math.random() * 0.25 * (1 - tuneProgress);
    }
    return out;
  };
}

function hueAt(base, p) {
  return (base + p * 300) % 360;
}

export function drawPrism(ctx, W, H, bands, hue, state) {
  const n = W < 520 ? 28 : 48;
  const v = bands(n);
  const gap = 4;
  const bw = (W - gap * (n + 1)) / n;
  const base = H * 0.66;
  const seg = Math.max(5, H / 46);
  const peaks = state.peaks || (state.peaks = []);
  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < n; i++) {
    const x = gap + i * (bw + gap);
    const h = v[i] * base * 0.95;
    const segs = Math.floor(h / seg);
    const hh = hueAt(hue, i / n);
    peaks[i] = Math.max((peaks[i] || 0) - 0.6, segs);
    for (let s = 0; s < segs; s++) {
      ctx.fillStyle = `hsl(${hh} 95% ${48 + s * 1.2}%)`;
      ctx.fillRect(x, base - (s + 1) * seg + 1.5, bw, seg - 2.5);
    }
    ctx.fillStyle = `hsl(${hh} 100% 80%)`;
    ctx.fillRect(x, base - (peaks[i] + 1) * seg + 1.5, bw, 2);
    const g = ctx.createLinearGradient(0, base, 0, base + h * 0.6 + 1);
    g.addColorStop(0, `hsla(${hh} 95% 50% / .35)`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x, base + 2, bw, h * 0.6);
    ctx.fillStyle = `hsla(${hh} 100% 60% / .10)`;
    ctx.fillRect(x - 2, base - h - seg * 2, bw + 4, h + seg * 2);
  }
  ctx.fillStyle = "rgba(255,255,255,.25)";
  ctx.fillRect(0, base + 1, W, 1);
}

export function drawDots(ctx, W, H, bands, hue) {
  const cols = W < 520 ? 22 : 40;
  const v = bands(cols);
  const cw = W / cols;
  const rows = Math.max(4, Math.floor((H * 0.62) / cw));
  const r = cw * 0.32;
  const base = H * 0.66;
  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < cols; i++) {
    const lit = Math.round(v[i] * rows);
    const hh = hueAt(hue, i / cols);
    const x = cw * (i + 0.5);
    for (let j = 0; j < rows; j++) {
      const y = base - (j + 0.5) * cw * 0.98;
      ctx.fillStyle = j < lit ? `hsl(${hh} 95% ${50 + j * 1.5}%)` : `hsla(${hh} 60% 40% / .12)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (j < lit && j < 6) {
        ctx.fillStyle = `hsla(${hh} 95% 55% / ${0.22 - j * 0.035})`;
        ctx.beginPath();
        ctx.arc(x, base + (j + 0.5) * cw * 0.98, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function drawWave(ctx, W, H, bands, hue, state) {
  const n = 64;
  const v = bands(n);
  const t = performance.now() / 1000;
  const mid = H / 2;
  ctx.clearRect(0, 0, W, H);
  let energy = 0;
  for (let i = 0; i < n; i++) {
    energy += v[i];
    const x = ((i + 0.5) * W) / n;
    const h = v[i] * H * 0.7;
    const hh = hueAt(hue, i / n);
    const g = ctx.createLinearGradient(0, mid - h / 2, 0, mid + h / 2 + 1);
    g.addColorStop(0, "transparent");
    g.addColorStop(0.5, `hsla(${hh} 95% 60% / .85)`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x - (W / n) * 0.28, mid - h / 2, (W / n) * 0.56, h);
  }
  const amp = 0.1 + (energy / n) * 1.6;
  ctx.globalCompositeOperation = "lighter";
  for (let l = 0; l < 7; l++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const p = x / W;
      const env = Math.sin(Math.PI * p);
      const y = mid + Math.sin(p * 12 + t * (1.4 + l * 0.15) + l * 0.5) * H * 0.18 * amp * env * (1 - l * 0.08);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const g = ctx.createLinearGradient(0, 0, W, 0);
    for (let s = 0; s <= 4; s++) g.addColorStop(s / 4, `hsla(${hueAt(hue, s / 4)} 95% 65% / ${0.55 - l * 0.06})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  state.energy = energy / n;
}

export function drawHalo(ctx, W, H, bands, hue, state) {
  const n = 120;
  const v = bands(n / 2);
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.24;
  ctx.clearRect(0, 0, W, H);
  let energy = 0;
  for (const x of v) energy += x;
  energy /= v.length;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
  g.addColorStop(0, `hsla(${hue} 90% 60% / ${0.15 + energy * 0.5})`);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "butt";
  ctx.lineWidth = Math.max(2, ((Math.PI * 2 * R) / n) * 0.55);
  // Fixed ring (no rotation); each bar is solid at the ring and fades out toward its tip.
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const val = v[i < n / 2 ? i : n - 1 - i];
    const len = 6 + val * Math.min(W, H) * 0.26;
    const x0 = cx + Math.cos(a) * R;
    const y0 = cy + Math.sin(a) * R;
    const x1 = cx + Math.cos(a) * (R + len);
    const y1 = cy + Math.sin(a) * (R + len);
    const hh = hueAt(hue, i / n);
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `hsla(${hh} 95% 62% / 1)`);
    g.addColorStop(0.45, `hsla(${hh} 95% 62% / 0.85)`);
    g.addColorStop(1, `hsla(${hh} 95% 62% / 0)`);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.fillStyle = "#0b0d14";
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffb547";
  ctx.font = `700 ${Math.round(R * 0.42)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.fillText(state.dialText || "", cx, cy + R * 0.08);
  ctx.fillStyle = "#8d93ab";
  ctx.font = `500 ${Math.max(10, Math.round(R * 0.14))}px system-ui, sans-serif`;
  ctx.fillText(state.stationName || "", cx, cy + R * 0.38);
}

// three.js ring of spokes that rise with the music (inspired by a radial 3D spectrum).
export async function createRing3d(container) {
  const T = await import("three");
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const el = renderer.domElement;
  el.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  container.appendChild(el);
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(42, 1, 0.1, 100);
  const SPOKES = 160;
  const PTS = 24;
  const lines = [];
  for (let i = 0; i < SPOKES; i++) {
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(new Float32Array(PTS * 3), 3));
    const mat = new T.LineBasicMaterial({ color: new T.Color().setHSL(i / SPOKES, 0.95, 0.58) });
    const line = new T.Line(geo, mat);
    scene.add(line);
    lines.push(line);
  }
  return {
    el,
    resize(W, H) {
      renderer.setSize(W, H, false);
      cam.aspect = W / Math.max(1, H);
      cam.updateProjectionMatrix();
    },
    frame(bands, hue) {
      const v = bands(64);
      const t = performance.now() / 1000;
      cam.position.set(Math.sin(t * 0.15) * 1.2, 5.2, 7.2);
      cam.lookAt(0, 0.6, 0);
      for (let i = 0; i < SPOKES; i++) {
        const a = (i / SPOKES) * Math.PI * 2;
        const half = i < SPOKES / 2 ? i : SPOKES - i - 1;
        const val = v[Math.floor((half / (SPOKES / 2)) * 63)];
        const pos = lines[i].geometry.attributes.position.array;
        for (let p = 0; p < PTS; p++) {
          const r = 1.4 + (p / (PTS - 1)) * 4.6;
          const bump = Math.exp(-Math.pow((p - PTS * 0.38) / 2.6, 2));
          pos[p * 3] = Math.cos(a) * r;
          pos[p * 3 + 2] = Math.sin(a) * r;
          pos[p * 3 + 1] = bump * val * 3.2 * (0.75 + 0.25 * Math.sin(t * 3 + i));
        }
        lines[i].geometry.attributes.position.needsUpdate = true;
        lines[i].material.color.setHSL((i / SPOKES + hue / 360) % 1, 0.95, 0.58);
      }
      renderer.render(scene, cam);
    },
    dispose() {
      for (const l of lines) {
        l.geometry.dispose();
        l.material.dispose();
      }
      renderer.dispose();
      el.remove();
    },
  };
}

// ---- Four styles from the user's references (2026-11-12) ----

// Linear interpolation of band values across 0..1 (mirrored so bass sits in the middle).
function sampleMirrored(v, p) {
  const m = Math.abs(p - 0.5) * 2; // 0 at centre, 1 at edges
  const f = m * (v.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  return v[i] * (1 - t) + (v[Math.min(v.length - 1, i + 1)] || 0) * t;
}

// 1) Neon horizon: glowing horizon line, spiky neon waves above, dotted perspective floor below.
export function drawHorizon(ctx, W, H, bands, hue) {
  const v = bands(48);
  const t = performance.now() / 1000;
  const hy = H * 0.56;
  // Fixed neon palette (pink + cyan) like the reference, independent of the station colour.
  const pink = "hsl(312 95% 64%)";
  const cyan = "hsl(192 95% 62%)";
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";
  // floor: dotted lines running to the vanishing point
  const lines = W < 520 ? 16 : 26;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 9]);
  ctx.lineDashOffset = -((t * 40) % 11);
  for (let i = 0; i <= lines; i++) {
    const bx = (i / lines) * W * 1.8 - W * 0.4;
    const g = ctx.createLinearGradient(0, hy, 0, H);
    const c = i % 2 ? pink : cyan;
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, c);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(W / 2 + (bx - W / 2) * 0.04, hy + 4);
    ctx.lineTo(bx, H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // waves above the horizon
  for (let layer = 0; layer < 4; layer++) {
    ctx.beginPath();
    const col = layer % 2 ? cyan : pink;
    for (let x = 0; x <= W; x += 3) {
      const p = x / W;
      const amp = sampleMirrored(v, p) * H * 0.42 * (1 - layer * 0.12);
      const ripple = Math.abs(Math.sin(p * (38 + layer * 9) + t * (1.6 + layer * 0.4) + layer));
      const y = hy - amp * ripple;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.55 - layer * 0.08;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // glowing horizon band
  let energy = 0;
  for (const x of v) energy += x;
  energy /= v.length;
  const band = 3 + energy * 14;
  const hg = ctx.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, "rgba(0,0,0,0)");
  hg.addColorStop(0.2, pink);
  hg.addColorStop(0.5, "#fff");
  hg.addColorStop(0.8, pink);
  hg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hg;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, hy - band / 2, W, band);
  ctx.globalAlpha = 0.25;
  ctx.fillRect(0, hy - band * 2, W, band * 4);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

// 2) Particle peaks: a dotted terrain in perspective with glowing spikes rising from it.
export function drawPeaks(ctx, W, H, bands, hue) {
  const cols = W < 520 ? 34 : 56;
  const rows = W < 520 ? 16 : 22;
  const v = bands(cols);
  const t = performance.now() / 1000;
  const top = H * 0.5;
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";
  const spikeRow = Math.floor(rows * 0.35);
  for (let r = 0; r < rows; r++) {
    const z = r / (rows - 1); // 0 far .. 1 near
    const y0 = top + Math.pow(z, 1.6) * H * 0.48;
    const spread = 0.55 + 0.75 * z;
    const size = 0.6 + z * 2.2;
    for (let c = 0; c < cols; c++) {
      const p = c / (cols - 1);
      const x = W / 2 + (p - 0.5) * W * spread;
      const wave = Math.sin(p * 7 + t * 1.2 + z * 4) * Math.cos(z * 5 - t * 0.8) * 10 * (0.4 + z);
      const y = y0 + wave;
      const h = 190 + ((p * 110 + z * 30 + Math.sin(c * 1.7) * 20) % 130); // cyan → violet → pink
      ctx.fillStyle = `hsla(${h} 90% ${55 + z * 15}% / ${0.25 + z * 0.6})`;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      if (r === spikeRow) {
        const len = v[c] * H * 0.55;
        if (len > 4) {
          const g = ctx.createLinearGradient(0, y - len, 0, y);
          g.addColorStop(0, `hsla(${h} 100% 85% / 0)`);
          g.addColorStop(0.15, `hsla(${h} 100% 80% / 0.9)`);
          g.addColorStop(1, `hsla(${h} 95% 60% / 0.15)`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - len);
          ctx.stroke();
          ctx.fillStyle = `hsla(${h} 100% 90% / 0.95)`;
          ctx.beginPath();
          ctx.arc(x, y - len * 0.9, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

// 3) Wave mesh: flowing parallel lines in perspective with bright dots along them.
export function drawMesh(ctx, W, H, bands, hue) {
  const v = bands(40);
  const t = performance.now() / 1000;
  const lines = W < 520 ? 18 : 28;
  const step = W < 520 ? 8 : 6;
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";
  for (let l = 0; l < lines; l++) {
    const z = l / (lines - 1); // 0 back .. 1 front
    const base = H * (0.3 + z * 0.62);
    const amp = H * (0.06 + z * 0.11);
    const h = 250 + z * 70 + (l % 3) * 8; // violet → magenta, dots tinted cyan below
    ctx.beginPath();
    const pts = [];
    for (let x = -10; x <= W + 10; x += step) {
      const p = Math.min(1, Math.max(0, x / W));
      const music = v[Math.floor(p * (v.length - 1))] * 1.4;
      const y = base - (Math.sin(p * 4 + t * 0.9 + z * 2.2) * 0.6 + Math.sin(p * 9 - t * 1.3 + z) * 0.25 + music) * amp;
      pts.push([x, y]);
      if (x === -10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${h} 95% 70% / ${0.35 + z * 0.6})`;
    ctx.lineWidth = 0.8 + z * 1.4;
    ctx.stroke();
    for (let k = (l * 3) % 7; k < pts.length; k += 7) {
      const [x, y] = pts[k];
      ctx.fillStyle = k % 2 ? `hsla(190 100% 72% / ${0.35 + z * 0.6})` : `hsla(320 100% 75% / ${0.35 + z * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + z * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

// 4) Glow hills: thick, softly lit layers stacked back to front, like a 3D landscape.
// Each layer listens to its own part of the sound: the back layers follow the bass, the
// middle ones the vocal range, the front ones the high notes, so they move independently.
const HILL_RANGES = [
  [0.0, 0.12], // sub bass
  [0.06, 0.2], // bass
  [0.14, 0.3], // low mids
  [0.24, 0.42], // vocals (low)
  [0.34, 0.52], // vocals (high)
  [0.46, 0.64], // upper mids
  [0.58, 0.76], // presence
  [0.7, 0.88], // highs
  [0.82, 1.0], // air
];

function catmull(knots, p) {
  const K = knots.length - 2;
  const f = p * (K - 1) + 1;
  const i = Math.floor(f);
  const u = f - i;
  const p0 = knots[Math.max(0, i - 1)];
  const p1 = knots[i];
  const p2 = knots[Math.min(K + 1, i + 1)];
  const p3 = knots[Math.min(K + 1, i + 2)];
  const y = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  return Math.max(0, y);
}

// Sharp hill profile: each knot is a cusp-like peak that falls off quickly.
function peaked(knots, p) {
  const K = knots.length - 2;
  const f = p * (K - 1) + 1;
  const i = Math.floor(f);
  const u = f - i;
  const a = knots[i] * Math.pow(1 - u, 2.4);
  const b = knots[Math.min(K + 1, i + 1)] * Math.pow(u, 2.4);
  const floor = Math.min(knots[i], knots[Math.min(K + 1, i + 1)]) * 0.25;
  return Math.max(a, b, floor);
}

function lerpArr(arr, p) {
  const f = p * (arr.length - 1);
  const i = Math.floor(f);
  const u = f - i;
  return arr[i] * (1 - u) + arr[Math.min(arr.length - 1, i + 1)] * u;
}

// Night sky over the sea: deep gradient, a soft moon glow and twinkling stars.
function drawNightSky(ctx, W, H, horizon, state, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#03040b");
  sky.addColorStop(0.55, "#0a0d24");
  sky.addColorStop(1, "#1b1438");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);
  const moon = ctx.createRadialGradient(W * 0.78, H * 0.16, 0, W * 0.78, H * 0.16, Math.min(W, H) * 0.35);
  moon.addColorStop(0, "rgba(160,170,255,0.18)");
  moon.addColorStop(1, "rgba(160,170,255,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = "rgba(225,230,255,0.9)";
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.16, Math.max(3, Math.min(W, H) * 0.018), 0, Math.PI * 2);
  ctx.fill();
  if (!state.stars || state.starsW !== W || state.starsH !== H) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const count = Math.round((W * H) / 2600);
    state.stars = Array.from({ length: count }, () => ({ x: rnd() * W, y: rnd() * horizon * 0.95, r: 0.4 + rnd() * 1.1, ph: rnd() * 6.28, sp: 0.6 + rnd() * 1.8 }));
    state.starsW = W;
    state.starsH = H;
  }
  for (const st of state.stars) {
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
    ctx.fillStyle = `rgba(230,235,255,${a * (0.4 + 0.6 * (1 - st.y / horizon))})`;
    ctx.fillRect(st.x, st.y, st.r, st.r);
  }
  // sea below the horizon
  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, "#0d0b22");
  sea.addColorStop(1, "#020309");
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H - horizon);
}

export function drawHills(ctx, W, H, bands, _hue, state = {}) {
  const N = 72;
  const raw = bands(N);
  const t = performance.now() / 1000;
  const maxLayers = W < 520 ? 7 : 9;
  const base = H * 0.66;
  const depth = H * 0.3;
  const step = W < 520 ? 4 : 3;
  if (!state.hill || state.hill.length !== maxLayers || !state.hill[0].fluxAvg || state.hillNarrow !== W < 520) {
    state.hillNarrow = W < 520;
    // each layer gets its own number of hills and its own sideways offset,
    // so peaks never line up between layers
    state.hill = Array.from({ length: maxLayers }, (_, r) => {
      // fewer hills per layer = wide, rounded domes; peaks narrow only when the sound is sharp
      const K = (W < 520 ? 3 : 4) + ((r * 3) % 4);
      return { K, k: new Float32Array(K + 2), sharp: new Float32Array(K), prev: new Float32Array(K), fluxAvg: new Float32Array(K).fill(0.02), gain: 0.15, vis: 0, shift: ((r * 0.37) % 1) * 0.5 - 0.25 };
    });
  }
  const colors = ctx.createLinearGradient(0, 0, W, 0);
  colors.addColorStop(0, "#ff4a1c");
  colors.addColorStop(0.28, "#ff7a36");
  colors.addColorStop(0.5, "#ff4fb0");
  colors.addColorStop(0.68, "#7f8cff");
  colors.addColorStop(1, "#2fd4ff");

  const horizon = base - depth - H * 0.02;
  drawNightSky(ctx, W, H, horizon, state, t);

  for (let r = 0; r < maxLayers; r++) {
    const z = r / (maxLayers - 1); // 0 = back (bass) .. 1 = front (highs)
    const rangeIdx = Math.round(z * (HILL_RANGES.length - 1));
    const [lo, hi] = HILL_RANGES[rangeIdx];
    const a = Math.floor(lo * (N - 1));
    const b = Math.max(a + 2, Math.ceil(hi * (N - 1)));
    const L = state.hill[r];
    const K = L.K;
    const target = new Float32Array(K);
    let peak = 0;
    let tMin = 1;
    for (let k = 0; k < K; k++) {
      const f = a + (k / (K - 1)) * (b - a);
      const i = Math.floor(f);
      const u = f - i;
      target[k] = raw[i] * (1 - u) + (raw[Math.min(N - 1, i + 1)] || 0) * u;
      peak = Math.max(peak, target[k]);
      tMin = Math.min(tMin, target[k]);
    }
    L.gain = Math.max(L.gain * 0.995, peak, 0.08);
    const level = peak / L.gain;
    // Layers appear only while their range is sounding: busy music shows more layers.
    const active = peak > 0.04 ? Math.min(1, (level - 0.15) / 0.35) : 0;
    L.vis = L.vis * 0.92 + Math.max(0, active) * 0.08;
    const ease = 0.12 + z * 0.33;
    let mean = 0;
    for (let k = 0; k < K; k++) mean += target[k];
    mean /= K;
    for (let k = 0; k < K; k++) {
      const rel = (target[k] - tMin) / (peak - tMin + 0.03);
      const shaped = 0.1 + 0.9 * level * Math.pow(rel, 1.5);
      // Round or sharp is decided by the sound itself, per hill:
      //  - full, spread-out sound (this hill close to its neighbours' average) stays round;
      //  - energy concentrated in this hill (it stands well above the average) turns pointed;
      //  - a sudden rise well above this hill's usual change (a hit / attack) turns it pointed
      //    for a moment, then it relaxes back to round.
      const crest = target[k] / (mean + 0.01);
      const concentrated = Math.min(1, Math.max(0, (crest - 1.35) / 1.0));
      const rise = Math.max(0, target[k] - L.prev[k]) / L.gain;
      L.fluxAvg[k] = L.fluxAvg[k] * 0.96 + rise * 0.04;
      const attack = Math.min(1, Math.max(0, (rise - 2.2 * L.fluxAvg[k]) / (3 * L.fluxAvg[k] + 0.03)));
      const want = Math.max(concentrated * 0.85, attack);
      // quick to sharpen, slow to round off again
      L.sharp[k] += (want - L.sharp[k]) * (want > L.sharp[k] ? 0.3 : 0.05);
      L.prev[k] = target[k];
      // neighbouring hills never sit at exactly the same height (that would draw a flat top)
      const sway = 0.78 + 0.22 * Math.sin(t * 0.45 + k * 2.1 + r * 1.3) * (k % 2 ? 1 : -1);
      L.k[k + 1] = L.k[k + 1] * (1 - ease) + shaped * sway * ease;
    }
    L.k[0] = L.k[1] * 0.3;
    L.k[K + 1] = L.k[K] * 0.3;
    if (L.vis < 0.04) continue;

    const y0 = base - (1 - z) * depth;
    // never taller than the space above this layer, so peaks are never cut off flat
    const scale = Math.min(H * 0.4 * (1 - 0.55 * z), (y0 - H * 0.1) / 1.25) * (0.4 + 0.6 * L.vis);
    const drift = Math.sin(t * 0.12 + r * 1.3) * 0.03;
    let topY = y0;
    const crest = [];
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= W + step; x += step) {
      const p = Math.min(1, Math.max(0, x / W + L.shift + drift));
      const edge = Math.min(1, Math.min(x / W, 1 - x / W) * 6);
      const sh = lerpArr(L.sharp, p);
      const s2 = sh * sh; // keep most hills round unless the sound is clearly sharp
      const hv = catmull(L.k, p) * (1 - s2) + peaked(L.k, p) * 1.2 * s2;
      const y = y0 - hv * scale * (0.35 + 0.65 * edge);
      if (y < topY) topY = y;
      crest.push(x, y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, y0);
    ctx.closePath();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.85 * L.vis;
    ctx.fillStyle = "#07061a";
    ctx.fill();
    ctx.globalAlpha = (0.45 + z * 0.45) * L.vis;
    ctx.fillStyle = colors;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const shade = ctx.createLinearGradient(0, topY, 0, y0);
    shade.addColorStop(0, "rgba(255,255,255,0.1)");
    shade.addColorStop(0.18, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(6,5,22,0.75)");
    ctx.globalAlpha = L.vis;
    ctx.fillStyle = shade;
    ctx.fillRect(0, topY, W, y0 - topY + 1);
    ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (0.25 + z * 0.35) * L.vis;
    ctx.strokeStyle = colors;
    ctx.lineWidth = 1.2 + z * 1.4;
    ctx.beginPath();
    for (let k = 0; k < crest.length; k += 2) {
      if (k === 0) ctx.moveTo(crest[0], crest[1]);
      else ctx.lineTo(crest[k], crest[k + 1]);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const canvas = ctx.canvas;
  const sx = canvas.width / W;
  if ("filter" in ctx) {
    ctx.save();
    ctx.filter = "blur(14px)";
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.25;
    ctx.drawImage(canvas, 0, horizon * sx, canvas.width, (base - horizon) * sx, 0, horizon, W, base - horizon);
    ctx.restore();
  }
  // reflection of the hills (not the sky) on the sea
  ctx.save();
  ctx.translate(0, base * 2);
  ctx.scale(1, -1);
  ctx.globalAlpha = 0.3;
  if ("filter" in ctx) ctx.filter = "blur(3px)";
  ctx.drawImage(canvas, 0, horizon * sx, canvas.width, (base - horizon) * sx, 0, horizon, W, base - horizon);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, base, 0, H);
  fade.addColorStop(0, "rgba(6,5,20,0.1)");
  fade.addColorStop(0.7, "rgba(3,3,10,0.85)");
  fade.addColorStop(1, "rgba(2,3,9,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, base, W, H - base);
  // faint shimmer lines on the water
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const y = base + 6 + i * ((H - base) / 7);
    const w = W * (0.15 + 0.1 * Math.sin(t * 0.7 + i));
    ctx.fillStyle = `rgba(140,150,255,${0.05 - i * 0.006})`;
    ctx.fillRect(W / 2 - w / 2 + Math.sin(t * 0.5 + i * 2) * 40, y, w, 1);
  }
  ctx.globalCompositeOperation = "source-over";
}
