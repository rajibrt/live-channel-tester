import { fetchImdbMovieById, normalizeImdbId } from "./imdbData";

function text(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function normalizeYear(value) {
  const y = toInt(value, null);
  if (!y || y < 1888 || y > 2100) return null;
  return y;
}

function pickImage(first, second = "") {
  const a = text(first);
  if (a) return a;
  return text(second);
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    const v = text(raw);
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function normalizeMovieMeta(base = {}) {
  const releaseYear = normalizeYear(base.release_year);
  const imdbId = normalizeImdbId(base.imdb_id);
  const imdbUrl = text(base.imdb_url) || (imdbId ? `https://www.imdb.com/title/${imdbId}/` : "");
  return {
    provider: text(base.provider) || "unknown",
    confidence: Math.max(0, Math.min(1, Number(base.confidence || 0))),
    imdb_id: imdbId,
    imdb_url: imdbUrl,
    title: text(base.title),
    synopsis: text(base.synopsis),
    release_year: releaseYear,
    runtime_seconds: Math.max(0, toInt(base.runtime_seconds, 0) || 0),
    poster_url: text(base.poster_url),
    backdrop_url: pickImage(base.backdrop_url, base.poster_url),
    imdb_rating: toNumber(base.imdb_rating, null),
    imdb_votes: toInt(base.imdb_votes, null),
    content_rating: text(base.content_rating),
    imdb_genres: uniqueStrings(base.imdb_genres),
    imdb_directors: uniqueStrings(base.imdb_directors),
    imdb_writers: uniqueStrings(base.imdb_writers),
    imdb_stars: uniqueStrings(base.imdb_stars),
    imdb_release_date: text(base.imdb_release_date),
    imdb_countries: uniqueStrings(base.imdb_countries),
    imdb_languages: uniqueStrings(base.imdb_languages),
    image_urls: uniqueStrings(base.image_urls),
  };
}

function scoreTitleMatch(queryTitle, candidateTitle) {
  const q = text(queryTitle).toLowerCase();
  const c = text(candidateTitle).toLowerCase();
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.88;
  const qParts = q.split(/\s+/).filter(Boolean);
  if (!qParts.length) return 0;
  const hit = qParts.filter((p) => c.includes(p)).length;
  return Math.min(0.85, hit / qParts.length);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "application/json,text/plain,*/*",
      ...(options.headers || {}),
    },
    signal: options.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      ...(options.headers || {}),
    },
    signal: options.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function pickBestImdbSuggestion(items, queryTitle, queryYear = null) {
  let best = null;
  let bestScore = -1;
  for (const item of Array.isArray(items) ? items : []) {
    const id = normalizeImdbId(item?.id);
    if (!id) continue;
    const kind = text(item?.qid || item?.q).toLowerCase();
    if (kind && !kind.includes("movie") && !kind.includes("feature")) continue;
    const title = text(item?.l || item?.title || "");
    const year = normalizeYear(item?.y);
    let score = scoreTitleMatch(queryTitle, title);
    if (queryYear && year) {
      const d = Math.abs(queryYear - year);
      if (d === 0) score += 0.08;
      else if (d === 1) score += 0.04;
      else if (d > 3) score -= 0.08;
    }
    if (score > bestScore) {
      best = { imdb_id: id, title, year };
      bestScore = score;
    }
  }
  return best;
}

async function searchImdbIdByTitle(queryTitle, queryYear = null) {
  const title = text(queryTitle);
  if (!title) return null;
  const first = title[0]?.toLowerCase() || "x";
  const suggestUrl = `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(first)}/${encodeURIComponent(title)}.json`;
  try {
    const suggest = await fetchJson(suggestUrl);
    const picked = pickBestImdbSuggestion(suggest?.d || [], title, queryYear);
    if (picked?.imdb_id) return picked;
  } catch {
    // Fallback to HTML search below.
  }

  const findUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt&ttype=ft&ref_=fn_ft`;
  try {
    const html = await fetchText(findUrl);
    const rows = [...html.matchAll(/\/title\/(tt\d{6,12})\/[^>]*>([^<]+)</gi)];
    if (!rows.length) return null;
    const candidates = rows.slice(0, 12).map((m) => ({ id: m[1], title: m[2] }));
    candidates.sort((a, b) => scoreTitleMatch(title, b.title) - scoreTitleMatch(title, a.title));
    const top = candidates[0];
    if (!top?.id) return null;
    return { imdb_id: normalizeImdbId(top.id), title: text(top.title), year: queryYear || null };
  } catch {
    return null;
  }
}

async function lookupViaImdb({ title, year }) {
  const found = await searchImdbIdByTitle(title, year);
  if (!found?.imdb_id) throw new Error("IMDb title search returned no movie id");
  const movie = await fetchImdbMovieById(found.imdb_id);
  const confidence = Math.max(0.5, Math.min(1, scoreTitleMatch(title, movie?.title || found.title)));
  return normalizeMovieMeta({
    ...movie,
    provider: "imdb",
    confidence,
  });
}

async function lookupViaOmdb({ title, year }) {
  const apiKey = text(process.env.OMDB_API_KEY);
  if (!apiKey) throw new Error("OMDB_API_KEY missing");
  const params = new URLSearchParams({
    apikey: apiKey,
    t: text(title),
    type: "movie",
  });
  if (year) params.set("y", String(year));
  const url = `https://www.omdbapi.com/?${params.toString()}`;
  const payload = await fetchJson(url);
  if (!payload || String(payload.Response || "").toLowerCase() !== "true") {
    throw new Error(text(payload?.Error || "OMDb no result"));
  }
  const imdbId = normalizeImdbId(payload.imdbID);
  return normalizeMovieMeta({
    provider: "omdb",
    confidence: Math.max(0.45, scoreTitleMatch(title, payload.Title)),
    imdb_id: imdbId,
    imdb_url: imdbId ? `https://www.imdb.com/title/${imdbId}/` : "",
    title: payload.Title,
    synopsis: payload.Plot,
    release_year: normalizeYear(payload.Year),
    runtime_seconds: (() => {
      const m = String(payload.Runtime || "").match(/(\d+)/);
      return m ? Number(m[1]) * 60 : 0;
    })(),
    poster_url: text(payload.Poster) !== "N/A" ? text(payload.Poster) : "",
    backdrop_url: "",
    imdb_rating: toNumber(payload.imdbRating, null),
    imdb_votes: toInt(String(payload.imdbVotes || "").replace(/,/g, ""), null),
    content_rating: text(payload.Rated),
    imdb_genres: String(payload.Genre || "").split(","),
    imdb_directors: String(payload.Director || "").split(","),
    imdb_writers: String(payload.Writer || "").split(","),
    imdb_stars: String(payload.Actors || "").split(","),
    imdb_release_date: text(payload.Released),
    imdb_countries: String(payload.Country || "").split(","),
    imdb_languages: String(payload.Language || "").split(","),
    image_urls: text(payload.Poster) && text(payload.Poster) !== "N/A" ? [text(payload.Poster)] : [],
  });
}

async function lookupViaTmdb({ title, year }) {
  const apiKey = text(process.env.TMDB_API_KEY);
  if (!apiKey) throw new Error("TMDB_API_KEY missing");
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    query: text(title),
    include_adult: "false",
    language: "en-US",
    page: "1",
  });
  if (year) searchParams.set("year", String(year));
  const searchUrl = `https://api.themoviedb.org/3/search/movie?${searchParams.toString()}`;
  const searchRes = await fetchJson(searchUrl);
  const first = Array.isArray(searchRes?.results) ? searchRes.results[0] : null;
  if (!first?.id) throw new Error("TMDb no result");

  const detailsUrl = `https://api.themoviedb.org/3/movie/${first.id}?api_key=${encodeURIComponent(apiKey)}&language=en-US`;
  const details = await fetchJson(detailsUrl);
  const poster = text(details?.poster_path) ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : "";
  const backdrop = text(details?.backdrop_path) ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : "";

  return normalizeMovieMeta({
    provider: "tmdb",
    confidence: Math.max(0.4, scoreTitleMatch(title, details?.title || first?.title || "")),
    imdb_id: "",
    imdb_url: "",
    title: details?.title || first?.title || title,
    synopsis: details?.overview || "",
    release_year: normalizeYear((details?.release_date || first?.release_date || "").slice(0, 4)),
    runtime_seconds: Math.max(0, Number(details?.runtime || 0) * 60),
    poster_url: poster,
    backdrop_url: backdrop || poster,
    imdb_rating: toNumber(details?.vote_average, null),
    imdb_votes: toInt(details?.vote_count, null),
    content_rating: "",
    imdb_genres: Array.isArray(details?.genres) ? details.genres.map((g) => g?.name) : [],
    imdb_directors: [],
    imdb_writers: [],
    imdb_stars: [],
    imdb_release_date: text(details?.release_date || ""),
    imdb_countries: Array.isArray(details?.production_countries) ? details.production_countries.map((c) => c?.name) : [],
    imdb_languages: [],
    image_urls: [poster, backdrop].filter(Boolean),
  });
}

export async function fetchMovieMetadataByTitle({ title, year = null, providers = ["imdb", "omdb", "tmdb"] }) {
  const q = text(title);
  if (!q) throw new Error("title is required");
  const normalizedYear = normalizeYear(year);
  const failures = [];

  for (const provider of Array.isArray(providers) ? providers : []) {
    try {
      if (provider === "imdb") return await lookupViaImdb({ title: q, year: normalizedYear });
      if (provider === "omdb") return await lookupViaOmdb({ title: q, year: normalizedYear });
      if (provider === "tmdb") return await lookupViaTmdb({ title: q, year: normalizedYear });
    } catch (error) {
      failures.push(`${provider}: ${error?.message || "failed"}`);
    }
  }

  throw new Error(`metadata lookup failed for "${q}" (${failures.join("; ")})`);
}

