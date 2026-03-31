import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "../../../lib/auth";
import { getCurrentClient } from "../../../lib/clientAuth";
import { normalizeStreamUrl } from "../../../lib/streamUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CONCURRENT = Math.max(1, Number(process.env.STREAM_TRANSCODE_MAX_CONCURRENT || 2) || 2);
const MAX_QUEUE = Math.max(0, Number(process.env.STREAM_TRANSCODE_MAX_QUEUE || 10) || 10);
const QUEUE_WAIT_MS = Math.max(1000, Number(process.env.STREAM_TRANSCODE_QUEUE_WAIT_MS || 20000) || 20000);
const STARTUP_TIMEOUT_MS = Math.max(2000, Number(process.env.STREAM_TRANSCODE_STARTUP_TIMEOUT_MS || 12000) || 12000);

let activeTranscodes = 0;
const transcodeQueue = [];
let libx264SupportKnown = null;
const sourceCodecCache = new Map();

function releaseNext() {
  while (activeTranscodes < MAX_CONCURRENT && transcodeQueue.length) {
    const next = transcodeQueue.shift();
    if (!next || next.cancelled) continue;
    next.resolve({ queued: true });
  }
}

function acquireTranscodeSlot(signal) {
  if (activeTranscodes < MAX_CONCURRENT) {
    activeTranscodes += 1;
    return Promise.resolve({ queued: false });
  }
  if (transcodeQueue.length >= MAX_QUEUE) {
    return Promise.resolve({ error: "busy" });
  }

  return new Promise((resolve) => {
    const entry = {
      cancelled: false,
      resolve: (result) => {
        cleanup();
        activeTranscodes += 1;
        resolve(result);
      },
    };

    const cleanup = () => {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      if (entry.abortHandler) {
        signal?.removeEventListener?.("abort", entry.abortHandler);
      }
      entry.abortHandler = null;
    };

    entry.abortHandler = () => {
      entry.cancelled = true;
      cleanup();
      const idx = transcodeQueue.indexOf(entry);
      if (idx >= 0) transcodeQueue.splice(idx, 1);
      resolve({ error: "aborted" });
    };
    signal?.addEventListener?.("abort", entry.abortHandler, { once: true });

    entry.timer = setTimeout(() => {
      entry.cancelled = true;
      cleanup();
      const idx = transcodeQueue.indexOf(entry);
      if (idx >= 0) transcodeQueue.splice(idx, 1);
      resolve({ error: "timeout" });
    }, QUEUE_WAIT_MS);

    transcodeQueue.push(entry);
  });
}

function releaseTranscodeSlot() {
  activeTranscodes = Math.max(0, activeTranscodes - 1);
  releaseNext();
}

function probePrimaryVideoCodec(ffprobeBin, targetUrl) {
  const key = `${ffprobeBin}|${targetUrl}`;
  if (sourceCodecCache.has(key)) return Promise.resolve(sourceCodecCache.get(key) || "");
  return new Promise((resolve) => {
    const child = spawn(
      ffprobeBin,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        targetUrl,
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk || "");
    });
    child.on("error", () => resolve(""));
    child.on("close", (code) => {
      const codec = code === 0 ? String(out || "").trim().toLowerCase() : "";
      sourceCodecCache.set(key, codec);
      resolve(codec);
    });
  });
}

function getLibx264Support(ffmpegBin) {
  if (libx264SupportKnown !== null) return libx264SupportKnown;
  return new Promise((resolve) => {
    const check = spawn(ffmpegBin, ["-hide_banner", "-encoders"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const done = (value) => {
      libx264SupportKnown = Boolean(value);
      resolve(libx264SupportKnown);
    };
    check.stdout.on("data", (chunk) => {
      out += String(chunk || "");
    });
    check.on("error", () => done(false));
    check.on("close", (code) => {
      if (code !== 0) return done(false);
      done(/\blibx264\b/i.test(out));
    });
  });
}

function buildFfmpegArgs(targetUrl, startSeconds = 0, forceVideoReencode = false) {
  const audioBitrate = String(process.env.STREAM_TRANSCODE_AUDIO_BITRATE || "160k").trim() || "160k";
  const videoPreset = String(process.env.STREAM_TRANSCODE_VIDEO_PRESET || "veryfast").trim() || "veryfast";
  const videoCrf = String(process.env.STREAM_TRANSCODE_VIDEO_CRF || "23").trim() || "23";
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    // Stabilize timestamps for better A/V sync on problematic containers.
    "-fflags",
    "+genpts",
    "-avoid_negative_ts",
    "make_zero",
    "-thread_queue_size",
    "4096",
  ];

  const seek = Math.max(0, Number(startSeconds || 0) || 0);
  if (seek > 0) {
    // Keep seek before input for fast startup on large resume offsets.
    args.push("-ss", String(Math.floor(seek)));
  }

  args.push(
    "-i",
    targetUrl,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-sn",
  );
  if (forceVideoReencode) {
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      videoPreset,
      "-crf",
      videoCrf,
      "-pix_fmt",
      "yuv420p",
      "-vsync",
      "cfr",
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
    "aresample=async=1:first_pts=0",
    "-b:a",
    audioBitrate,
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
    "pipe:1",
  );
  return args;
}

export async function GET(request) {
  const [clientSession, adminSession] = await Promise.all([getCurrentClient(), getCurrentAdmin()]);
  if (!clientSession && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (clientSession && String(clientSession?.client?.approval_status || "approved").toLowerCase() !== "approved") {
    return NextResponse.json({ error: "Account approval pending." }, { status: 403 });
  }

  const urlValue = request.nextUrl.searchParams.get("url") || "";
  const startValue = request.nextUrl.searchParams.get("start");
  const videoMode = String(request.nextUrl.searchParams.get("video") || "").trim().toLowerCase();
  const startSeconds = Math.max(0, Number(startValue || 0) || 0);
  const target = normalizeStreamUrl(urlValue);
  if (!target) {
    return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  }

  let parsed = null;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid target URL." }, { status: 400 });
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return NextResponse.json({ error: "Only HTTP/HTTPS URLs are allowed." }, { status: 400 });
  }

  const gatewayRaw = String(
    process.env.STREAM_TRANSCODE_GATEWAY_URL || process.env.NEXT_PUBLIC_STREAM_TRANSCODE_GATEWAY || ""
  ).trim();
  if (gatewayRaw) {
    try {
      const gatewayUrl = new URL(gatewayRaw);
      const sameEndpoint =
        gatewayUrl.origin === request.nextUrl.origin && gatewayUrl.pathname === request.nextUrl.pathname;
      if (!sameEndpoint) {
        gatewayUrl.searchParams.set("url", target);
        gatewayUrl.searchParams.set("start", String(Math.floor(startSeconds)));

        const range = request.headers.get("range");
        const gatewayToken = String(process.env.STREAM_TRANSCODE_GATEWAY_TOKEN || "").trim();
        const gatewayHeaders = {};
        if (range) gatewayHeaders.range = range;
        if (gatewayToken) gatewayHeaders["x-transcode-token"] = gatewayToken;
        const upstream = await fetch(gatewayUrl.toString(), {
          method: "GET",
          headers: Object.keys(gatewayHeaders).length ? gatewayHeaders : undefined,
          cache: "no-store",
          signal: request.signal,
        });
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return NextResponse.json(
            {
              error: "Gateway transcode failed.",
              status: upstream.status,
              details: String(text || "").slice(0, 400),
            },
            { status: 502 }
          );
        }

        const headers = new Headers();
        const passthrough = [
          "content-type",
          "cache-control",
          "accept-ranges",
          "content-range",
          "content-length",
        ];
        for (const key of passthrough) {
          const v = upstream.headers.get(key);
          if (v) headers.set(key, v);
        }
        headers.set("x-stream-transcode", "gateway-relay");
        return new NextResponse(upstream.body, {
          status: upstream.status,
          headers,
        });
      }
    } catch {
      // Invalid/misconfigured gateway URL; fallback to local transcode path.
    }
  }

  const slot = await acquireTranscodeSlot(request.signal);
  if (slot?.error === "aborted") {
    return NextResponse.json({ error: "Client aborted before transcoding started." }, { status: 499 });
  }
  if (slot?.error === "timeout") {
    return NextResponse.json(
      { error: "Transcode queue timeout. Please retry in a few seconds." },
      { status: 503 }
    );
  }
  if (slot?.error === "busy") {
    return NextResponse.json(
      { error: "Transcoder busy. Too many concurrent streams." },
      { status: 503 }
    );
  }

  const ffmpegBin = String(process.env.FFMPEG_PATH || "ffmpeg").trim() || "ffmpeg";
  const ffprobeBin = String(process.env.FFPROBE_PATH || "ffprobe").trim() || "ffprobe";
  const forceVideoReencodeRaw = String(process.env.STREAM_TRANSCODE_FORCE_VIDEO_REENCODE || "true").trim();
  const forceVideoReencodeRequestedByEnv =
    forceVideoReencodeRaw && !/^(0|false|no|off)$/i.test(forceVideoReencodeRaw);
  const forceVideoReencodeRequested =
    videoMode === "transcode"
      ? true
      : videoMode === "copy"
        ? false
        : forceVideoReencodeRequestedByEnv;
  const sourceVideoCodec = await probePrimaryVideoCodec(ffprobeBin, target);
  const sourceNeedsReencode = Boolean(sourceVideoCodec) && sourceVideoCodec !== "h264";
  const shouldTryReencode = forceVideoReencodeRequested || sourceNeedsReencode;
  const canUseLibx264 = shouldTryReencode ? await getLibx264Support(ffmpegBin) : false;
  if (shouldTryReencode && !canUseLibx264) {
    console.warn("stream-transcode: STREAM_TRANSCODE_FORCE_VIDEO_REENCODE requested but libx264 encoder unavailable; falling back to copy video.");
  }
  const forceVideoReencode = shouldTryReencode && canUseLibx264;

  const ffmpeg = spawn(ffmpegBin, buildFfmpegArgs(target, startSeconds, forceVideoReencode), {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    releaseTranscodeSlot();
  };

  let ffmpegError = "";
  const ffmpegErrorLines = [];
  let ffmpegExitCode = null;
  let ffmpegClosed = false;
  ffmpeg.stderr.on("data", (chunk) => {
    const raw = String(chunk || "");
    if (!raw) return;
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    ffmpegError = lines[lines.length - 1] || ffmpegError;
    for (const line of lines) {
      ffmpegErrorLines.push(line);
      if (ffmpegErrorLines.length > 8) ffmpegErrorLines.shift();
    }
  });

  request.signal?.addEventListener("abort", () => {
    try {
      ffmpeg.kill("SIGKILL");
    } catch {
      // ignore kill errors
    }
    releaseOnce();
  });

  ffmpeg.on("error", () => {
    try {
      ffmpeg.kill("SIGKILL");
    } catch {
      // ignore kill errors
    }
    releaseOnce();
  });

  ffmpeg.on("close", (code) => {
    ffmpegExitCode = code;
    ffmpegClosed = true;
    releaseOnce();
    if (code && code !== 0) {
      const details = ffmpegError ? ` (${ffmpegError})` : "";
      console.warn(`stream-transcode failed with code ${code}${details}`);
    }
  });

  // Avoid returning HTTP 200 before ffmpeg produces any media bytes.
  // If startup fails (network/codec/input), return explicit 502 instead of
  // opaque "Playback failed" at the browser level.
  let startupTimer = null;
  const firstChunk = await new Promise((resolve) => {
    let settled = false;
    const settle = (payload) => {
      if (settled) return;
      settled = true;
      if (startupTimer) clearTimeout(startupTimer);
      startupTimer = null;
      resolve(payload);
    };

    const onFirstData = (chunk) => {
      cleanup();
      settle({ ok: true, chunk });
    };
    const onClose = () => {
      cleanup();
      settle({ ok: false, reason: "ffmpeg-closed-before-output" });
    };
    const onError = () => {
      cleanup();
      settle({ ok: false, reason: "ffmpeg-spawn-error" });
    };
    const cleanup = () => {
      ffmpeg.stdout?.off?.("data", onFirstData);
      ffmpeg.off("close", onClose);
      ffmpeg.off("error", onError);
    };

    ffmpeg.stdout?.once?.("data", onFirstData);
    ffmpeg.once("close", onClose);
    ffmpeg.once("error", onError);

    startupTimer = setTimeout(() => {
      cleanup();
      settle({ ok: false, reason: "startup-timeout" });
    }, STARTUP_TIMEOUT_MS);
  });

  if (!firstChunk?.ok) {
    try {
      ffmpeg.kill("SIGKILL");
    } catch {
      // ignore kill errors
    }
    releaseOnce();
    const tail = ffmpegErrorLines.length ? ffmpegErrorLines.join(" | ") : ffmpegError || "No ffmpeg stderr output";
    const codeSuffix = ffmpegClosed ? ` (exit ${String(ffmpegExitCode)})` : "";
    return NextResponse.json(
      {
        error: "Transcode startup failed.",
        reason: String(firstChunk?.reason || "unknown"),
        details: `${tail}${codeSuffix}`,
        source_video_codec: sourceVideoCodec || "unknown",
        video_mode: forceVideoReencode ? "reencode-x264" : "copy",
      },
      { status: 502 }
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      let finished = false;
      const safeClose = () => {
        if (finished) return;
        finished = true;
        try {
          controller.close();
        } catch {
          // ignore controller close races
        }
      };
      const safeError = (err) => {
        if (finished) return;
        finished = true;
        try {
          controller.error(err);
        } catch {
          // ignore controller error races
        }
      };
      try {
        controller.enqueue(firstChunk.chunk);
      } catch {
        finished = true;
      }
      const onData = (chunk) => {
        if (finished) return;
        try {
          controller.enqueue(chunk);
        } catch {
          cleanup();
          safeClose();
        }
      };
      const onEnd = () => {
        cleanup();
        safeClose();
      };
      const onError = () => {
        cleanup();
        safeError(new Error("transcode-stream-error"));
      };
      const cleanup = () => {
        ffmpeg.stdout?.off?.("data", onData);
        ffmpeg.stdout?.off?.("end", onEnd);
        ffmpeg.stdout?.off?.("error", onError);
      };
      ffmpeg.stdout?.on?.("data", onData);
      ffmpeg.stdout?.once?.("end", onEnd);
      ffmpeg.stdout?.once?.("error", onError);
    },
    cancel() {
      try {
        ffmpeg.kill("SIGKILL");
      } catch {
        // ignore kill errors
      }
      releaseOnce();
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "content-type": "video/mp4",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-stream-transcode": "ffmpeg-aac-fallback",
      "x-stream-transcode-queued": slot?.queued ? "1" : "0",
      "x-stream-transcode-start": String(Math.floor(startSeconds)),
      "x-stream-transcode-video-mode": forceVideoReencode ? "reencode-x264" : "copy",
      "x-stream-transcode-source-video-codec": sourceVideoCodec || "unknown",
    },
  });
}
