import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { importPreparedMovies, prepareMoviesFromApache } from "../../../../../lib/movieImporter";

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

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "scan").trim().toLowerCase();
    const include = toList(body?.include);
    const exclude = toList(body?.exclude);
    const providers = toList(body?.providers).map((v) => v.toLowerCase());
    const publish = body?.publish !== false;
    const limit = Math.max(0, Number(body?.limit || 0));
    const maxDepth = Math.max(1, Number(body?.max_depth || 6));
    const skipItemIds = toList(body?.skip_item_ids);

    const admin = getSupabaseAdmin();
    if (action === "import") {
      const preparedItems = Array.isArray(body?.prepared_items) ? body.prepared_items : [];
      if (!preparedItems.length) {
        return NextResponse.json({ error: "prepared_items is required for import action." }, { status: 400 });
      }
      const summary = await importPreparedMovies(admin, {
        items: preparedItems,
        skipItemIds,
        skipDuplicates: body?.skip_duplicates !== false,
        publish,
        logger: console,
      });
      return NextResponse.json({ ok: true, action: "import", ...summary });
    }

    const baseUrl = String(body?.base_url || "").trim();
    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
      return NextResponse.json({ error: "base_url must be a valid http/https URL." }, { status: 400 });
    }

    const summary = await prepareMoviesFromApache(admin, {
      baseUrl,
      include,
      exclude,
      publish,
      limit,
      maxDepth,
      providers: providers.length ? providers : ["imdb", "omdb", "tmdb"],
      logger: console,
    });

    return NextResponse.json({
      ok: true,
      action: "scan",
      ...summary,
      items: Array.isArray(summary.items) ? summary.items.slice(0, 200) : [],
      failures: Array.isArray(summary.failures) ? summary.failures.slice(0, 200) : [],
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to import movies from URL." }, { status: 500 });
  }
}
