import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

function parseBoolean(value, fallback = true) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "on"].includes(text);
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    let enabled = true;
    const contentType = String(request.headers.get("content-type") || "");
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      enabled = parseBoolean(body.enabled, true);
    } else {
      const form = await request.formData().catch(() => null);
      enabled = parseBoolean(form?.get("enabled"), true);
    }

    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const row = {
      job_name: "playlist_health_hourly",
      is_enabled: enabled,
      updated_at: now,
      last_run_at: now,
      last_status: enabled ? "ok" : "paused",
      last_message: enabled
        ? "Cron turned on from dashboard."
        : "Cron turned off from dashboard.",
      last_total: 0,
      last_live: 0,
      last_dead: 0,
    };
    const { error } = await supabase.from("job_runs").upsert(row, { onConflict: "job_name" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (contentType.includes("application/json")) {
      return NextResponse.json({ ok: true, is_enabled: enabled });
    }

    return NextResponse.redirect(new URL("/dashboard", request.url), { status: 302 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to toggle cron status." },
      { status: 500 }
    );
  }
}

