import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { prepareMoviesFromApache } from "../../../../../../lib/movieImporter";
import {
  createMovieImportScanSession,
  finishMovieImportScanSession,
  waitForMovieImportScanResume,
} from "../../../../../../lib/movieImportScanSessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function encodeEvent(evt) {
  return `${JSON.stringify(evt)}\n`;
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const baseUrl = String(body?.base_url || "").trim();
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    return Response.json({ error: "base_url must be a valid http/https URL." }, { status: 400 });
  }

  const include = toList(body?.include);
  const exclude = toList(body?.exclude);
  const providers = toList(body?.providers).map((v) => v.toLowerCase());
  const publish = body?.publish !== false;
  const limit = Math.max(0, Number(body?.limit || 0));
  const maxDepth = Math.max(1, Number(body?.max_depth || 6));
  const rangeStart = Math.max(1, Number(body?.range_start || 1));
  const rangeEnd = Math.max(0, Number(body?.range_end || 0));

  const encoder = new TextEncoder();
  const session = createMovieImportScanSession();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt) => controller.enqueue(encoder.encode(encodeEvent(evt)));
      try {
        send({ type: "start", message: "scan started", session_id: session.id });

        const admin = getSupabaseAdmin();
        let rawCount = 0;
        let preparedCount = 0;

        const summary = await prepareMoviesFromApache(admin, {
          baseUrl,
          include,
          exclude,
          publish,
          limit,
          maxDepth,
          rangeStart,
          rangeEnd,
          providers: providers.length ? providers : ["imdb", "omdb", "tmdb"],
          logger: console,
          waitIfPaused: () => waitForMovieImportScanResume(session),
          isStopped: () => Boolean(session.stopped),
          onFoundRaw: async (raw) => {
            rawCount += 1;
            send({
              type: "raw_found",
              raw_count: rawCount,
              title: raw?.title || "",
              category_name: raw?.categoryName || "",
              source_url: raw?.sourceUrl || "",
            });
          },
          onPrepared: async (row) => {
            preparedCount += 1;
            send({
              type: "prepared",
              prepared_count: preparedCount,
              item: row,
            });
          },
        });

        send({ type: "complete", summary });
      } catch (error) {
        send({ type: "error", error: error?.message || "scan failed" });
      } finally {
        finishMovieImportScanSession(session.id);
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
}
