const IMDB_ID_PATTERN = /(tt\d{6,12})/i;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const v = text(raw);
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function extractNameList(nodes) {
  return uniqueStrings(
    asList(nodes).map((node) => {
      if (!node) return "";
      if (typeof node === "string") return node;
      return text(node.name || node.title || "");
    })
  );
}

function extractLocaleList(nodes) {
  return uniqueStrings(
    asList(nodes).map((node) => {
      if (!node) return "";
      if (typeof node === "string") return node;
      return text(node?.name || node?.["@id"] || node?.url || "");
    })
  );
}

function extractLinkTextsByHrefPattern(html, pattern) {
  const input = text(html);
  if (!input) return [];
  const out = [];
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(input))) {
    const href = text(m[1] || "");
    if (!href || !pattern.test(href)) continue;
    const label = text(String(m[2] || "").replace(/<[^>]+>/g, " "));
    if (!label) continue;
    out.push(label);
  }
  return uniqueStrings(out);
}

function decodeEscapedUnicode(value) {
  const raw = text(value);
  if (!raw) return "";
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .trim();
}

function extractSpokenLanguagesFromJson(html) {
  const input = text(html);
  if (!input) return [];
  const out = [];
  const blockRe = /"spokenLanguages"\s*:\s*\[([\s\S]*?)\]/gi;
  let block;
  while ((block = blockRe.exec(input))) {
    const segment = String(block[1] || "");
    const textRe = /"text"\s*:\s*"([^"]+)"/gi;
    let m;
    while ((m = textRe.exec(segment))) {
      const val = decodeEscapedUnicode(m[1] || "");
      if (val) out.push(val);
    }
  }
  return uniqueStrings(out);
}

function isoDurationToSeconds(iso) {
  const raw = text(iso);
  if (!raw) return 0;
  const match = raw.match(/P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function parseNumeric(value, fallback = null) {
  const num = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function extractJsonLdObjects(html) {
  const input = text(html);
  if (!input) return [];
  const matches = input.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const out = [];
  for (const match of matches) {
    const body = text(match?.[1] || "");
    if (!body) continue;
    try {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) {
        out.push(...parsed);
      } else {
        out.push(parsed);
      }
    } catch {
      // Ignore non-JSON script payloads.
    }
  }
  return out;
}

function pickMovieJsonLd(objects) {
  for (const obj of objects) {
    const typeRaw = obj?.["@type"];
    const types = asList(typeRaw).map((v) => String(v || "").toLowerCase());
    if (types.includes("movie") || types.includes("tvseries") || types.includes("creativework")) {
      return obj;
    }
  }
  return null;
}

export function normalizeImdbId(input) {
  const raw = text(input);
  if (!raw) return "";
  const match = raw.match(IMDB_ID_PATTERN);
  return match ? String(match[1]).toLowerCase() : "";
}

export function parseImdbMovieHtml(html, imdbId) {
  const id = normalizeImdbId(imdbId);
  const objects = extractJsonLdObjects(html);
  const movie = pickMovieJsonLd(objects);
  if (!movie) {
    throw new Error("IMDb JSON-LD movie payload not found");
  }

  const title = text(movie.name);
  const synopsis = text(movie.description);
  const releaseDate = text(movie.datePublished);
  const releaseYear = releaseDate ? Number(String(releaseDate).slice(0, 4)) : null;
  const runtimeSeconds = isoDurationToSeconds(movie.duration);
  const image = movie.image;
  const imageList = asList(image).map((v) => (typeof v === "string" ? v : text(v?.url))).filter(Boolean);
  const imageUrls = uniqueStrings(imageList);
  const posterUrl = text(imageList[0] || "");
  const backdropUrl = text(imageList[1] || imageList[0] || "");
  const ratingValue = parseNumeric(movie?.aggregateRating?.ratingValue, null);
  const ratingCount = parseNumeric(movie?.aggregateRating?.ratingCount, null);

  const fallbackLanguages = extractLinkTextsByHrefPattern(html, /(?:\?|&)primary_language=|(?:\?|&)language=|\/language\//i);
  const fallbackCountries = extractLinkTextsByHrefPattern(html, /(?:\?|&)country_of_origin=/i);
  const jsonSpokenLanguages = extractSpokenLanguagesFromJson(html);

  return {
    imdb_id: id,
    imdb_url: id ? `https://www.imdb.com/title/${id}/` : "",
    title,
    synopsis,
    release_year: Number.isInteger(releaseYear) && releaseYear > 1800 ? releaseYear : null,
    runtime_seconds: runtimeSeconds,
    poster_url: posterUrl,
    backdrop_url: backdropUrl,
    image_urls: imageUrls,
    imdb_rating: ratingValue,
    imdb_votes: Number.isInteger(ratingCount) && ratingCount > 0 ? ratingCount : null,
    content_rating: text(movie.contentRating),
    imdb_genres: uniqueStrings(asList(movie.genre)),
    imdb_directors: extractNameList(movie.director),
    imdb_writers: extractNameList(movie.creator),
    imdb_stars: extractNameList(movie.actor),
    imdb_release_date: releaseDate,
    imdb_countries: uniqueStrings([
      ...extractLocaleList(movie.countryOfOrigin || movie.country || movie.locationCreated),
      ...fallbackCountries,
    ]),
    imdb_languages: uniqueStrings([...extractLocaleList(movie.inLanguage), ...fallbackLanguages, ...jsonSpokenLanguages]),
  };
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`IMDb request failed (${res.status})`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchImdbMovieById(input) {
  const imdbId = normalizeImdbId(input);
  if (!imdbId) {
    throw new Error("Invalid IMDb id. Use tt1234567 format.");
  }

  const urls = [`https://m.imdb.com/title/${imdbId}/`, `https://www.imdb.com/title/${imdbId}/`];
  const failures = [];

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      return parseImdbMovieHtml(html, imdbId);
    } catch (error) {
      failures.push(error?.message || "fetch failed");
    }
  }

  throw new Error(`Unable to fetch IMDb data for ${imdbId}: ${failures.join("; ")}`);
}

export function listToCsv(input) {
  if (Array.isArray(input)) return uniqueStrings(input).join(", ");
  return text(input);
}

export function csvToList(input) {
  return uniqueStrings(String(input || "").split(",").map((part) => part.trim()));
}
