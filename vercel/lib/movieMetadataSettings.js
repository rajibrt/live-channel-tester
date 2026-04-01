import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { formatSettingsDbError } from "./emailDelivery";

const SETTINGS_TABLE = "admin_settings";
const SETTINGS_KEY = "movie_metadata";
const DAILY_OMDB_LIMIT_PER_KEY = 1000;

function text(value, max = 400) {
  return String(value || "").trim().slice(0, max);
}

function keyHash(value) {
  return createHash("sha1").update(String(value || "")).digest("hex").slice(0, 16);
}

function normalizeKeyList(values) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(values) ? values : []) {
    const value = text(raw, 200);
    if (!value) continue;
    const id = keyHash(value);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(value);
  }
  return out;
}

function parseEnvKeys() {
  const fromList = text(process.env.OMDB_API_KEYS || "", 4000)
    .split(/[,\n\r]+/g)
    .map((item) => text(item, 200))
    .filter(Boolean);
  const single = text(process.env.OMDB_API_KEY, 200);
  return normalizeKeyList([...fromList, single]);
}

function dateLabelNow() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeUsage(value) {
  const raw = value && typeof value === "object" ? value : {};
  const date = text(raw.date, 20) || dateLabelNow();
  const countsRaw = raw.counts && typeof raw.counts === "object" ? raw.counts : {};
  const counts = {};
  for (const [hash, used] of Object.entries(countsRaw)) {
    const n = Number(used);
    if (!hash || !Number.isFinite(n) || n <= 0) continue;
    counts[hash] = Math.max(0, Math.min(DAILY_OMDB_LIMIT_PER_KEY, Math.floor(n)));
  }
  return {
    date,
    counts,
    last_key_hash: text(raw.last_key_hash, 64),
  };
}

export function normalizeMovieMetadataSettings(valueJson) {
  const raw = valueJson && typeof valueJson === "object" ? valueJson : {};
  const omdbApiKeys = normalizeKeyList(raw.omdb_api_keys);
  const usage = normalizeUsage(raw.omdb_usage);
  if (usage.date !== dateLabelNow()) {
    usage.date = dateLabelNow();
    usage.counts = {};
    usage.last_key_hash = "";
  }
  return {
    omdb_api_keys: omdbApiKeys,
    omdb_usage: usage,
  };
}

export function maskApiKey(value) {
  const v = text(value, 200);
  if (!v) return "";
  if (v.length <= 8) return `${v.slice(0, 2)}***${v.slice(-2)}`;
  return `${v.slice(0, 4)}***${v.slice(-4)}`;
}

async function upsertMovieMetadataSettings({ adminUserId = "", settings, adminClient }) {
  const admin = adminClient || getSupabaseAdmin();
  const payload = {
    key: SETTINGS_KEY,
    value_json: normalizeMovieMetadataSettings(settings),
    updated_by_admin: adminUserId || null,
    updated_at: new Date().toISOString(),
  };
  let { error } = await admin.from(SETTINGS_TABLE).upsert(payload, { onConflict: "key" });
  const updatedByFkError =
    String(error?.code || "") === "23503" &&
    String(error?.message || "").includes("admin_settings_updated_by_admin_fkey");
  if (updatedByFkError) {
    ({ error } = await admin.from(SETTINGS_TABLE).upsert({ ...payload, updated_by_admin: null }, { onConflict: "key" }));
  }
  if (error) throw new Error(formatSettingsDbError(error, "Failed to save movie metadata settings."));
  return payload.value_json;
}

export async function loadMovieMetadataSettings(adminClient) {
  const admin = adminClient || getSupabaseAdmin();
  const { data, error } = await admin
    .from(SETTINGS_TABLE)
    .select("value_json")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (error) throw new Error(formatSettingsDbError(error, "Failed to load movie metadata settings."));
  return normalizeMovieMetadataSettings(data?.value_json || {});
}

export async function saveMovieMetadataSettings({ adminUserId = "", patch = {}, adminClient }) {
  const current = await loadMovieMetadataSettings(adminClient);
  const patchObj = patch && typeof patch === "object" ? patch : {};
  const next = normalizeMovieMetadataSettings({
    ...current,
    ...patchObj,
    omdb_api_keys: Object.prototype.hasOwnProperty.call(patchObj, "omdb_api_keys")
      ? normalizeKeyList(patchObj.omdb_api_keys)
      : current.omdb_api_keys,
    omdb_usage: Object.prototype.hasOwnProperty.call(patchObj, "omdb_usage")
      ? normalizeUsage(patchObj.omdb_usage)
      : current.omdb_usage,
  });
  return await upsertMovieMetadataSettings({ adminUserId, settings: next, adminClient });
}

function buildKeyPool(settings) {
  const own = normalizeKeyList(settings?.omdb_api_keys);
  const env = parseEnvKeys();
  const rows = [];
  const seen = new Set();
  for (const value of own) {
    const hash = keyHash(value);
    if (seen.has(hash)) continue;
    seen.add(hash);
    rows.push({ hash, value, source: "settings" });
  }
  for (const value of env) {
    const hash = keyHash(value);
    if (seen.has(hash)) continue;
    seen.add(hash);
    rows.push({ hash, value, source: "env" });
  }
  return rows;
}

function summarizeUsage(settings, pool) {
  const usage = normalizeUsage(settings?.omdb_usage);
  const perKey = pool.map((row, index) => {
    const used = Math.max(0, Number(usage.counts[row.hash] || 0) || 0);
    return {
      index,
      key_hash: row.hash,
      masked_key: maskApiKey(row.value),
      source: row.source,
      used,
      limit: DAILY_OMDB_LIMIT_PER_KEY,
      remaining: Math.max(0, DAILY_OMDB_LIMIT_PER_KEY - used),
      exhausted: used >= DAILY_OMDB_LIMIT_PER_KEY,
      active: usage.last_key_hash === row.hash,
    };
  });
  return {
    date: usage.date,
    total_keys: perKey.length,
    limit_per_key: DAILY_OMDB_LIMIT_PER_KEY,
    total_limit: perKey.length * DAILY_OMDB_LIMIT_PER_KEY,
    total_used: perKey.reduce((sum, row) => sum + row.used, 0),
    total_remaining: perKey.reduce((sum, row) => sum + row.remaining, 0),
    per_key: perKey,
  };
}

export async function getMovieMetadataSettingsPublic(adminClient) {
  const settings = await loadMovieMetadataSettings(adminClient);
  const pool = buildKeyPool(settings);
  return {
    omdb_api_keys: settings.omdb_api_keys,
    omdb_usage: summarizeUsage(settings, pool),
    env_fallback_keys: pool.filter((row) => row.source === "env").length,
  };
}

function nextPoolIndex(pool, lastHash) {
  if (!pool.length) return 0;
  if (!lastHash) return 0;
  const idx = pool.findIndex((row) => row.hash === lastHash);
  if (idx < 0) return 0;
  return (idx + 1) % pool.length;
}

function shouldRotateForError(message) {
  const msg = text(message, 300).toLowerCase();
  return (
    msg.includes("limit") ||
    msg.includes("invalid api key") ||
    msg.includes("api key is invalid") ||
    msg.includes("invalid key")
  );
}

async function fetchOmdb(url, signal) {
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
      },
      signal: signal || controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOmdbJsonWithRotation({
  queryParams = {},
  adminUserId = "",
  adminClient,
  signal,
}) {
  const settings = await loadMovieMetadataSettings(adminClient);
  const pool = buildKeyPool(settings);
  if (!pool.length) {
    throw new Error("OMDB_API_KEY missing. Add one API key in Admin -> Movies metadata settings.");
  }
  const usage = normalizeUsage(settings.omdb_usage);
  const start = nextPoolIndex(pool, usage.last_key_hash);

  let lastError = "";
  for (let offset = 0; offset < pool.length; offset += 1) {
    const idx = (start + offset) % pool.length;
    const key = pool[idx];
    const used = Number(usage.counts[key.hash] || 0) || 0;
    if (used >= DAILY_OMDB_LIMIT_PER_KEY) continue;

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams || {})) {
      const value = text(v, 300);
      if (!k || !value) continue;
      params.set(k, value);
    }
    params.set("apikey", key.value);
    let payload = null;
    try {
      payload = await fetchOmdb(`https://www.omdbapi.com/?${params.toString()}`, signal);
    } catch (error) {
      lastError = error?.message || "OMDb request failed";
      usage.last_key_hash = key.hash;
      continue;
    }

    usage.last_key_hash = key.hash;
    const responseOk = String(payload?.Response || "").toLowerCase() === "true";
    if (!responseOk) {
      const omdbError = text(payload?.Error || "OMDb no result");
      lastError = omdbError;
      if (shouldRotateForError(omdbError)) {
        usage.counts[key.hash] = DAILY_OMDB_LIMIT_PER_KEY;
        continue;
      }
      continue;
    }

    usage.counts[key.hash] = Math.max(0, Math.min(DAILY_OMDB_LIMIT_PER_KEY, used + 1));

    const saved = await saveMovieMetadataSettings({
      adminUserId,
      patch: { omdb_usage: usage },
      adminClient,
    });
    return {
      payload,
      key_hash: key.hash,
      response_ok: responseOk,
      omdb_usage: summarizeUsage(saved, pool),
    };
  }

  const saved = await saveMovieMetadataSettings({
    adminUserId,
    patch: { omdb_usage: usage },
    adminClient,
  });
  throw new Error(lastError || "All OMDb API keys are exhausted for today.");
}
