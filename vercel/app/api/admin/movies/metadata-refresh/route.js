import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { normalizeImdbId } from "../../../../../lib/imdbData";
import { fetchMovieMetadataByTitle } from "../../../../../lib/movieMetadataProvider";
import { fetchMovieMetadataByImdbIdWithFallback } from "../../../../../lib/movieMetadataByImdb";
import { getMovieMetadataSettingsPublic } from "../../../../../lib/movieMetadataSettings";
import { cleanMovieTitle } from "../../../../../lib/movieImporter";
import { syncMovieMetadataToDuplicates } from "../../../../../lib/movieMetadataSync";

function text(value) {
  return String(value || "").trim();
}

function parseTitleAndYear(rawTitle, rawYear) {
  const input = text(rawTitle);
  const explicitYear = Number(rawYear) || null;
  const yearMatch = input.match(/\((19\d{2}|20\d{2})\)\s*$/) || input.match(/\b(19\d{2}|20\d{2})\b/);
  const detectedYear = yearMatch ? Number(yearMatch[1]) : null;
  const normalizedYear = explicitYear || detectedYear || null;
  const titleWithoutYear = input
    .replace(/\((19\d{2}|20\d{2})\)\s*$/g, "")
    .replace(/\[(19\d{2}|20\d{2})\]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const normalizedTitle = cleanMovieTitle(titleWithoutYear);
  return {
    title: normalizedTitle || titleWithoutYear || input,
    year: normalizedYear,
  };
}

function asNumberList(values) {
  const out = [];
  for (const raw of Array.isArray(values) ? values : []) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) continue;
    out.push(n);
  }
  return [...new Set(out)];
}

function asProviderList(values) {
  const out = [];
  for (const raw of Array.isArray(values) ? values : String(values || "").split(",")) {
    const key = text(raw).toLowerCase();
    if (!key) continue;
    if (!["imdb", "omdb", "tmdb"].includes(key)) continue;
    out.push(key);
  }
  return out.length ? [...new Set(out)] : ["imdb", "omdb", "tmdb"];
}

function metadataPayloadFromItem(meta = {}) {
  return {
    imdb_id: text(meta.imdb_id) || null,
    imdb_url: text(meta.imdb_url),
    synopsis: text(meta.synopsis),
    poster_url: text(meta.poster_url),
    backdrop_url: text(meta.backdrop_url),
    release_year: Number(meta.release_year) || null,
    runtime_seconds: Math.max(0, Number(meta.runtime_seconds) || 0),
    imdb_rating: Number.isFinite(Number(meta.imdb_rating)) ? Number(meta.imdb_rating) : null,
    imdb_votes: Number.isFinite(Number(meta.imdb_votes)) ? Number(meta.imdb_votes) : null,
    content_rating: text(meta.content_rating),
    imdb_genres: Array.isArray(meta.imdb_genres) ? meta.imdb_genres.map((v) => text(v)).filter(Boolean) : [],
    imdb_directors: Array.isArray(meta.imdb_directors) ? meta.imdb_directors.map((v) => text(v)).filter(Boolean) : [],
    imdb_writers: Array.isArray(meta.imdb_writers) ? meta.imdb_writers.map((v) => text(v)).filter(Boolean) : [],
    imdb_stars: Array.isArray(meta.imdb_stars) ? meta.imdb_stars.map((v) => text(v)).filter(Boolean) : [],
    imdb_release_date: text(meta.imdb_release_date),
    imdb_countries: Array.isArray(meta.imdb_countries) ? meta.imdb_countries.map((v) => text(v)).filter(Boolean) : [],
    imdb_languages: Array.isArray(meta.imdb_languages) ? meta.imdb_languages.map((v) => text(v)).filter(Boolean) : [],
    updated_at: new Date().toISOString(),
  };
}

async function resolveImdbIdForSave(admin, imdbId, currentMovieId) {
  const normalized = normalizeImdbId(imdbId);
  if (!normalized) return "";
  const { data, error } = await admin
    .from("movies")
    .select("id")
    .eq("imdb_id", normalized)
    .neq("id", currentMovieId)
    .limit(1);
  if (error) throw new Error(error.message || "Failed to validate IMDb ID");
  return Array.isArray(data) && data.length ? "" : normalized;
}

async function fetchMovieMetaForRow(row, providers, adminUserId) {
  const imdbId = normalizeImdbId(row?.imdb_id);
  if (imdbId) {
    try {
      const viaId = await fetchMovieMetadataByImdbIdWithFallback(imdbId, adminUserId);
      return { item: viaId.item, provider: viaId.provider };
    } catch (imdbLookupError) {
      const normalized = parseTitleAndYear(row?.title, row?.release_year);
      const title = normalized.title;
      if (!title) {
        throw imdbLookupError;
      }
      try {
        const item = await fetchMovieMetadataByTitle({
          title,
          year: normalized.year,
          providers,
        });
        return {
          item,
          provider: item?.provider || providers[0] || "unknown",
          warning: imdbLookupError?.message || "",
        };
      } catch (titleLookupError) {
        throw new Error(
          [
            imdbLookupError?.message || "IMDb ID lookup failed",
            titleLookupError?.message || "Title lookup failed",
          ]
            .filter(Boolean)
            .join("; ")
        );
      }
    }
  }
  const normalized = parseTitleAndYear(row?.title, row?.release_year);
  const title = normalized.title;
  if (!title) throw new Error("Movie title missing");
  const item = await fetchMovieMetadataByTitle({
    title,
    year: normalized.year,
    providers,
  });
  return { item, provider: item?.provider || providers[0] || "unknown" };
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const movieIds = asNumberList(body?.movie_ids);
  if (!movieIds.length) {
    return NextResponse.json({ error: "movie_ids is required" }, { status: 400 });
  }
  const providers = asProviderList(body?.providers);
  const admin = getSupabaseAdmin();

  const { data: rows, error } = await admin
    .from("movies")
    .select("id,title,release_year,imdb_id")
    .in("id", movieIds);
  if (error) return NextResponse.json({ error: error.message || "Failed to load movies." }, { status: 500 });

  const byId = new Map((Array.isArray(rows) ? rows : []).map((row) => [Number(row.id), row]));
  const results = [];
  let okCount = 0;
  let failCount = 0;

  for (const id of movieIds) {
    const row = byId.get(id);
    if (!row) {
      failCount += 1;
      results.push({ movie_id: id, ok: false, error: "Movie not found" });
      continue;
    }
    try {
      const meta = await fetchMovieMetaForRow(row, providers, auth.current.user.id);
      const patch = metadataPayloadFromItem(meta.item || {});
      patch.imdb_id = await resolveImdbIdForSave(admin, patch.imdb_id, id);
      const { error: updateError } = await admin.from("movies").update(patch).eq("id", id);
      if (updateError) throw new Error(updateError.message || "Update failed");
      await syncMovieMetadataToDuplicates({
        admin,
        currentMovieId: id,
        reference: {
          title: text(meta?.item?.title) || text(row?.title),
          release_year: Number(meta?.item?.release_year || row?.release_year || 0) || null,
          imdb_id: text(meta?.item?.imdb_id) || text(row?.imdb_id),
        },
        patch,
      }).catch(() => ({ updatedIds: [] }));
      okCount += 1;
      results.push({
        movie_id: id,
        ok: true,
        provider: meta.provider,
        imdb_id: text(patch.imdb_id),
      });
    } catch (refreshError) {
      failCount += 1;
      results.push({
        movie_id: id,
        ok: false,
        error: refreshError?.message || "Metadata refresh failed",
      });
    }
  }

  const settings = await getMovieMetadataSettingsPublic(admin).catch(() => null);
  return NextResponse.json({
    ok: true,
    processed: movieIds.length,
    succeeded: okCount,
    failed: failCount,
    results,
    omdb_usage: settings?.omdb_usage || null,
  });
}
