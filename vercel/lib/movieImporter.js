import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fetchMovieMetadataByTitle } from "./movieMetadataProvider";
import { inferVideoQualityLabelFromUrl } from "./videoQuality";
import { normalizeStreamUrl } from "./streamUrl";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm", ".ts", ".flv", ".m3u8", ".mpd"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const DEFAULT_EXCLUDE_RE = [
  /android\s*games?/i,
  /software/i,
  /apps?/i,
  /setup/i,
  /tv\s*shows?/i,
  /series/i,
  /anime\s*series/i,
];
const qualityProbeCache = new Map();

function classifyByHeight(height) {
  const h = Number(height || 0);
  if (!Number.isFinite(h) || h <= 0) return "";
  if (h >= 2160) return "4K";
  if (h >= 1080) return "FULL HD";
  if (h >= 720) return "HD";
  return "SD";
}

async function probeVideoQualityByFfprobe(url, logger = console) {
  const sourceUrl = normalizeStreamUrl(url);
  if (!sourceUrl) return "";
  if (qualityProbeCache.has(sourceUrl)) return qualityProbeCache.get(sourceUrl) || "";

  const ffprobePath = String(process.env.FFPROBE_PATH || "ffprobe").trim() || "ffprobe";
  const timeoutMs = Math.max(1000, Number(process.env.MOVIE_IMPORT_FFPROBE_TIMEOUT_MS || 7000) || 7000);

  const value = await new Promise((resolve) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=height",
      "-of",
      "json",
      sourceUrl,
    ];
    const child = spawn(ffprobePath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      finish("");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    child.on("error", () => finish(""));
    child.on("close", (code) => {
      if (code !== 0) {
        const msg = String(stderr || "").trim();
        if (msg) logger?.warn?.(`ffprobe quality failed: ${msg}`);
        finish("");
        return;
      }
      try {
        const parsed = JSON.parse(String(stdout || "{}"));
        const stream = Array.isArray(parsed?.streams) ? parsed.streams[0] : null;
        const quality = classifyByHeight(Number(stream?.height || 0));
        finish(quality);
      } catch {
        finish("");
      }
    });
  });

  qualityProbeCache.set(sourceUrl, value || "");
  return value || "";
}

function text(value) {
  return String(value || "").trim();
}

function toSlug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasFileExtension(pathname) {
  const last = pathname.split("/").pop() || "";
  return /\.[a-z0-9]{2,5}$/i.test(last);
}

function pickExt(pathname) {
  const p = text(pathname).toLowerCase();
  const i = p.lastIndexOf(".");
  if (i < 0) return "";
  return p.slice(i);
}

function isVideoFile(urlString) {
  try {
    const u = new URL(urlString);
    return VIDEO_EXTENSIONS.has(pickExt(u.pathname));
  } catch {
    return false;
  }
}

function isManifestFile(urlString) {
  try {
    const u = new URL(urlString);
    const pathname = text(u.pathname).toLowerCase();
    return pathname.endsWith(".m3u8") || pathname.endsWith(".mpd");
  } catch {
    return false;
  }
}

function isSegmentFile(urlString) {
  try {
    const u = new URL(urlString);
    const pathname = text(u.pathname).toLowerCase();
    const fileName = pathname.split("/").pop() || "";
    return (
      pathname.endsWith(".ts") ||
      pathname.endsWith(".m4s") ||
      pathname.endsWith(".cmfv") ||
      pathname.endsWith(".cmfa") ||
      /^index\d+\.(ts|m4s)$/i.test(fileName)
    );
  } catch {
    return false;
  }
}

function isImageFile(urlString) {
  try {
    const u = new URL(urlString);
    return IMAGE_EXTENSIONS.has(pickExt(u.pathname));
  } catch {
    return false;
  }
}

function decodePathPart(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function cleanMovieTitle(rawName) {
  let name = text(rawName);
  name = name.replace(/\.[a-z0-9]{2,5}$/i, "");
  name = name.replace(/\[[^\]]*]/g, " ");
  name = name.replace(/\([^)]*?(x264|x265|h\.?264|h\.?265|web.?dl|webrip|bluray|brrip|dvdrip|hdrip|aac|ddp|atmos|dual audio|esub).*?\)/gi, " ");
  name = name.replace(/[-–—]{2,}/g, " ");
  name = name.replace(/\s*[-–—]\s*/g, " ");
  name = name.replace(/\b(2160p|1440p|1080p|720p|576p|480p|360p)\b/gi, " ");
  name = name.replace(
    /\b(x264|x265|h\.?264|h\.?265|hevc|avc|web.?dl|web.?rip|bluray|blu.?ray|brrip|dvdrip|hdrip|hdrip|hdtc|hdts|camrip|predvd|aac|ddp|ac3|eac3|atmos|dual audio|esub|yify|yts|reencoded|remux|proper|extended|uncut|unrated|org|original)\b/gi,
    " "
  );
  name = name.replace(
    /\b(hindi dubbed|bengali dubbed|bangla dubbed|english dubbed|tamil dubbed|telugu dubbed|malayalam dubbed|kannada dubbed|multi audio)\b/gi,
    " "
  );
  name = name.replace(
    /\b(hindi|bengali|bangla|english|tamil|telugu|malayalam|kannada|punjabi|urdu|arabic|korean|japanese|french|spanish|german)\b/gi,
    " "
  );
  name = name.replace(/\b(19\d{2}|20\d{2})\b/g, " ");
  name = name.replace(/[._]+/g, " ");
  name = name.replace(/\s{2,}/g, " ").trim();
  return name;
}

function extractYear(rawName) {
  const name = text(rawName);
  const m = name.match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function seemsEpisode(rawName) {
  const s = text(rawName);
  return /\bS\d{1,2}E\d{1,3}\b/i.test(s) || /\bseason\b/i.test(s) || /\bepisode\b/i.test(s);
}

function parseLinksFromHtml(html, currentUrl) {
  const links = [];
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const href = text(m[1]);
    if (!href || href === "#" || href.startsWith("javascript:")) continue;
    let url;
    try {
      url = new URL(href, currentUrl).toString();
    } catch {
      continue;
    }
    const label = text(m[2].replace(/<[^>]+>/g, " "));
    links.push({ url, label });
  }
  return links;
}

function shouldExcludePath(pathParts, excludeRegexes) {
  const joined = pathParts.join(" / ");
  return excludeRegexes.some((re) => re.test(joined));
}

async function fetchListing(url, fetchImpl) {
  const res = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Listing HTTP ${res.status}`);
  return await res.text();
}

function scorePlayableSource(urlString) {
  try {
    const u = new URL(urlString);
    const pathname = text(u.pathname).toLowerCase();
    const fileName = pathname.split("/").pop() || "";
    const ext = pickExt(pathname);
    let score = 0;

    if (isManifestFile(urlString)) score += 1000;
    if (/^index\.(m3u8|mpd)$/i.test(fileName)) score += 200;
    if (/master\.(m3u8|mpd)$/i.test(fileName)) score += 180;
    if (/playlist\.(m3u8|mpd)$/i.test(fileName)) score += 160;

    if (ext === ".mp4") score += 900;
    else if (ext === ".m4v") score += 860;
    else if (ext === ".mov") score += 840;
    else if (ext === ".webm") score += 820;
    else if (ext === ".mkv") score += 800;
    else if (ext === ".avi") score += 760;
    else if (ext === ".flv") score += 720;
    else if (ext === ".ts") score += 100;

    if (isSegmentFile(urlString)) score -= 1000;
    if (/sample|trailer|teaser|clip/i.test(fileName)) score -= 300;

    return score;
  } catch {
    return -9999;
  }
}

function pickBestVideo(videoUrls) {
  if (!videoUrls.length) return "";
  return [...videoUrls].sort((a, b) => {
    const scoreDiff = scorePlayableSource(b) - scorePlayableSource(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.localeCompare(b);
  })[0];
}

function normalizeTitleKey(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function buildItemId(sourceUrl, title, year) {
  const raw = `${normalizeStreamUrl(sourceUrl)}|${normalizeTitleKey(title)}|${Number(year || 0)}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

async function loadExistingIndex(admin) {
  const fetchAllRows = async (table, columns, orderBy, pageSize = 1000) => {
    const rows = [];
    let from = 0;
    while (true) {
      const to = from + pageSize - 1;
      const query = admin.from(table).select(columns).order(orderBy, { ascending: true }).range(from, to);
      const { data, error } = await query;
      if (error) throw new Error(`${table} scan failed: ${error.message || "unknown"}`);
      const chunk = Array.isArray(data) ? data : [];
      rows.push(...chunk);
      if (chunk.length < pageSize) break;
      from += pageSize;
    }
    return rows;
  };

  const [movies, sources] = await Promise.all([
    fetchAllRows("movies", "id,slug,title,release_year,imdb_id", "id"),
    fetchAllRows("movie_sources", "movie_id,source_url,id", "id"),
  ]);

  const movieById = new Map();
  const byImdbId = new Map();
  const byTitleYear = new Map();
  const byTitleOnly = new Map();
  const bySourceUrl = new Map();
  const slugSet = new Set();

  for (const m of movies) {
    const id = Number(m?.id);
    if (!id) continue;
    const row = {
      id,
      slug: text(m?.slug),
      title: text(m?.title),
      release_year: Number(m?.release_year || 0) || null,
      imdb_id: text(m?.imdb_id || ""),
    };
    movieById.set(id, row);
    if (row.slug) slugSet.add(row.slug);

    if (row.imdb_id) {
      const k = row.imdb_id.toLowerCase();
      const list = byImdbId.get(k) || [];
      list.push(row);
      byImdbId.set(k, list);
    }

    const t = normalizeTitleKey(row.title);
    if (t) {
      const listT = byTitleOnly.get(t) || [];
      listT.push(row);
      byTitleOnly.set(t, listT);

      if (row.release_year) {
        const k = `${t}|${row.release_year}`;
        const listY = byTitleYear.get(k) || [];
        listY.push(row);
        byTitleYear.set(k, listY);
      }
    }
  }

  for (const s of sources) {
    const url = normalizeStreamUrl(s?.source_url || "");
    const movie = movieById.get(Number(s?.movie_id));
    if (!url || !movie) continue;
    const list = bySourceUrl.get(url) || [];
    list.push(movie);
    bySourceUrl.set(url, list);
  }

  return { byImdbId, byTitleYear, byTitleOnly, bySourceUrl, slugSet };
}

function detectDuplicates(index, prepared) {
  const duplicates = [];

  const sourceUrl = normalizeStreamUrl(prepared.source_url || "");
  if (sourceUrl && index.bySourceUrl.has(sourceUrl)) {
    duplicates.push({ reason: "source_url", matches: index.bySourceUrl.get(sourceUrl) || [] });
  }

  const imdbId = text(prepared.imdb_id || "").toLowerCase();
  if (imdbId && index.byImdbId.has(imdbId)) {
    duplicates.push({ reason: "imdb_id", matches: index.byImdbId.get(imdbId) || [] });
  }

  const titleKey = normalizeTitleKey(prepared.title || "");
  const year = Number(prepared.release_year || 0) || null;
  if (titleKey && year) {
    const key = `${titleKey}|${year}`;
    if (index.byTitleYear.has(key)) {
      duplicates.push({ reason: "title_year", matches: index.byTitleYear.get(key) || [] });
    }
  }

  if (titleKey && index.byTitleOnly.has(titleKey)) {
    duplicates.push({ reason: "title", matches: index.byTitleOnly.get(titleKey) || [] });
  }

  const flat = [];
  const seen = new Set();
  for (const d of duplicates) {
    for (const m of d.matches || []) {
      const key = String(m.id || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      flat.push(m);
    }
  }

  return {
    is_duplicate: flat.length > 0,
    reasons: [...new Set(duplicates.map((d) => d.reason))],
    matches: flat.slice(0, 8),
  };
}

function ensureUniqueSlug(baseSlug, slugSet) {
  let slug = toSlug(baseSlug) || `movie-${Date.now()}`;
  if (!slugSet.has(slug)) {
    slugSet.add(slug);
    return slug;
  }
  let i = 2;
  while (slugSet.has(`${slug}-${i}`)) i += 1;
  const next = `${slug}-${i}`;
  slugSet.add(next);
  return next;
}

function categorySlugKey(row) {
  return toSlug(row?.slug || row?.name || "");
}

function selectCategoryByMetadata(meta, categories = [], hints = []) {
  const rows = Array.isArray(categories) ? categories : [];
  const bySlug = new Map();
  for (const row of rows) {
    const key = categorySlugKey(row);
    if (!key || bySlug.has(key)) continue;
    bySlug.set(key, row);
  }

  const langs = (Array.isArray(meta?.imdb_languages) ? meta.imdb_languages : []).map((v) => text(v).toLowerCase());
  const countries = (Array.isArray(meta?.imdb_countries) ? meta.imdb_countries : []).map((v) => text(v).toLowerCase());
  const genres = (Array.isArray(meta?.imdb_genres) ? meta.imdb_genres : []).map((v) => text(v).toLowerCase());
  const pool = [...langs, ...countries, ...genres].join(" ");

  const pick = (keys) => {
    for (const key of keys) {
      if (bySlug.has(key)) return bySlug.get(key);
    }
    return null;
  };

  const hintPool = (Array.isArray(hints) ? hints : [])
    .map((v) => text(v).toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (/\bbengali\b|\bbangla\b|\bbangladesh\b/.test(hintPool)) {
    const row = pick(["bangla", "bengali"]);
    if (row) return row;
  }
  if (/\bhindi\b/.test(hintPool)) {
    const row = pick(["hindi"]);
    if (row) return row;
  }
  if (/\benglish\b/.test(hintPool)) {
    const row = pick(["english"]);
    if (row) return row;
  }
  if (/\banimation\b|\banime\b|\bcartoon\b|\bfamily\b/.test(hintPool)) {
    const row = pick(["family"]);
    if (row) return row;
  }
  if (/\bromance\b|\blove\b/.test(hintPool)) {
    const row = pick(["love-story", "love"]);
    if (row) return row;
  }

  if (/\bbengali\b|\bbangla\b|\bbangladesh\b/.test(pool)) {
    const row = pick(["bangla", "bengali"]);
    if (row) return row;
  }
  if (/\bhindi\b/.test(pool)) {
    const row = pick(["hindi"]);
    if (row) return row;
  }
  if (/\benglish\b/.test(pool)) {
    const row = pick(["english"]);
    if (row) return row;
  }
  if (/\banimation\b|\banime\b|\bcartoon\b|\bfamily\b/.test(pool)) {
    const row = pick(["family"]);
    if (row) return row;
  }
  if (/\bromance\b|\blove\b/.test(pool)) {
    const row = pick(["love-story", "love"]);
    if (row) return row;
  }

  return pick(["movies", "all-movies", "family", "english"]) || rows[0] || null;
}

export async function crawlMoviesFromApache(baseUrl, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxDepth = Number(options.maxDepth || 6);
  const includeRegexes = Array.isArray(options.includeRegexes) ? options.includeRegexes : [];
  const excludeRegexes = Array.isArray(options.excludeRegexes) ? options.excludeRegexes : DEFAULT_EXCLUDE_RE;
  const logger = options.logger || console;
  const onFoundRaw = typeof options.onFoundRaw === "function" ? options.onFoundRaw : null;

  const visited = new Set();
  const movies = [];
  const queue = [{ url: baseUrl, depth: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.url)) continue;
    visited.add(current.url);
    if (current.depth > maxDepth) continue;

    let html;
    try {
      html = await fetchListing(current.url, fetchImpl);
    } catch (error) {
      logger.warn?.("skip listing:", current.url, "-", error?.message || "failed");
      continue;
    }

    const links = parseLinksFromHtml(html, current.url);
    const currentUrl = new URL(current.url);
    const children = [];
    for (const link of links) {
      let child;
      try {
        child = new URL(link.url);
      } catch {
        continue;
      }
      if (child.origin !== currentUrl.origin) continue;
      if (child.pathname === currentUrl.pathname) continue;
      if (child.pathname.length < currentUrl.pathname.length) continue;
      children.push(child.toString());
    }

    const fileUrls = children.filter((u) => hasFileExtension(new URL(u).pathname));
    const dirUrls = children.filter((u) => !hasFileExtension(new URL(u).pathname) || u.endsWith("/"));
    const videos = fileUrls.filter((u) => isVideoFile(u));

    if (videos.length) {
      const images = fileUrls.filter((u) => isImageFile(u));
      const pathParts = currentUrl.pathname.split("/").filter(Boolean).map(decodePathPart);
      const lastFolder = decodePathPart(pathParts[pathParts.length - 1] || "");
      const parentFolder = decodePathPart(pathParts[pathParts.length - 2] || "");
      const topFolder = decodePathPart(pathParts[1] || pathParts[0] || "");
      const titleRaw = lastFolder || parentFolder;
      const title = cleanMovieTitle(titleRaw);
      if (!title || seemsEpisode(titleRaw)) continue;
      if (shouldExcludePath(pathParts, excludeRegexes)) continue;
      if (includeRegexes.length && !includeRegexes.some((re) => re.test(pathParts.join(" / ")))) continue;

      movies.push({
        folderUrl: current.url,
        title,
        titleRaw,
        sourceUrl: pickBestVideo(videos),
        imageUrl: images[0] || "",
        inferredYear: extractYear(titleRaw) || extractYear(parentFolder),
        categoryName: cleanMovieTitle(topFolder || "Movies") || "Movies",
      });
      if (onFoundRaw) {
        const last = movies[movies.length - 1];
        await onFoundRaw(last);
      }
      continue;
    }

    for (const dirUrl of dirUrls) {
      if (visited.has(dirUrl)) continue;
      queue.push({ url: dirUrl, depth: current.depth + 1 });
    }
  }

  const unique = new Map();
  for (const item of movies) {
    const key = `${toSlug(item.title)}|${normalizeStreamUrl(item.sourceUrl)}`;
    if (!item.sourceUrl || unique.has(key)) continue;
    unique.set(key, item);
  }
  return [...unique.values()];
}

export async function prepareMoviesFromApache(admin, input = {}) {
  const baseUrl = text(input.baseUrl);
  if (!baseUrl) throw new Error("baseUrl is required");

  const include = Array.isArray(input.include) ? input.include : [];
  const exclude = Array.isArray(input.exclude) ? input.exclude : [];
  const includeRegexes = include.map((v) => new RegExp(text(v), "i")).filter((re) => re.source);
  const excludeRegexes = [
    ...DEFAULT_EXCLUDE_RE,
    ...exclude.map((v) => new RegExp(text(v), "i")).filter((re) => re.source),
  ];

  const options = {
    maxDepth: Number(input.maxDepth || 6),
    providers: Array.isArray(input.providers) && input.providers.length ? input.providers : ["imdb", "omdb", "tmdb"],
    publish: input.publish !== false,
    limit: Math.max(0, Number(input.limit || 0)),
    logger: input.logger || console,
    onFoundRaw: typeof input.onFoundRaw === "function" ? input.onFoundRaw : null,
    onPrepared: typeof input.onPrepared === "function" ? input.onPrepared : null,
  };

  const scanned = await crawlMoviesFromApache(baseUrl, {
    maxDepth: options.maxDepth,
    includeRegexes,
    excludeRegexes,
    logger: options.logger,
    onFoundRaw: options.onFoundRaw,
  });
  const candidates = options.limit > 0 ? scanned.slice(0, options.limit) : scanned;
  const existingIndex = await loadExistingIndex(admin);
  const { data: categoriesData } = await admin.from("movie_categories").select("id,slug,name,position");
  const existingCategories = Array.isArray(categoriesData) ? categoriesData : [];

  const preparedItems = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const item = candidates[i];
    let meta = null;
    try {
      meta = await fetchMovieMetadataByTitle({
        title: item.title,
        year: item.inferredYear,
        providers: options.providers,
      });
    } catch (error) {
      options.logger?.warn?.(`metadata fallback: ${item.title} -> ${error?.message || "no data"}`);
    }

    const sourceUrl = normalizeStreamUrl(item.sourceUrl);
    const probedQuality = await probeVideoQualityByFfprobe(sourceUrl, options.logger);
    const title = text(meta?.title || item.title);
    const releaseYear = meta?.release_year || null;
    const slugBase = toSlug(`${title}-${releaseYear || ""}`) || toSlug(title) || `movie-${Date.now()}`;
    const selectedCategory = selectCategoryByMetadata(meta, existingCategories, [item.categoryName, item.titleRaw]);
    const prepared = {
      item_id: buildItemId(sourceUrl, title, releaseYear),
      slug_base: slugBase,
      title,
      synopsis: text(meta?.synopsis),
      poster_url: text(meta?.poster_url || item.imageUrl),
      backdrop_url: text(meta?.backdrop_url || meta?.poster_url || item.imageUrl),
      release_year: releaseYear,
      runtime_seconds: Number(meta?.runtime_seconds || 0) || 0,
      imdb_id: text(meta?.imdb_id) || "",
      imdb_url: text(meta?.imdb_url),
      imdb_rating: Number.isFinite(Number(meta?.imdb_rating)) ? Number(meta.imdb_rating) : null,
      imdb_votes: Number.isInteger(Number(meta?.imdb_votes)) ? Number(meta.imdb_votes) : null,
      content_rating: text(meta?.content_rating),
      imdb_genres: Array.isArray(meta?.imdb_genres) ? meta.imdb_genres : [],
      imdb_directors: Array.isArray(meta?.imdb_directors) ? meta.imdb_directors : [],
      imdb_writers: Array.isArray(meta?.imdb_writers) ? meta.imdb_writers : [],
      imdb_stars: Array.isArray(meta?.imdb_stars) ? meta.imdb_stars : [],
      imdb_release_date: text(meta?.imdb_release_date),
      imdb_countries: Array.isArray(meta?.imdb_countries) ? meta.imdb_countries : [],
      imdb_languages: Array.isArray(meta?.imdb_languages) ? meta.imdb_languages : [],
      video_quality: probedQuality || inferVideoQualityLabelFromUrl(sourceUrl) || "",
      source_url: sourceUrl,
      category_name: text(selectedCategory?.name || "Movies"),
      category_slug: text(selectedCategory?.slug || ""),
      category_source: "metadata",
      provider: text(meta?.provider || ""),
      confidence: Number(meta?.confidence || 0),
      publish: Boolean(options.publish),
    };

    prepared.duplicate = detectDuplicates(existingIndex, prepared);
    preparedItems.push(prepared);
    if (options.onPrepared) {
      await options.onPrepared(prepared);
    }
  }

  return {
    scanned_count: scanned.length,
    candidate_count: candidates.length,
    duplicates_count: preparedItems.filter((x) => x.duplicate?.is_duplicate).length,
    unique_count: preparedItems.filter((x) => !x.duplicate?.is_duplicate).length,
    items: preparedItems,
  };
}

async function ensureCategory(admin, categoryName, cache) {
  const slug = toSlug(categoryName) || "movies";
  if (cache.has(slug)) return cache.get(slug);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("movie_categories")
    .upsert({ slug, name: text(categoryName) || "Movies", updated_at: now }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`category upsert failed (${slug}): ${error?.message || "unknown"}`);
  cache.set(slug, Number(data.id));
  return Number(data.id);
}

export async function importPreparedMovies(admin, input = {}) {
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const skipIds = new Set(Array.isArray(input.skipItemIds) ? input.skipItemIds.map((v) => String(v)) : []);
  const skipDuplicates = input.skipDuplicates !== false;
  const logger = input.logger || console;
  const publish = input.publish !== false;
  const onItemProcessed = typeof input.onItemProcessed === "function" ? input.onItemProcessed : null;
  const totalCount = rawItems.length;

  const categoryCache = new Map();
  const existingIndex = await loadExistingIndex(admin);
  const slugSet = new Set(existingIndex.slugSet);
  const saved = [];
  const skipped = [];
  const failed = [];
  let processed = 0;

  const emitProgress = async (evt) => {
    if (!onItemProcessed) return;
    await onItemProcessed({
      ...evt,
      counters: {
        total: totalCount,
        processed,
        remaining: Math.max(0, totalCount - processed),
        saved: saved.length,
        skipped: skipped.length,
        failed: failed.length,
      },
    });
  };

  for (let i = 0; i < rawItems.length; i += 1) {
    const item = rawItems[i];
    const itemId = String(item?.item_id || "");
    if (!itemId) {
      failed.push({ title: text(item?.title), error: "item_id missing" });
      processed += 1;
      await emitProgress({
        item_id: "",
        title: text(item?.title),
        status: "failed",
        error: "item_id missing",
      });
      continue;
    }

    const duplicateInfo = detectDuplicates(existingIndex, item);
    const shouldSkip = skipIds.has(itemId) || (skipDuplicates && duplicateInfo.is_duplicate);
    if (shouldSkip) {
      skipped.push({
        item_id: itemId,
        title: text(item?.title),
        reason: skipIds.has(itemId) ? "manual_skip" : "duplicate_auto_skip",
        duplicate_reasons: duplicateInfo.reasons,
      });
      processed += 1;
      await emitProgress({
        item_id: itemId,
        title: text(item?.title),
        status: "skipped",
        reason: skipIds.has(itemId) ? "manual_skip" : "duplicate_auto_skip",
      });
      continue;
    }

    try {
      const now = new Date().toISOString();
      const sourceUrl = normalizeStreamUrl(item?.source_url || "");
      const probedQuality = await probeVideoQualityByFfprobe(sourceUrl, logger);
      const releaseYear = Number(item?.release_year || 0) || null;
      const slug = ensureUniqueSlug(item?.slug_base || `${item?.title || "movie"}-${releaseYear || ""}`, slugSet);
      const categoryId = await ensureCategory(admin, item?.category_name || "Movies", categoryCache);

      const payload = {
        slug,
        title: text(item?.title),
        synopsis: text(item?.synopsis),
        poster_url: text(item?.poster_url),
        backdrop_url: text(item?.backdrop_url || item?.poster_url),
        release_year: releaseYear,
        runtime_seconds: Math.max(0, Number(item?.runtime_seconds || 0) || 0),
        imdb_id: text(item?.imdb_id) || null,
        imdb_url: text(item?.imdb_url),
        imdb_rating: Number.isFinite(Number(item?.imdb_rating)) ? Number(item.imdb_rating) : null,
        imdb_votes: Number.isInteger(Number(item?.imdb_votes)) ? Number(item.imdb_votes) : null,
        content_rating: text(item?.content_rating),
        imdb_genres: Array.isArray(item?.imdb_genres) ? item.imdb_genres : [],
        imdb_directors: Array.isArray(item?.imdb_directors) ? item.imdb_directors : [],
        imdb_writers: Array.isArray(item?.imdb_writers) ? item.imdb_writers : [],
        imdb_stars: Array.isArray(item?.imdb_stars) ? item.imdb_stars : [],
        imdb_release_date: text(item?.imdb_release_date),
        imdb_countries: Array.isArray(item?.imdb_countries) ? item.imdb_countries : [],
        imdb_languages: Array.isArray(item?.imdb_languages) ? item.imdb_languages : [],
        video_quality: text(item?.video_quality) || probedQuality || inferVideoQualityLabelFromUrl(sourceUrl) || "",
        is_published: publish,
        updated_at: now,
      };

      const { data: movie, error: movieErr } = await admin
        .from("movies")
        .upsert(payload, { onConflict: "slug" })
        .select("id")
        .single();
      if (movieErr || !movie?.id) throw new Error(`movie upsert failed: ${movieErr?.message || "unknown"}`);
      const movieId = Number(movie.id);

      const { error: mapErr } = await admin
        .from("movie_category_map")
        .upsert({ movie_id: movieId, category_id: categoryId }, { onConflict: "movie_id,category_id" });
      if (mapErr) throw new Error(`movie category upsert failed: ${mapErr?.message || "unknown"}`);

      const { data: existingSource, error: sourceFindErr } = await admin
        .from("movie_sources")
        .select("id")
        .eq("movie_id", movieId)
        .eq("source_url", sourceUrl)
        .limit(1)
        .maybeSingle();
      if (sourceFindErr) throw new Error(`movie source lookup failed: ${sourceFindErr?.message || "unknown"}`);

      if (!existingSource?.id) {
        const { error: sourceInsertErr } = await admin.from("movie_sources").insert({
          movie_id: movieId,
          label: "default",
          source_url: sourceUrl,
          is_active: true,
          sort_order: 0,
          updated_at: now,
        });
        if (sourceInsertErr) throw new Error(`movie source insert failed: ${sourceInsertErr?.message || "unknown"}`);
      }

      saved.push({ item_id: itemId, id: movieId, title: payload.title, slug, provider: text(item?.provider) });
      logger.log?.(`saved: ${payload.title}`);
      processed += 1;
      await emitProgress({
        item_id: itemId,
        title: payload.title,
        status: "saved",
      });
    } catch (error) {
      failed.push({ item_id: itemId, title: text(item?.title), error: error?.message || "failed" });
      logger.warn?.(`save failed: ${text(item?.title)} - ${error?.message || "failed"}`);
      processed += 1;
      await emitProgress({
        item_id: itemId,
        title: text(item?.title),
        status: "failed",
        error: error?.message || "failed",
      });
    }
  }

  return {
    total_count: totalCount,
    processed_count: processed,
    saved_count: saved.length,
    skipped_count: skipped.length,
    failed_count: failed.length,
    saved,
    skipped,
    failures: failed,
  };
}

export async function importMoviesFromApache(admin, input = {}) {
  const prepared = await prepareMoviesFromApache(admin, input);
  if (input.dryRun) {
    return {
      dry_run: true,
      ...prepared,
      saved_count: 0,
      failed_count: 0,
      skipped_count: 0,
    };
  }

  const imported = await importPreparedMovies(admin, {
    items: prepared.items,
    skipItemIds: input.skipItemIds,
    skipDuplicates: input.skipDuplicates !== false,
    publish: input.publish !== false,
    logger: input.logger,
  });

  return {
    dry_run: false,
    scanned_count: prepared.scanned_count,
    candidate_count: prepared.candidate_count,
    duplicates_count: prepared.duplicates_count,
    unique_count: prepared.unique_count,
    items: prepared.items,
    ...imported,
  };
}
