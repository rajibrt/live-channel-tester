import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { importPreparedMovies } from "../../../../../../lib/movieImporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
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
  const publish = body?.publish !== false;
  const skipItemIds = toList(body?.skip_item_ids);
  const preparedItems = Array.isArray(body?.prepared_items) ? body.prepared_items : [];

  if (!preparedItems.length) {
    return Response.json({ error: "prepared_items is required for import action." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt) => controller.enqueue(encoder.encode(encodeEvent(evt)));
      try {
        send({
          type: "start",
          total: preparedItems.length,
          message: "import started",
        });

        const admin = getSupabaseAdmin();
        const summary = await importPreparedMovies(admin, {
          items: preparedItems,
          skipItemIds,
          skipDuplicates: body?.skip_duplicates !== false,
          publish,
          logger: console,
          onItemProcessed: async (evt) => {
            send({
              type: "progress",
              ...evt,
            });
          },
        });

        send({ type: "complete", summary });
      } catch (error) {
        send({ type: "error", error: error?.message || "import failed" });
      } finally {
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
