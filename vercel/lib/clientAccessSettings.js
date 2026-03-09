import { cache } from "react";
import { formatSettingsDbError } from "./emailDelivery";
import { getSupabaseAdmin } from "./supabaseAdmin";

const SETTINGS_TABLE = "admin_settings";
const SETTINGS_KEY = "client_access";

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

export function getDefaultClientAccessSettings() {
  return {
    facebook_first_login_requires_admin_approval: true,
  };
}

export function normalizeClientAccessSettings(valueJson) {
  const raw = valueJson && typeof valueJson === "object" ? valueJson : {};
  const defaults = getDefaultClientAccessSettings();
  return {
    facebook_first_login_requires_admin_approval: toBool(
      raw.facebook_first_login_requires_admin_approval,
      defaults.facebook_first_login_requires_admin_approval
    ),
  };
}

export async function loadClientAccessSettings(adminClient) {
  const admin = adminClient || getSupabaseAdmin();
  const { data, error } = await admin
    .from(SETTINGS_TABLE)
    .select("value_json")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(formatSettingsDbError(error, "Failed to load client access settings."));
  }

  return normalizeClientAccessSettings(data?.value_json || {});
}

export const loadClientAccessSettingsCached = cache(async () => {
  return await loadClientAccessSettings();
});

export async function saveClientAccessSettings({ adminUserId = "", patch = {}, adminClient }) {
  const admin = adminClient || getSupabaseAdmin();
  const current = await loadClientAccessSettings(admin);
  const next = normalizeClientAccessSettings({
    ...current,
    ...(patch && typeof patch === "object" ? patch : {}),
  });

  const payload = {
    key: SETTINGS_KEY,
    value_json: next,
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

  if (error) {
    throw new Error(formatSettingsDbError(error, "Failed to save client access settings."));
  }

  return next;
}
