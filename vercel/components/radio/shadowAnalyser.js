// Analysis-only copy of a radio stream, for browsers that play live streams but hand the
// Web Audio analyser nothing but zeros (iPhone Safari / Chrome on iOS). The stream is
// downloaded a second time with fetch(), cut into whole MP3 / AAC (ADTS) frames, decoded
// with decodeAudioData and played into an analyser whose output is muted, so the spectrum
// follows the real music. The audible sound still comes from the normal <audio> element.
//
// iOS decoders reject chunks that start or end in the middle of a frame, so every chunk
// is cut exactly on frame boundaries (the remainder is carried into the next chunk).
// HLS (.m3u8) is not handled here.

const CHUNK_BYTES = 8 * 1024;
const MIN_FLUSH_MS = 500;
const MAX_AHEAD_S = 8;

const MP3_BR_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MP3_BR_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MP3_SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// Length of the frame starting at i, or 0 when there is no valid frame header there.
function frameLength(b, i) {
  if (i + 7 > b.length || b[i] !== 0xff) return 0;
  const b1 = b[i + 1];
  // AAC ADTS: 1111 1111 1111 x00x
  if ((b1 & 0xf6) === 0xf0) {
    const len = ((b[i + 3] & 0x03) << 11) | (b[i + 4] << 3) | (b[i + 5] >> 5);
    return len >= 7 ? len : 0;
  }
  // MPEG audio Layer III: 1111 1111 111v v01x
  if ((b1 & 0xe0) !== 0xe0) return 0;
  const version = (b1 >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const layer = (b1 >> 1) & 3; // 1 = Layer III
  if (version === 1 || layer !== 1) return 0;
  const b2 = b[i + 2];
  const brIdx = b2 >> 4;
  const srIdx = (b2 >> 2) & 3;
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return 0;
  const br = (version === 3 ? MP3_BR_V1 : MP3_BR_V2)[brIdx] * 1000;
  const sr = MP3_SR[version][srIdx];
  const pad = (b2 >> 1) & 1;
  return Math.floor(((version === 3 ? 144 : 72) * br) / sr) + pad;
}

// Finds a run of whole frames: [start, end). end is where the next (incomplete) frame begins.
function wholeFrames(b) {
  for (let i = 0; i < b.length - 7; i++) {
    const len = frameLength(b, i);
    if (!len) continue;
    // require two frames in a row to trust the sync
    if (i + len < b.length - 7 && !frameLength(b, i + len)) continue;
    let end = i;
    while (end < b.length) {
      const l = frameLength(b, end);
      if (!l || end + l > b.length) break;
      end += l;
    }
    if (end > i) return [i, end];
  }
  return null;
}

function concat(parts, size) {
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function decode(ac, bytes) {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((resolve, reject) => {
    try {
      const p = ac.decodeAudioData(buf, resolve, reject);
      if (p && typeof p.then === "function") p.then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * @param {AudioContext} ac
 * @param {string} url  the same (browser-playable) URL the <audio> element is using
 * @param {() => number} playerTime  the audible element's currentTime (seconds into its stream)
 * @param {number} offset  seconds between the player's connection and this copy's connection
 *
 * Radio servers send a burst of recent audio when a client connects and players start from
 * the beginning of that burst. Both connections get a similar burst, so position p in this
 * copy matches the player at playerTime = p + offset. Each decoded chunk is scheduled for the
 * moment the player reaches it.
 */
export function startShadowAnalyser(ac, url, playerTime = () => 0, offset = 0) {
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  const mute = ac.createGain();
  // not exactly 0: WebKit may skip processing a fully silent branch. 0.0001 is about -80 dB (inaudible).
  mute.gain.value = 0.0001;
  analyser.connect(mute);
  mute.connect(ac.destination);

  const ctrl = new AbortController();
  const info = { state: "fetching", bytes: 0, decoded: 0, failures: 0, lastError: "", seconds: 0 };
  let stopped = false;
  let pos = 0; // seconds of audio decoded so far (position inside this copy)

  const schedule = (audioBuffer) => {
    if (stopped) return;
    const dur = audioBuffer.duration;
    const chunkStart = pos;
    pos += dur;
    info.decoded += 1;
    info.seconds += dur;
    info.state = "working";
    let pt = 0;
    try {
      pt = Number(playerTime()) || 0;
    } catch {
      pt = 0;
    }
    // when (in AudioContext time) the player will reach the start of this chunk
    const target = ac.currentTime + (chunkStart + offset - pt);
    info.ahead = Math.round((target - ac.currentTime) * 10) / 10;
    if (target + dur <= ac.currentTime) return; // the player is already past this chunk
    if (target - ac.currentTime > MAX_AHEAD_S * 6) return; // far ahead of the player: wait for it
    const src = ac.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(analyser);
    if (target < ac.currentTime) src.start(ac.currentTime, ac.currentTime - target);
    else src.start(target);
  };

  const fail = (e) => {
    info.failures += 1;
    info.lastError = String(e?.message || e || "error").slice(0, 80);
    if (!info.decoded && info.failures >= 4) info.state = "failed";
  };

  (async () => {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    info.state = "reading";
    const reader = res.body.getReader();
    let parts = [];
    let size = 0;
    let last = performance.now();
    while (!stopped) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      size += value.length;
      info.bytes += value.length;
      const now = performance.now();
      if (size < CHUNK_BYTES || now - last < MIN_FLUSH_MS) continue;
      const bytes = concat(parts, size);
      const span = wholeFrames(bytes);
      if (!span) {
        // no frame sync found: keep the last few KB and try again with more data
        const keep = bytes.subarray(Math.max(0, bytes.length - 4096));
        parts = [keep];
        size = keep.length;
        if (bytes.length > 64 * 1024) fail(new Error("no MP3/AAC frames found"));
        continue;
      }
      const [start, end] = span;
      const rest = bytes.slice(end);
      parts = [rest];
      size = rest.length;
      last = now;
      decode(ac, bytes.slice(start, end)).then(schedule, fail);
    }
  })().catch((e) => {
    if (!stopped) {
      fail(e);
      if (!info.decoded) info.state = "failed";
    }
  });

  return {
    analyser,
    info,
    get working() {
      return info.decoded > 0;
    },
    get failed() {
      return info.state === "failed";
    },
    stop() {
      stopped = true;
      try {
        ctrl.abort();
      } catch {
        // already closed
      }
      try {
        analyser.disconnect();
        mute.disconnect();
      } catch {
        // already disconnected
      }
    },
  };
}
