import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "../../../lib/auth";
import { getCurrentClient } from "../../../lib/clientAuth";
import { normalizeStreamUrl } from "../../../lib/streamUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = Math.max(1500, Number(process.env.STREAM_PROBE_TIMEOUT_MS || 8000) || 8000);
const CACHE_TTL_MS = Math.max(30_000, Number(process.env.STREAM_PROBE_CACHE_TTL_MS || 6 * 60 * 60 * 1000) || 6 * 60 * 60 * 1000);

// Browser-native playback frequently fails for these codecs in MP4/MKV contexts.
const UNSUPPORTED_AUDIO_CODECS = new Set(["ac3", "eac3", "dca", "dts", "truehd"]);
const probeCache = new Map();

function nowMs() {
  return Date.now();
}

function fromCache(url) {
  const entry = probeCache.get(url);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs()) {
    probeCache.delete(url);
    return null;
  }
  return entry.value;
}

function toCache(url, value) {
  probeCache.set(url, {
    value,
    expiresAt: nowMs() + CACHE_TTL_MS,
  });
}

function parseProbe(stdout) {
  let parsed = {};
  try {
    parsed = JSON.parse(String(stdout || "{}"));
  } catch {
    parsed = {};
  }
  const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
  const audioStreams = streams.filter((s) => String(s?.codec_type || "").toLowerCase() === "audio");
  const codecs = Array.from(
    new Set(
      audioStreams
        .map((s) => String(s?.codec_name || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
  const unsupported = codecs.filter((name) => UNSUPPORTED_AUDIO_CODECS.has(name));
  return {
    ok: true,
    has_audio: audioStreams.length > 0,
    audio_codecs: codecs,
    unsupported_audio_codecs: unsupported,
    should_transcode_audio: unsupported.length > 0,
  };
}

async function runProbe(url) {
  const ffprobeBin = String(process.env.FFPROBE_PATH || "ffprobe").trim() || "ffprobe";
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      url,
    ];

    const child = spawn(ffprobeBin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let finished = false;

    const done = (err, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore kill errors
      }
      done(new Error("probe-timeout"));
    }, PROBE_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    child.on("error", (err) => done(err));
    child.on("close", (code) => {
      if (code !== 0) {
        done(new Error(String(stderr || `ffprobe-exit-${code}`).trim()));
        return;
      }
      done(null, parseProbe(stdout));
    });
  });
}

export async function GET(request) {
  const [clientSession, adminSession] = await Promise.all([getCurrentClient(), getCurrentAdmin()]);
  if (!clientSession && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (clientSession && String(clientSession?.client?.approval_status || "approved").toLowerCase() !== "approved") {
    return NextResponse.json({ error: "Account approval pending." }, { status: 403 });
  }

  const input = request.nextUrl.searchParams.get("url") || "";
  const target = normalizeStreamUrl(input);
  if (!target) {
    return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  }

  try {
    const parsed = new URL(target);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return NextResponse.json({ error: "Only HTTP/HTTPS URLs are allowed." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid target URL." }, { status: 400 });
  }

  const cached = fromCache(target);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true }, { status: 200 });
  }

  try {
    const data = await runProbe(target);
    toCache(target, data);
    return NextResponse.json({ ...data, cached: false }, { status: 200 });
  } catch (err) {
    const message = String(err?.message || "probe-failed");
    return NextResponse.json(
      {
        ok: false,
        error: message,
        has_audio: false,
        audio_codecs: [],
        unsupported_audio_codecs: [],
        should_transcode_audio: false,
      },
      { status: 200 }
    );
  }
}
