import { createClient } from "@supabase/supabase-js";

function clean(value) {
  return String(value || "").trim();
}

function cleanSupabaseUrl(...values) {
  for (const value of values) {
    const url = clean(value);
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (/^https?:$/i.test(parsed.protocol)) return parsed.toString().replace(/\/$/, "");
    } catch {
      // Try the next configured value.
    }
  }
  return "";
}

export function getSupabaseAdmin() {
  const url = cleanSupabaseUrl(process.env.SUPABASE_URL);
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function getSupabaseAnonConfig() {
  const url = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL);
  const anon = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, anon };
}
