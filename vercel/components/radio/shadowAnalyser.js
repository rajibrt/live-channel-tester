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
 *   (fallback only)
 * @param {() => number} playerFirstData  performance.now() when the player received its first
 *   audio (0 if unknown). Stations can take seconds to answer; measuring both connections from
 *   their first audio makes that waiting time cancel out.
 *
 * Radio servers send a burst of recent audio when a client connects and players start from
 * the beginning of that burst. Both connections get a similar burst, so position p in this
 * copy matches the player at playerTime = p + offset. Each decoded chunk is scheduled for the moment the player
 * reaches it; a chunk the player is already inside plays from that point on.
 */
export function startShadowAnalyser(ac, url, playerTime = () => 0, offset = 0, playerFirstData = () => 0) {
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
  let lastEnd = 0; // AudioContext time where the previous chunk ends
  let queue = Promise.resolve();
  let dropRun = 0;

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
    const now = ac.currentTime;
    // when (in AudioContext time) the player will reach the start of this chunk
    let target = now + (chunkStart + offset - pt);
    // keep chunks back to back when the estimate agrees (it jitters a little with network timing)
    if (lastEnd && Math.abs(target - lastEnd) < 0.35) target = lastEnd;
    if (target + dur <= now || target - now > MAX_AHEAD_S * 6) {
      // already heard, or far beyond anything buffered: skip it. If this keeps happening the
      // timing estimate is wrong for this connection (e.g. the player reports an odd
      // currentTime after a station switch): re-anchor so the copy plays just ahead of now
      // instead of showing nothing.
      info.drops = (info.drops || 0) + 1;
      dropRun += 1;
      if (dropRun < 3) return;
      offset = pt - chunkStart + 0.25;
      info.reanchored = (info.reanchored || 0) + 1;
      target = now + 0.25;
      lastEnd = 0;
    }
    dropRun = 0;
    info.ahead = Math.round((target - now) * 10) / 10;
    const src = ac.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(analyser);
    if (target < now) src.start(now, now - target); // partly heard: play the rest
    else src.start(target);
    lastEnd = target + dur;
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
      if (!info.bytes) {
        let first = 0;
        try {
          first = Number(playerFirstData()) || 0;
        } catch {
          first = 0;
        }
        if (first > 0) offset = (performance.now() - first) / 1000;
        info.offset = Math.round(offset * 10) / 10;
      }
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
      // decode strictly in order: a long first chunk (the connect burst) takes longer to decode,
      // and a later chunk finishing first would put the copy's timeline out of order
      const piece = bytes.slice(start, end);
      queue = queue.then(() => decode(ac, piece).then(schedule, fail));
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

// ---------------------------------------------------------------------------------------------
// HLS (.m3u8) version. The copy reads the same playlist, downloads each segment once, pulls the
// audio out (packed ADTS/MP3 with an ID3 tag, or MPEG-TS) and decodes it.
//
// Alignment uses the player's seekable range: for a live HLS stream its end is the end of the
// last segment of the playlist the player loaded most recently. Whenever that end moves (the
// player just refreshed its playlist), the copy fetches the playlist right away; the last
// segment there ends at seekable.end, which places every segment on the player's timeline.

function skipId3(b) {
  let i = 0;
  while (i + 10 <= b.length && b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x33) {
    const size = ((b[i + 6] & 0x7f) << 21) | ((b[i + 7] & 0x7f) << 14) | ((b[i + 8] & 0x7f) << 7) | (b[i + 9] & 0x7f);
    i += 10 + size + (b[i + 5] & 0x10 ? 10 : 0);
  }
  return b.subarray(i);
}

// Audio elementary stream (ADTS AAC or MPEG audio) out of an MPEG-TS segment.
function demuxTsAudio(b) {
  const parts = [];
  let size = 0;
  let audioPid = -1;
  for (let i = 0; i + 188 <= b.length; i += 188) {
    if (b[i] !== 0x47) {
      // lost sync: look for the next packet start
      const next = b.indexOf(0x47, i + 1);
      if (next < 0) break;
      i = next - 188;
      continue;
    }
    const pusi = (b[i + 1] & 0x40) !== 0;
    const pid = ((b[i + 1] & 0x1f) << 8) | b[i + 2];
    const afc = (b[i + 3] >> 4) & 3;
    if (afc === 0 || afc === 2) continue; // no payload
    let p = i + 4;
    if (afc === 3) p += 1 + b[i + 4];
    if (p >= i + 188) continue;
    if (pusi && b[p] === 0 && b[p + 1] === 0 && b[p + 2] === 1) {
      const sid = b[p + 3];
      if (sid >= 0xc0 && sid <= 0xdf) {
        if (audioPid < 0) audioPid = pid;
        if (pid === audioPid) p += 9 + b[p + 8];
      }
    }
    if (pid !== audioPid || p >= i + 188) continue;
    const chunk = b.subarray(p, i + 188);
    parts.push(chunk);
    size += chunk.length;
  }
  return size ? concat(parts, size) : null;
}

function parsePlaylist(text, base) {
  const lines = String(text || "").split(/\r?\n/);
  const variants = [];
  const segs = [];
  let seq = 0;
  let target = 6;
  let dur = 0;
  let inf = null;
  const abs = (u) => {
    let v = u.trim();
    // our proxy rewrites segment links to /api/stream-proxy?url=…; segments are read directly
    if (v.startsWith("/api/stream-proxy")) {
      try {
        v = new URL(v, "http://x").searchParams.get("url") || v;
      } catch {
        // keep as is
      }
    }
    try {
      return new URL(v, base).toString();
    } catch {
      return v;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      inf = { bw: Number((line.match(/BANDWIDTH=(\d+)/) || [])[1] || 0), codecs: (line.match(/CODECS="([^"]*)"/) || [])[1] || "" };
    } else if (line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) seq = Number(line.split(":")[1]) || 0;
    else if (line.startsWith("#EXT-X-TARGETDURATION:")) target = Number(line.split(":")[1]) || 6;
    else if (line.startsWith("#EXTINF:")) dur = parseFloat(line.slice(8)) || 0;
    else if (!line.startsWith("#")) {
      if (inf) {
        variants.push({ ...inf, url: abs(line) });
        inf = null;
      } else {
        segs.push({ seq, dur, url: abs(line) });
        seq += 1;
        dur = 0;
      }
    }
  }
  return { variants, segs, target };
}

/**
 * @param {AudioContext} ac
 * @param {string} rawUrl  the station's original .m3u8 URL
 * @param {HTMLMediaElement} el  the audible element (its currentTime and seekable range are used)
 * @param {(url: string) => string} viaProxy  makes a same-origin proxy URL (for playlists without CORS)
 * @param {(seq: number) => number} fragStart  exact start of a segment on the player's timeline when
 *   the player knows it (hls.js); NaN otherwise, then the seekable range is used
 */
export function startHlsShadowAnalyser(ac, rawUrl, el, viaProxy = () => "", fragStart = () => NaN) {
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  const mute = ac.createGain();
  mute.gain.value = 0.0001;
  analyser.connect(mute);
  mute.connect(ac.destination);

  const ctrl = new AbortController();
  const info = { state: "fetching", bytes: 0, decoded: 0, failures: 0, lastError: "", seconds: 0, hls: true };
  let stopped = false;
  let playlistUrl = rawUrl;
  let useProxy = false;
  let target = 6;
  const start = new Map(); // segment sequence -> start on the player's timeline (seconds)
  const durs = new Map();
  const urls = new Map();
  let lastSeekEnd = 0;
  let nextSeq = -1;
  let lastEnd = 0;

  const seekEnd = () => {
    const s = el?.seekable;
    return s && s.length ? s.end(s.length - 1) : 0;
  };
  const fail = (e) => {
    info.failures += 1;
    info.lastError = String(e?.message || e || "error").slice(0, 80);
    if (!info.decoded && info.failures >= 4) info.state = "failed";
  };

  const fetchText = async (url) => {
    if (!useProxy) {
      try {
        const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        // relative segment links resolve against the final URL (playlists are often redirected)
        if (r.ok) return { text: await r.text(), base: r.url || url };
      } catch (e) {
        if (ctrl.signal.aborted) throw e;
      }
      const p = viaProxy(url);
      if (!p) throw new Error("playlist not readable");
      useProxy = true;
    }
    const r = await fetch(viaProxy(url), { signal: ctrl.signal, cache: "no-store", credentials: "same-origin" });
    if (!r.ok) throw new Error(`playlist HTTP ${r.status}`);
    return { text: await r.text(), base: url }; // the proxy already made the links absolute
  };

  // Loads the media playlist; when `anchorAt` is given, its last segment ends there.
  const load = async (anchorAt = 0) => {
    let res = await fetchText(playlistUrl);
    let pl = parsePlaylist(res.text, res.base);
    if (pl.variants.length) {
      const audioOnly = pl.variants.filter((v) => v.codecs && !/avc|hvc|hev|vp0|av01/i.test(v.codecs));
      const pick = (audioOnly.length ? audioOnly : pl.variants).sort((a, b) => a.bw - b.bw)[0];
      playlistUrl = pick.url;
      res = await fetchText(playlistUrl);
      pl = parsePlaylist(res.text, res.base);
    }
    target = pl.target;
    for (const s of pl.segs) {
      durs.set(s.seq, s.dur);
      urls.set(s.seq, s.url);
    }
    const segs = pl.segs;
    if (!segs.length) return;
    let exact = 0;
    for (const s of segs) {
      let v = NaN;
      try {
        v = Number(fragStart(s.seq));
      } catch {
        v = NaN;
      }
      if (Number.isFinite(v)) {
        start.set(s.seq, v);
        exact += 1;
      }
    }
    if (exact) info.anchored = "exact";
    else if (anchorAt > 0) {
      let end = anchorAt;
      for (let k = segs.length - 1; k >= 0; k--) {
        start.set(segs[k].seq, end - segs[k].dur);
        end -= segs[k].dur;
      }
      info.anchored = (info.anchored || 0) + 1;
    }
    // extend the timeline to segments newer than the last anchored one
    for (const s of segs) {
      if (start.has(s.seq)) continue;
      const prev = s.seq - 1;
      if (start.has(prev)) start.set(s.seq, start.get(prev) + (durs.get(prev) || 0));
    }
  };

  const decodeSegment = async (seq) => {
    const r = await fetch(urls.get(seq), { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`segment HTTP ${r.status} #${seq} ${String(urls.get(seq)).slice(-40)}`);
    let b = new Uint8Array(await r.arrayBuffer());
    info.bytes += b.length;
    b = b[0] === 0x47 ? demuxTsAudio(b) : skipId3(b);
    if (!b) throw new Error("no audio in segment");
    const span = wholeFrames(b);
    if (!span) throw new Error("no MP3/AAC frames found");
    return decode(ac, b.slice(span[0], span[1]));
  };

  const scheduleSegment = (seq, audioBuffer) => {
    const dur = audioBuffer.duration;
    const now = ac.currentTime;
    let t = now + (start.get(seq) - (Number(el.currentTime) || 0));
    if (lastEnd && Math.abs(t - lastEnd) < 0.35) t = lastEnd;
    info.decoded += 1;
    info.seconds += dur;
    info.state = "working";
    info.ahead = Math.round((t - now) * 10) / 10;
    if (t + dur <= now) return;
    const src = ac.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(analyser);
    if (t < now) src.start(now, now - t);
    else src.start(t);
    lastEnd = t + dur;
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  (async () => {
    // wait for the player to know its live window
    const exactKnown = () => {
      try {
        return Number.isFinite(Number(fragStart(-1, true)));
      } catch {
        return false;
      }
    };
    for (let i = 0; i < 40 && !stopped && !seekEnd() && !exactKnown(); i++) await wait(250);
    if (stopped) return;
    if (!seekEnd() && !exactKnown()) throw new Error("player has no seekable range");
    lastSeekEnd = seekEnd();
    await load(lastSeekEnd);
    info.state = "reading";
    let lastLoad = performance.now();
    while (!stopped) {
      const se = seekEnd();
      const since = performance.now() - lastLoad;
      if ((se > lastSeekEnd + 0.5 || se < lastSeekEnd - 0.5) && since > 1000) {
        // the player just refreshed its playlist: re-anchor on the same playlist
        lastSeekEnd = se;
        await load(se).catch(fail);
        lastLoad = performance.now();
      } else if (since > (target * 1000) / 2) {
        await load(0).catch(fail);
        lastLoad = performance.now();
      }
      const pt = Number(el.currentTime) || 0;
      if (nextSeq < 0) {
        // start with the segment the player is in now
        for (const [seq, s] of start) if (s <= pt && s + (durs.get(seq) || 0) > pt) nextSeq = seq;
        if (nextSeq < 0 && start.size) nextSeq = Math.max(...start.keys());
      }
      if (nextSeq >= 0 && urls.has(nextSeq) && start.has(nextSeq)) {
        const s = start.get(nextSeq);
        if (s + (durs.get(nextSeq) || 0) <= pt) {
          nextSeq += 1; // the player is already past it
          continue;
        }
        if (s < pt + target * 3) {
          const seq = nextSeq;
          nextSeq += 1;
          try {
            const buf = await decodeSegment(seq);
            if (!stopped) scheduleSegment(seq, buf);
          } catch (e) {
            if (stopped) return;
            fail(e);
          }
          continue;
        }
      }
      await wait(250);
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
