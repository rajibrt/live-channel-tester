import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";

export const runtime = "nodejs";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function absoluteFrom(base, maybeRelative) {
  const raw = String(maybeRelative || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function transformEvent(raw, agentBaseUrl) {
  let evt = null;
  try {
    evt = JSON.parse(raw);
  } catch {
    return "";
  }
  if (!evt || typeof evt !== "object") {
    return "";
  }
  if (evt.type === "complete") {
    evt.download_url = absoluteFrom(agentBaseUrl, evt.download_url);
    evt.curated_download_url = absoluteFrom(agentBaseUrl, evt.curated_download_url);
  }
  return `${JSON.stringify(evt)}\n`;
}

async function parseIncoming(request) {
  const contentType = request.headers.get("content-type") || "";
  let body = {};
  let uploadFile = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    body = {
      playlist_url: String(form.get("playlist_url") || ""),
      agent_base_url: String(form.get("agent_base_url") || ""),
      timeout: form.get("timeout"),
      delay: form.get("delay"),
      max_items: form.get("max_items"),
      verify_segment: form.get("verify_segment"),
    };
    const fileValue = form.get("playlist_file");
    if (fileValue && typeof fileValue === "object" && "arrayBuffer" in fileValue) {
      uploadFile = fileValue;
    }
  } else {
    body = await request.json().catch(() => ({}));
  }
  return { body, uploadFile };
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const { body, uploadFile } = await parseIncoming(request);
    const playlistUrl = String(body.playlist_url || "").trim();
    const agentBaseUrl = normalizeBaseUrl(
      body.agent_base_url || process.env.LOCAL_AGENT_BASE_URL || "http://127.0.0.1:8787"
    );
    const timeout = safeNumber(body.timeout, 10);
    const delay = safeNumber(body.delay, 0.2);
    const maxItems = Math.max(0, Math.floor(safeNumber(body.max_items, 0)));
    const verifySegment = parseBoolean(body.verify_segment, true);

    if (!uploadFile && (!playlistUrl || !/^https?:\/\//i.test(playlistUrl))) {
      return NextResponse.json({ error: "Provide a valid playlist_url or upload a .m3u file." }, { status: 400 });
    }
    if (!agentBaseUrl || !/^https?:\/\//i.test(agentBaseUrl)) {
      return NextResponse.json({ error: "agent_base_url must be a valid http/https URL." }, { status: 400 });
    }

    let playlistText = "";
    let uploadName = "remote_playlist.m3u";
    if (uploadFile) {
      playlistText = await uploadFile.text();
      uploadName = uploadFile.name || uploadName;
    } else {
      const playlistRes = await fetch(playlistUrl);
      if (!playlistRes.ok) {
        return NextResponse.json({ error: `Failed to fetch playlist URL. HTTP ${playlistRes.status}` }, { status: 400 });
      }
      playlistText = await playlistRes.text();
    }
    if (!playlistText.trim()) {
      return NextResponse.json({ error: "Playlist content is empty." }, { status: 400 });
    }

    const form = new FormData();
    form.append("playlist", new Blob([playlistText], { type: "audio/x-mpegurl" }), uploadName);
    form.append("timeout", String(timeout));
    form.append("delay", String(delay));
    form.append("max_items", String(maxItems));
    form.append("verify_segment", verifySegment ? "true" : "false");

    const localRes = await fetch(`${agentBaseUrl}/api/test-stream`, { method: "POST", body: form });
    if (!localRes.ok) {
      const text = (await localRes.text().catch(() => "")).slice(0, 500);
      return NextResponse.json(
        { error: `Local agent request failed. HTTP ${localRes.status}${text ? `: ${text}` : ""}` },
        { status: 502 }
      );
    }
    if (!localRes.body) {
      return NextResponse.json({ error: "Local agent returned no response body." }, { status: 502 });
    }

    const reader = localRes.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const raw = line.trim();
              if (!raw) continue;
              const payload = transformEvent(raw, agentBaseUrl);
              if (payload) controller.enqueue(encoder.encode(payload));
            }
          }

          const tail = buffer.trim();
          if (tail) {
            const payload = transformEvent(tail, agentBaseUrl);
            if (payload) controller.enqueue(encoder.encode(payload));
          }
          controller.close();
        } catch {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to run local check." }, { status: 500 });
  }
}
