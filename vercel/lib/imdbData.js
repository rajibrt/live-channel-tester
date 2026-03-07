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

function parseAttributes(fragment) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*["']([^"']*)["']/g;
  let m;
  while ((m = re.exec(String(fragment || "")))) {
    out[String(m[1] || "").toLowerCase()] = String(m[2] || "");
  }
  return out;
}

function extractMetaTagContent(html, key, attr = "property") {
  const input = text(html);
  if (!input || !key) return "";
  const keyLower = String(key).trim().toLowerCase();
  const attrLower = String(attr).trim().toLowerCase();
  const tags = input.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    if (String(attrs[attrLower] || "").trim().toLowerCase() !== keyLower) continue;
    const content = text(attrs.content || "");
    if (content) return content;
  }
  return "";
}

function normalizeReleaseDateLabel(raw) {
  const v = text(raw);
  if (!v) return "";
  const iso = v.match(/\b(19\d{2}|20\d{2})(?:-(\d{2})-(\d{2}))?\b/);
  if (iso) return iso[0];
  return v;
}

function extractMovieFromNextData(html, imdbId) {
  const input = text(html);
  if (!input) return null;
  const scriptTags = input.match(/<script\b[\s\S]*?<\/script>/gi) || [];
  let body = "";
  for (const tag of scriptTags) {
    const openEnd = tag.indexOf(">");
    if (openEnd < 0) continue;
    const openTag = tag.slice(0, openEnd + 1);
    const attrs = parseAttributes(openTag);
    const id = String(attrs.id || "").trim().toLowerCase();
    const type = String(attrs.type || "").trim().toLowerCase();
    if (id !== "__next_data__") continue;
    if (!type.includes("application/json")) continue;
    const closeStart = tag.toLowerCase().lastIndexOf("</script>");
    if (closeStart <= openEnd) continue;
    body = tag.slice(openEnd + 1, closeStart).trim();
    if (body) break;
  }
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    const data = parsed?.props?.pageProps?.aboveTheFoldData || parsed?.props?.pageProps?.mainColumnData || null;
    if (!data || typeof data !== "object") return null;

    const title = text(data?.titleText?.text || data?.originalTitleText?.text || "");
    const synopsis = text(data?.plot?.plotText?.plainText || data?.plot?.plotText?.text || "");
    const releaseYear = Number(data?.releaseYear?.year || 0) || null;
    const runtimeSeconds = Number(data?.runtime?.seconds || 0) || 0;
    const posterUrl = text(data?.primaryImage?.url || "");
    const imageUrls = uniqueStrings([
      posterUrl,
      ...asList(data?.images?.edges).map((edge) => text(edge?.node?.url || edge?.node?.originalUrl || "")),
    ]);

    const directors = uniqueStrings(
      asList(data?.directors).flatMap((block) =>
        asList(block?.credits).map((credit) => text(credit?.name?.nameText?.text || credit?.name?.text || ""))
      )
    );
    const writers = uniqueStrings(
      asList(data?.writers).flatMap((block) =>
        asList(block?.credits).map((credit) => text(credit?.name?.nameText?.text || credit?.name?.text || ""))
      )
    );
    const stars = uniqueStrings(
      asList(data?.castPageTitle?.edges).map((edge) => text(edge?.node?.name?.nameText?.text || edge?.node?.nameText?.text || ""))
    );

    const countries = uniqueStrings(
      asList(data?.countriesOfOrigin?.countries).map((c) => text(c?.text || c?.id || ""))
    );
    const languages = uniqueStrings(
      asList(data?.spokenLanguages?.spokenLanguages).map((lang) => text(lang?.text || lang?.id || ""))
    );
    const genres = uniqueStrings(
      asList(data?.genres?.genres).map((g) => text(g?.text || g?.id || ""))
    );

    const ratingValue = parseNumeric(data?.ratingsSummary?.aggregateRating, null);
    const ratingCount = parseNumeric(data?.ratingsSummary?.voteCount, null);

    return {
      imdb_id: normalizeImdbId(imdbId),
      imdb_url: normalizeImdbId(imdbId) ? `https://www.imdb.com/title/${normalizeImdbId(imdbId)}/` : "",
      title,
      synopsis,
      release_year: Number.isInteger(releaseYear) && releaseYear > 1800 ? releaseYear : null,
      runtime_seconds: runtimeSeconds > 0 ? runtimeSeconds : 0,
      poster_url: posterUrl,
      backdrop_url: text(imageUrls[1] || imageUrls[0] || posterUrl),
      image_urls: imageUrls,
      imdb_rating: ratingValue,
      imdb_votes: Number.isInteger(ratingCount) && ratingCount > 0 ? ratingCount : null,
      content_rating: text(data?.certificate?.rating || ""),
      imdb_genres: genres,
      imdb_directors: directors,
      imdb_writers: writers,
      imdb_stars: stars,
      imdb_release_date: normalizeReleaseDateLabel(text(data?.releaseDate?.displayableProperty?.value?.plainText || "")),
      imdb_countries: countries,
      imdb_languages: languages,
    };
  } catch {
    return null;
  }
}

function extractMovieFromMetaTags(html, imdbId) {
  const ogTitle = extractMetaTagContent(html, "og:title");
  const title = text(ogTitle.replace(/\s*-\s*IMDb\s*$/i, "")).replace(/\s*\(\d{4}\)\s*$/, "");
  const desc = extractMetaTagContent(html, "og:description");
  const image = extractMetaTagContent(html, "og:image");
  const releaseYearMatch = ogTitle.match(/\((19\d{2}|20\d{2})\)/);
  const releaseYear = releaseYearMatch ? Number(releaseYearMatch[1]) : null;
  if (!title && !desc && !image) return null;
  return {
    imdb_id: normalizeImdbId(imdbId),
    imdb_url: normalizeImdbId(imdbId) ? `https://www.imdb.com/title/${normalizeImdbId(imdbId)}/` : "",
    title,
    synopsis: desc,
    release_year: Number.isInteger(releaseYear) ? releaseYear : null,
    runtime_seconds: 0,
    poster_url: image,
    backdrop_url: image,
    image_urls: image ? [image] : [],
    imdb_rating: null,
    imdb_votes: null,
    content_rating: "",
    imdb_genres: [],
    imdb_directors: [],
    imdb_writers: [],
    imdb_stars: [],
    imdb_release_date: "",
    imdb_countries: [],
    imdb_languages: [],
  };
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
    const fromNext = extractMovieFromNextData(html, id);
    if (fromNext?.title || fromNext?.synopsis || fromNext?.poster_url) {
      return fromNext;
    }
    const fromMeta = extractMovieFromMetaTags(html, id);
    if (fromMeta?.title || fromMeta?.synopsis || fromMeta?.poster_url) {
      return fromMeta;
    }
    throw new Error("IMDb movie payload not found");
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
