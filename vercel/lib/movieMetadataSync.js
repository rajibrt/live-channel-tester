function text(value) {
  return String(value || "").trim();
}

function normalizeImdbId(input) {
  const raw = text(input);
  if (!raw) return "";
  const match = raw.match(/\b(tt\d{7,12})\b/i);
  return match ? String(match[1]).toLowerCase() : "";
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
    /\b(x264|x265|h\.?264|h\.?265|hevc|avc|web.?dl|web.?rip|bluray|blu.?ray|brrip|dvdrip|hdrip|hdtc|hdts|camrip|predvd|dvd|dvdscr|aac|ddp|ac3|eac3|atmos|dual audio|esub|yify|yts|reencoded|remux|proper|extended|uncut|unrated|org|original)\b/gi,
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
  name = name.replace(/[\(\[\{]\s*[\)\]\}]/g, " ");
  name = name.replace(/[._]+/g, " ");
  name = name.replace(/\s{2,}/g, " ").trim();
  return name;
}

function normalizeYear(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1888 || n > 2100) return null;
  return n;
}

function detectYearFromTitle(title) {
  const match = text(title).match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function buildIdentity(row = {}) {
  return {
    imdbId: normalizeImdbId(row?.imdb_id),
    title: cleanMovieTitle(row?.title).toLowerCase(),
    year: normalizeYear(row?.release_year) || detectYearFromTitle(row?.title),
  };
}

function isSameMovie(row = {}, reference = {}) {
  const current = buildIdentity(row);
  const target = buildIdentity(reference);
  if (target.imdbId && current.imdbId && target.imdbId === current.imdbId) {
    return true;
  }
  if (!target.title || !current.title || target.title !== current.title) {
    return false;
  }
  if (target.year && current.year) {
    return target.year === current.year;
  }
  return true;
}

export async function syncMovieMetadataToDuplicates({
  admin,
  currentMovieId,
  reference = {},
  patch = {},
}) {
  const movieId = Number(currentMovieId || 0);
  if (!admin || !movieId) return { updatedIds: [] };

  const safePatch = { ...patch };
  delete safePatch.slug;
  delete safePatch.title;

  const { data: rows, error } = await admin
    .from("movies")
    .select("id,title,release_year,imdb_id")
    .neq("id", movieId);

  if (error) {
    throw new Error(error.message || "Failed to load duplicate movie candidates");
  }

  const matchedIds = (Array.isArray(rows) ? rows : [])
    .filter((row) => isSameMovie(row, reference))
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (!matchedIds.length) {
    return { updatedIds: [] };
  }

  const { error: updateError } = await admin
    .from("movies")
    .update({ ...safePatch, updated_at: new Date().toISOString() })
    .in("id", matchedIds);

  if (updateError) {
    throw new Error(updateError.message || "Failed to sync duplicate movie metadata");
  }

  return { updatedIds: matchedIds };
}
