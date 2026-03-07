import { fetchImdbMovieById, normalizeImdbId } from "./imdbData";
import { fetchOmdbJsonWithRotation } from "./movieMetadataSettings";

function text(value) {
  return String(value || "").trim();
}

function hasList(values) {
  return Array.isArray(values) && values.some((v) => String(v || "").trim());
}

function needsMetadataEnrichment(item = {}) {
  return !(
    text(item?.poster_url) &&
    text(item?.synopsis) &&
    (Number(item?.imdb_rating || 0) > 0 || hasList(item?.imdb_genres))
  );
}

function mergeMovieMeta(base = {}, patch = {}) {
  const pick = (a, b) => (text(a) ? a : b);
  const mergeList = (a, b) => {
    const rows = [];
    const seen = new Set();
    for (const raw of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      const v = text(raw);
      const key = v.toLowerCase();
      if (!v || seen.has(key)) continue;
      seen.add(key);
      rows.push(v);
    }
    return rows;
  };
  return {
    ...base,
    title: pick(base?.title, patch?.title),
    synopsis: pick(base?.synopsis, patch?.synopsis),
    release_year: Number(base?.release_year || 0) || Number(patch?.release_year || 0) || null,
    runtime_seconds: Math.max(Number(base?.runtime_seconds || 0) || 0, Number(patch?.runtime_seconds || 0) || 0),
    poster_url: pick(base?.poster_url, patch?.poster_url),
    backdrop_url: pick(base?.backdrop_url, patch?.backdrop_url || patch?.poster_url),
    imdb_rating: Number(base?.imdb_rating || 0) > 0 ? base?.imdb_rating : patch?.imdb_rating,
    imdb_votes: Number(base?.imdb_votes || 0) > 0 ? base?.imdb_votes : patch?.imdb_votes,
    content_rating: pick(base?.content_rating, patch?.content_rating),
    imdb_genres: mergeList(base?.imdb_genres, patch?.imdb_genres),
    imdb_directors: mergeList(base?.imdb_directors, patch?.imdb_directors),
    imdb_writers: mergeList(base?.imdb_writers, patch?.imdb_writers),
    imdb_stars: mergeList(base?.imdb_stars, patch?.imdb_stars),
    imdb_release_date: pick(base?.imdb_release_date, patch?.imdb_release_date),
    imdb_countries: mergeList(base?.imdb_countries, patch?.imdb_countries),
    imdb_languages: mergeList(base?.imdb_languages, patch?.imdb_languages),
    image_urls: mergeList(base?.image_urls, patch?.image_urls),
  };
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "application/json,text/plain,*/*",
        ...headers,
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchViaOmdbByImdbId(imdbId, adminUserId = "") {
  const { payload, omdb_usage } = await fetchOmdbJsonWithRotation({
    queryParams: { i: imdbId },
    adminUserId,
  });
  if (!payload || String(payload.Response || "").toLowerCase() !== "true") {
    throw new Error(text(payload?.Error || "OMDb no result"));
  }
  const runtimeMatch = String(payload.Runtime || "").match(/(\d+)/);
  const runtimeSeconds = runtimeMatch ? Number(runtimeMatch[1]) * 60 : 0;
  const poster = text(payload.Poster);
  return {
    item: {
      imdb_id: imdbId,
      imdb_url: `https://www.imdb.com/title/${imdbId}/`,
      title: text(payload.Title),
      synopsis: text(payload.Plot),
      release_year: Number(String(payload.Year || "").slice(0, 4)) || null,
      runtime_seconds: runtimeSeconds,
      poster_url: poster && poster !== "N/A" ? poster : "",
      backdrop_url: poster && poster !== "N/A" ? poster : "",
      imdb_rating: Number(payload.imdbRating) || null,
      imdb_votes: Number(String(payload.imdbVotes || "").replace(/,/g, "")) || null,
      content_rating: text(payload.Rated),
      imdb_genres: String(payload.Genre || "").split(",").map((v) => v.trim()).filter(Boolean),
      imdb_directors: String(payload.Director || "").split(",").map((v) => v.trim()).filter(Boolean),
      imdb_writers: String(payload.Writer || "").split(",").map((v) => v.trim()).filter(Boolean),
      imdb_stars: String(payload.Actors || "").split(",").map((v) => v.trim()).filter(Boolean),
      imdb_release_date: text(payload.Released),
      imdb_countries: String(payload.Country || "").split(",").map((v) => v.trim()).filter(Boolean),
      imdb_languages: String(payload.Language || "").split(",").map((v) => v.trim()).filter(Boolean),
      image_urls: poster && poster !== "N/A" ? [poster] : [],
    },
    provider: "omdb_fallback",
    omdb_usage,
  };
}

function tmdbAuth() {
  const bearer = text(process.env.TMDB_BEARER_TOKEN || process.env.TMDB_API_READ_ACCESS_TOKEN);
  const apiKey = text(process.env.TMDB_API_KEY);
  if (bearer) {
    return {
      headers: { Authorization: `Bearer ${bearer}` },
      withApiKey: (url) => url,
    };
  }
  if (apiKey) {
    return {
      headers: {},
      withApiKey: (url) => {
        const joiner = url.includes("?") ? "&" : "?";
        return `${url}${joiner}api_key=${encodeURIComponent(apiKey)}`;
      },
    };
  }
  return null;
}

export async function fetchViaTmdbByImdbId(imdbId) {
  const auth = tmdbAuth();
  if (!auth) throw new Error("TMDB_API_KEY/TMDB_BEARER_TOKEN missing");
  const findUrl = auth.withApiKey(
    `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id&language=en-US`
  );
  const found = await fetchJson(findUrl, auth.headers);
  const first = Array.isArray(found?.movie_results) ? found.movie_results[0] : null;
  if (!first?.id) throw new Error("TMDb find no result");
  const detailsUrl = auth.withApiKey(`https://api.themoviedb.org/3/movie/${first.id}?language=en-US`);
  const details = await fetchJson(detailsUrl, auth.headers);
  const poster = text(details?.poster_path) ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : "";
  const backdrop = text(details?.backdrop_path) ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : "";
  return {
    item: {
      imdb_id: imdbId,
      imdb_url: `https://www.imdb.com/title/${imdbId}/`,
      title: text(details?.title),
      synopsis: text(details?.overview),
      release_year: Number(String(details?.release_date || "").slice(0, 4)) || null,
      runtime_seconds: Math.max(0, Number(details?.runtime || 0) * 60),
      poster_url: poster,
      backdrop_url: backdrop || poster,
      imdb_rating: Number(details?.vote_average) || null,
      imdb_votes: Number(details?.vote_count) || null,
      content_rating: "",
      imdb_genres: Array.isArray(details?.genres) ? details.genres.map((g) => text(g?.name)).filter(Boolean) : [],
      imdb_directors: [],
      imdb_writers: [],
      imdb_stars: [],
      imdb_release_date: text(details?.release_date),
      imdb_countries: Array.isArray(details?.production_countries)
        ? details.production_countries.map((c) => text(c?.name)).filter(Boolean)
        : [],
      imdb_languages: [],
      image_urls: [poster, backdrop].filter(Boolean),
    },
    provider: "tmdb_fallback",
  };
}

export async function fetchMovieMetadataByImdbIdWithFallback(query, adminUserId = "") {
  const normalized = normalizeImdbId(query);
  try {
    const item = await fetchImdbMovieById(query);
    let mergedItem = { ...item };
    let provider = "imdb";
    let omdbUsage = null;
    if (normalized && needsMetadataEnrichment(mergedItem)) {
      try {
        const omdb = await fetchViaOmdbByImdbId(normalized, adminUserId);
        mergedItem = mergeMovieMeta(mergedItem, omdb.item || {});
        provider = "imdb+omdb";
        omdbUsage = omdb.omdb_usage || null;
      } catch {
        // ignore enrich failure
      }
    }
    if (normalized && needsMetadataEnrichment(mergedItem)) {
      try {
        const tmdb = await fetchViaTmdbByImdbId(normalized);
        mergedItem = mergeMovieMeta(mergedItem, tmdb.item || {});
        provider = provider.includes("omdb") ? "imdb+omdb+tmdb" : "imdb+tmdb";
      } catch {
        // ignore enrich failure
      }
    }
    return { item: mergedItem, provider, omdb_usage: omdbUsage };
  } catch (error) {
    if (!normalized) {
      throw new Error(error?.message || "Failed to fetch IMDb data");
    }
    try {
      const omdb = await fetchViaOmdbByImdbId(normalized, adminUserId);
      return { ...omdb, warning: error?.message || "IMDb fetch failed" };
    } catch {
      // continue to TMDb fallback.
    }
    const tmdb = await fetchViaTmdbByImdbId(normalized);
    return { ...tmdb, warning: error?.message || "IMDb fetch failed" };
  }
}
