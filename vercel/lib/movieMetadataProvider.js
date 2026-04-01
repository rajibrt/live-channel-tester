import { fetchImdbMovieById, normalizeImdbId } from "./imdbData";
import { fetchOmdbJsonWithRotation } from "./movieMetadataSettings";

function text(value) {
  return String(value || "").trim();
}

function normalizeLookupTitle(raw) {
  const input = text(raw);
  if (!input) return "";
  return input
    .replace(/[-–—]{2,}/g, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\((19\d{2}|20\d{2})\)\s*$/g, "")
    .replace(/\[(19\d{2}|20\d{2})\]\s*$/g, "")
    .replace(
      /\b(2160p|1440p|1080p|720p|576p|480p|360p|x264|x265|h\.?264|h\.?265|hevc|avc|web.?dl|web.?rip|bluray|blu.?ray|brrip|dvdrip|hdrip|hdtc|hdts|camrip|predvd|aac|ddp|ac3|eac3|atmos|dual audio|esub|reencoded|remux|proper|extended|uncut|unrated|org|original)\b/gi,
      " "
    )
    .replace(
      /\b(hindi dubbed|bengali dubbed|bangla dubbed|english dubbed|tamil dubbed|telugu dubbed|malayalam dubbed|kannada dubbed|multi audio)\b/gi,
      " "
    )
    .replace(
      /\b(hindi|bengali|bangla|english|tamil|telugu|malayalam|kannada|punjabi|urdu|arabic|korean|japanese|french|spanish|german)\b/gi,
      " "
    )
    .replace(/\b(19\d{2}|20\d{2})\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeTitleForMatch(raw) {
  return normalizeLookupTitle(raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|movie|film)\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
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

function providerHeaders() {
  return {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  };
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
  const q = normalizeTitleForMatch(queryTitle);
  const c = normalizeTitleForMatch(candidateTitle);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.88;
  const qParts = q.split(/\s+/).filter(Boolean);
  const cParts = c.split(/\s+/).filter(Boolean);
  if (!qParts.length || !cParts.length) return 0;
  const qSet = new Set(qParts);
  const cSet = new Set(cParts);
  let overlap = 0;
  for (const token of qSet) {
    if (cSet.has(token)) overlap += 1;
  }
  const precision = overlap / Math.max(1, qSet.size);
  const recall = overlap / Math.max(1, cSet.size);
  const harmonic = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return Math.min(0.92, Math.max(precision * 0.62 + harmonic * 0.38, 0));
}

function yearPenalty(queryYear, candidateYear) {
  const q = normalizeYear(queryYear);
  const c = normalizeYear(candidateYear);
  if (!q || !c) return 0;
  const d = Math.abs(q - c);
  if (d === 0) return 0.08;
  if (d === 1) return 0.04;
  if (d <= 2) return 0.01;
  if (d <= 4) return -0.06;
  return -0.14;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Math.max(3000, Number(process.env.MOVIE_METADATA_TIMEOUT_MS || 12000) || 12000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        ...providerHeaders(),
        accept: "application/json,text/plain,*/*",
        ...(options.headers || {}),
      },
      signal: options.signal || controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Math.max(3000, Number(process.env.MOVIE_METADATA_TIMEOUT_MS || 12000) || 12000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        ...providerHeaders(),
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        ...(options.headers || {}),
      },
      signal: options.signal || controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
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
    score += yearPenalty(queryYear, year);
    if (score > bestScore) {
      best = { imdb_id: id, title, year, score };
      bestScore = score;
    }
  }
  if (!best || bestScore < 0.56) return null;
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
    const candidates = rows.slice(0, 16).map((m) => {
      const candidateTitle = text(m[2]);
      const yearMatch = candidateTitle.match(/\b(19\d{2}|20\d{2})\b/);
      const candidateYear = yearMatch ? Number(yearMatch[1]) : null;
      const score = scoreTitleMatch(title, candidateTitle) + yearPenalty(queryYear, candidateYear);
      return { id: m[1], title: candidateTitle, year: candidateYear, score };
    });
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];
    if (!top?.id || Number(top.score || 0) < 0.56) return null;
    return { imdb_id: normalizeImdbId(top.id), title: text(top.title), year: top.year || queryYear || null, score: top.score };
  } catch {
    return null;
  }
}

async function lookupViaImdb({ title, year }) {
  let found = await searchImdbIdByTitle(title, year);
  if (!found?.imdb_id) {
    const omdbId = await searchOmdbImdbIdByTitle({ title, year }).catch(() => null);
    if (omdbId) found = { imdb_id: omdbId, title, year };
  }
  if (!found?.imdb_id) {
    const tmdbId = await searchTmdbImdbIdByTitle({ title, year }).catch(() => null);
    if (tmdbId) found = { imdb_id: tmdbId, title, year };
  }
  if (!found?.imdb_id) throw new Error("IMDb title search returned no movie id");
  const movie = await fetchImdbMovieById(found.imdb_id);
  const fetchedTitle = text(movie?.title);
  if (!fetchedTitle) {
    throw new Error(`IMDb payload empty for ${found.imdb_id}`);
  }
  const confidenceRaw =
    scoreTitleMatch(title, fetchedTitle) + yearPenalty(year, movie?.release_year || found?.year || null);
  const confidence = Math.max(0.5, Math.min(1, confidenceRaw));
  if (confidenceRaw < 0.52) {
    throw new Error(`IMDb weak match (${fetchedTitle || found?.title || "unknown"})`);
  }
  return normalizeMovieMeta({
    ...movie,
    provider: "imdb",
    confidence,
  });
}

async function lookupViaOmdb({ title, year }) {
  const attempts = [
    { t: text(title), type: "movie", y: year ? String(year) : "" },
    { t: text(title), type: "movie" },
    { t: text(title) },
  ];
  let payload = null;
  let lastError = "";
  for (const params of attempts) {
    const res = await fetchOmdbJsonWithRotation({ queryParams: params }).catch((err) => {
      lastError = err?.message || "OMDb request failed";
      return null;
    });
    payload = res?.payload || null;
    if (payload && String(payload.Response || "").toLowerCase() === "true") break;
    if (payload) lastError = text(payload?.Error || "OMDb no result");
  }
  if (!payload || String(payload.Response || "").toLowerCase() !== "true") {
    throw new Error(lastError || text(payload?.Error || "OMDb no result"));
  }
  const imdbId = normalizeImdbId(payload.imdbID);
  const titleScore = scoreTitleMatch(title, payload.Title);
  const score = titleScore + yearPenalty(year, payload.Year);
  if (score < 0.5) {
    throw new Error(`OMDb weak match (${payload.Title || "unknown"})`);
  }
  return normalizeMovieMeta({
    provider: "omdb",
    confidence: Math.max(0.45, Math.min(1, score)),
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

function getTmdbAuth() {
  const apiKey = text(process.env.TMDB_API_KEY);
  const bearer = text(process.env.TMDB_BEARER_TOKEN || process.env.TMDB_API_READ_ACCESS_TOKEN);
  if (bearer) {
    return {
      mode: "bearer",
      apiKey: "",
      headers: { Authorization: `Bearer ${bearer}` },
    };
  }
  if (apiKey) {
    return {
      mode: "apikey",
      apiKey,
      headers: {},
    };
  }
  return null;
}

async function searchOmdbImdbIdByTitle({ title, year }) {
  const attempts = [
    { t: text(title), type: "movie", y: year ? String(year) : "" },
    { t: text(title), type: "movie" },
    { t: text(title) },
  ];
  for (const params of attempts) {
    const res = await fetchOmdbJsonWithRotation({ queryParams: params }).catch(() => null);
    const payload = res?.payload || null;
    if (!payload || String(payload.Response || "").toLowerCase() !== "true") continue;
    return normalizeImdbId(payload.imdbID);
  }
  return "";
}

async function searchTmdbImdbIdByTitle({ title, year }) {
  const auth = getTmdbAuth();
  if (!auth) return "";

  const searchParams = new URLSearchParams({
    query: text(title),
    include_adult: "false",
    language: "en-US",
    page: "1",
  });
  if (year) searchParams.set("year", String(year));
  if (auth.mode === "apikey") searchParams.set("api_key", auth.apiKey);
  const searchUrl = `https://api.themoviedb.org/3/search/movie?${searchParams.toString()}`;
  const searchRes = await fetchJson(searchUrl, { headers: auth.headers });
  const candidates = (Array.isArray(searchRes?.results) ? searchRes.results : [])
    .slice(0, 12)
    .map((row) => {
      const rowYear = normalizeYear(String(row?.release_date || "").slice(0, 4));
      const score = scoreTitleMatch(title, row?.title || row?.original_title || "") + yearPenalty(year, rowYear);
      return { row, score };
    })
    .sort((a, b) => b.score - a.score);
  const first = candidates[0]?.score >= 0.5 ? candidates[0].row : null;
  if (!first?.id) return "";

  const detailsParams = new URLSearchParams({ language: "en-US" });
  if (auth.mode === "apikey") detailsParams.set("api_key", auth.apiKey);
  const detailsUrl = `https://api.themoviedb.org/3/movie/${first.id}?${detailsParams.toString()}`;
  const details = await fetchJson(detailsUrl, { headers: auth.headers });
  return normalizeImdbId(details?.imdb_id);
}

async function lookupViaTmdb({ title, year }) {
  const auth = getTmdbAuth();
  if (!auth) throw new Error("TMDB_API_KEY or TMDB_BEARER_TOKEN missing");
  const searchParams = new URLSearchParams({
    query: text(title),
    include_adult: "false",
    language: "en-US",
    page: "1",
  });
  if (year) searchParams.set("year", String(year));
  if (auth.mode === "apikey") searchParams.set("api_key", auth.apiKey);
  const searchUrl = `https://api.themoviedb.org/3/search/movie?${searchParams.toString()}`;
  const searchRes = await fetchJson(searchUrl, { headers: auth.headers });
  const candidates = (Array.isArray(searchRes?.results) ? searchRes.results : [])
    .slice(0, 12)
    .map((row) => {
      const rowYear = normalizeYear(String(row?.release_date || "").slice(0, 4));
      const score = scoreTitleMatch(title, row?.title || row?.original_title || "") + yearPenalty(year, rowYear);
      return { row, score };
    })
    .sort((a, b) => b.score - a.score);
  const first = candidates[0]?.score >= 0.5 ? candidates[0].row : null;
  if (!first?.id) throw new Error("TMDb no result");

  const detailsParams = new URLSearchParams({ language: "en-US" });
  if (auth.mode === "apikey") detailsParams.set("api_key", auth.apiKey);
  const detailsUrl = `https://api.themoviedb.org/3/movie/${first.id}?${detailsParams.toString()}`;
  const details = await fetchJson(detailsUrl, { headers: auth.headers });
  const poster = text(details?.poster_path) ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : "";
  const backdrop = text(details?.backdrop_path) ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : "";

  return normalizeMovieMeta({
    provider: "tmdb",
    confidence: Math.max(
      0.4,
      scoreTitleMatch(title, details?.title || first?.title || "") +
        yearPenalty(year, String(details?.release_date || first?.release_date || "").slice(0, 4))
    ),
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
  const q = normalizeLookupTitle(title) || text(title);
  if (!q) throw new Error("title is required");
  const normalizedYear = normalizeYear(year);
  const failures = [];

  for (const rawProvider of Array.isArray(providers) ? providers : []) {
    const provider = text(rawProvider).toLowerCase();
    if (!provider) continue;
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
