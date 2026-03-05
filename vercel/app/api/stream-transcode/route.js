import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "../../../lib/auth";
import { getCurrentClient } from "../../../lib/clientAuth";
import { normalizeStreamUrl } from "../../../lib/streamUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CONCURRENT = Math.max(1, Number(process.env.STREAM_TRANSCODE_MAX_CONCURRENT || 2) || 2);
const MAX_QUEUE = Math.max(0, Number(process.env.STREAM_TRANSCODE_MAX_QUEUE || 10) || 10);
const QUEUE_WAIT_MS = Math.max(1000, Number(process.env.STREAM_TRANSCODE_QUEUE_WAIT_MS || 20000) || 20000);

let activeTranscodes = 0;
const transcodeQueue = [];

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

function buildFfmpegArgs(targetUrl, startSeconds = 0) {
  const audioBitrate = String(process.env.STREAM_TRANSCODE_AUDIO_BITRATE || "160k").trim() || "160k";
  const forceVideoReencodeRaw = String(process.env.STREAM_TRANSCODE_FORCE_VIDEO_REENCODE || "true").trim();
  const forceVideoReencode = !/^(0|false|no|off)$/i.test(forceVideoReencodeRaw);
  const videoPreset = String(process.env.STREAM_TRANSCODE_VIDEO_PRESET || "veryfast").trim() || "veryfast";
  const videoCrf = String(process.env.STREAM_TRANSCODE_VIDEO_CRF || "23").trim() || "23";
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    // Stabilize timestamps for better A/V sync on problematic containers.
    "-fflags",
    "+genpts+igndts",
    "-avoid_negative_ts",
    "make_zero",
  ];

  const seek = Math.max(0, Number(startSeconds || 0) || 0);
  if (seek > 0) {
    // Fast seek for compatibility mode resume.
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
  const ffmpeg = spawn(ffmpegBin, buildFfmpegArgs(target, startSeconds), {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    releaseTranscodeSlot();
  };

  let ffmpegError = "";
  ffmpeg.stderr.on("data", (chunk) => {
    const line = String(chunk || "").trim();
    if (!line) return;
    ffmpegError = line;
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
    releaseOnce();
    if (code && code !== 0) {
      const details = ffmpegError ? ` (${ffmpegError})` : "";
      console.warn(`stream-transcode failed with code ${code}${details}`);
    }
  });

  return new NextResponse(Readable.toWeb(ffmpeg.stdout), {
    status: 200,
    headers: {
      "content-type": 'video/mp4; codecs="avc1.640028,mp4a.40.2"',
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-stream-transcode": "ffmpeg-aac-fallback",
      "x-stream-transcode-queued": slot?.queued ? "1" : "0",
      "x-stream-transcode-start": String(Math.floor(startSeconds)),
    },
  });
}
