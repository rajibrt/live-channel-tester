/* eslint-disable no-console */
const http = require("node:http");
const { spawn } = require("node:child_process");

const PORT = Math.max(1, Number(process.env.PORT || 8787) || 8787);
const HOST = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";
const FFMPEG_PATH = String(process.env.FFMPEG_PATH || "ffmpeg").trim() || "ffmpeg";
const MAX_CONCURRENT = Math.max(1, Number(process.env.STREAM_TRANSCODE_MAX_CONCURRENT || 2) || 2);
const AUDIO_BITRATE = String(process.env.STREAM_TRANSCODE_AUDIO_BITRATE || "160k").trim() || "160k";
const VIDEO_PRESET = String(process.env.STREAM_TRANSCODE_VIDEO_PRESET || "veryfast").trim() || "veryfast";
const VIDEO_CRF = String(process.env.STREAM_TRANSCODE_VIDEO_CRF || "23").trim() || "23";
const STARTUP_TIMEOUT_MS = Math.max(2000, Number(process.env.STREAM_TRANSCODE_STARTUP_TIMEOUT_MS || 12000) || 12000);
const FORCE_VIDEO_REENCODE = !/^(0|false|no|off)$/i.test(String(process.env.STREAM_TRANSCODE_FORCE_VIDEO_REENCODE || "true").trim());
const ALLOW_ORIGIN = String(process.env.CORS_ALLOW_ORIGIN || "https://webtvbd.com").trim() || "*";
const AUTH_TOKEN = String(process.env.STREAM_TRANSCODE_GATEWAY_TOKEN || "").trim();

let active = 0;
const queue = [];

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Authorization, X-Transcode-Token");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, X-Stream-Transcode");
}

function json(res, status, payload) {
  addCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function isHttpUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    return /^https?:$/i.test(u.protocol);
  } catch {
    return false;
  }
}

function authOk(req) {
  if (!AUTH_TOKEN) return true;
  const tokenHeader = String(req.headers["x-transcode-token"] || "").trim();
  const authHeader = String(req.headers.authorization || "").trim();
  if (tokenHeader && tokenHeader === AUTH_TOKEN) return true;
  if (/^bearer\s+/i.test(authHeader) && authHeader.replace(/^bearer\s+/i, "") === AUTH_TOKEN) return true;
  return false;
}

function buildFfmpegArgs(target, startSeconds) {
  const seek = Math.max(0, Number(startSeconds || 0) || 0);
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-fflags",
    "+genpts+igndts",
    "-avoid_negative_ts",
    "make_zero",
  ];
  if (seek > 0) args.push("-ss", String(Math.floor(seek)));
  args.push(
    "-i",
    target,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-sn"
  );

  if (FORCE_VIDEO_REENCODE) {
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      VIDEO_PRESET,
      "-crf",
      VIDEO_CRF,
      "-pix_fmt",
      "yuv420p",
      "-vsync",
      "2",
      "-g",
      "48",
      "-keyint_min",
      "48",
      "-sc_threshold",
      "0"
    );
  } else {
    args.push("-c:v", "copy");
  }

  args.push(
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-af",
    "aresample=async=1000:first_pts=0",
    "-b:a",
    AUDIO_BITRATE,
    "-max_interleave_delta",
    "0",
    "-muxdelay",
    "0",
    "-muxpreload",
    "0",
    "-movflags",
    "+frag_keyframe+empty_moov+default_base_moof+dash",
    "-f",
    "mp4",
    "pipe:1"
  );
  return args;
}

function acquire() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}

function release() {
  active = Math.max(0, active - 1);
  if (queue.length && active < MAX_CONCURRENT) {
    const next = queue.shift();
    active += 1;
    next();
  }
}

async function handleTranscode(req, res, requestUrl) {
  if (!authOk(req)) {
    return json(res, 401, { error: "Unauthorized gateway token" });
  }

  const target = String(requestUrl.searchParams.get("url") || "").trim();
  const start = Math.max(0, Number(requestUrl.searchParams.get("start") || 0) || 0);
  if (!target || !isHttpUrl(target)) {
    return json(res, 400, { error: "Missing/invalid ?url (http/https required)" });
  }

  await acquire();
  let released = false;
  const done = () => {
    if (released) return;
    released = true;
    release();
  };

  const ffmpeg = spawn(FFMPEG_PATH, buildFfmpegArgs(target, start), {
    stdio: ["ignore", "pipe", "pipe"],
  });

  req.on("close", () => {
    try {
      ffmpeg.kill("SIGKILL");
    } catch {
      // ignore
    }
    done();
  });

  let stderrTail = [];
  ffmpeg.stderr.on("data", (chunk) => {
    const lines = String(chunk || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    stderrTail.push(...lines);
    if (stderrTail.length > 10) stderrTail = stderrTail.slice(-10);
  });

  let opened = false;
  const timer = setTimeout(() => {
    if (opened) return;
    try {
      ffmpeg.kill("SIGKILL");
    } catch {
      // ignore
    }
  }, STARTUP_TIMEOUT_MS);

  ffmpeg.stdout.once("data", (firstChunk) => {
    opened = true;
    clearTimeout(timer);
    addCors(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("X-Stream-Transcode", "gateway-ffmpeg");
    res.write(firstChunk);
    ffmpeg.stdout.pipe(res, { end: true });
  });

  ffmpeg.on("close", (code) => {
    clearTimeout(timer);
    if (!opened) {
      done();
      return json(res, 502, {
        error: "Transcode startup failed",
        code: Number(code || 0),
        details: stderrTail.join(" | ") || "ffmpeg closed before first output",
      });
    }
    done();
  });

  ffmpeg.on("error", (err) => {
    clearTimeout(timer);
    done();
    return json(res, 502, { error: "Failed to start ffmpeg", details: String(err?.message || err || "unknown") });
  });
}

const server = http.createServer(async (req, res) => {
  addCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      service: "webtvbd-transcode-gateway",
      active,
      max_concurrent: MAX_CONCURRENT,
      force_video_reencode: FORCE_VIDEO_REENCODE,
    });
  }

  if (url.pathname === "/api/stream-transcode" && req.method === "GET") {
    return handleTranscode(req, res, url);
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`transcode-gateway listening on http://${HOST}:${PORT}`);
});
