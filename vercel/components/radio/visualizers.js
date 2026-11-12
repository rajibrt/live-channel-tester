// Spectrum renderers for the Radio page. Canvas 2D for most styles; the 3D ring
// loads three.js on demand so the page stays light for everyone else.

export const VIZ_MODES = [
  { id: "prism", label: "Prism bars" },
  { id: "dots", label: "Dot matrix" },
  { id: "wave", label: "Neon wave" },
  { id: "halo", label: "Halo" },
  { id: "ring3d", label: "3D ring" },
];

// Turns analyser bytes (or a simulated beat when the stream cannot be analysed) into
// n log-spaced bands in 0..1.
export function createBandReader() {
  let freqData = null;
  return function read(analyser, n, { playing, simulated, sampleRate, tuneProgress }) {
    const out = new Float32Array(n);
    const t = performance.now() / 1000;
    if (playing && analyser && !simulated) {
      if (!freqData || freqData.length !== analyser.frequencyBinCount) freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);
      const ny = (sampleRate || 44100) / 2;
      const len = freqData.length;
      for (let i = 0; i < n; i++) {
        const f0 = 40 * Math.pow(16000 / 40, i / n);
        const f1 = 40 * Math.pow(16000 / 40, (i + 1) / n);
        const a = Math.floor((f0 / ny) * len);
        const b = Math.max(a + 1, Math.floor((f1 / ny) * len));
        let s = 0;
        for (let k = a; k < b && k < len; k++) s = Math.max(s, freqData[k]);
        out[i] = Math.pow(s / 255, 1.35);
      }
    } else if (playing) {
      // Beat-shaped motion for streams the browser is not allowed to analyse.
      const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.9)), 6);
      for (let i = 0; i < n; i++) {
        const p = i / n;
        const tilt = 1 - p * 0.55;
        const wob = 0.5 + 0.5 * Math.sin(t * (2.3 + p * 3) + i * 0.7) * Math.sin(t * 0.9 + i * 0.31);
        out[i] = Math.min(1, tilt * (0.18 + 0.42 * wob + (p < 0.2 ? beat * 0.45 : beat * 0.12)));
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
  const t = performance.now() / 4000;
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
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, ((Math.PI * 2 * R) / n) * 0.55);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + t;
    const val = v[i < n / 2 ? i : n - 1 - i];
    const len = 6 + val * Math.min(W, H) * 0.26;
    ctx.strokeStyle = `hsl(${hueAt(hue, i / n)} 95% 62%)`;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
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
