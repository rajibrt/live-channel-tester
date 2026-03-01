const SETTINGS_TABLE = "admin_settings";
const SETTINGS_KEY = "admin_roles";

export const ADMIN_ROLE_SUPER = "super_admin";
export const ADMIN_ROLE_NORMAL = "admin";

export function normalizeAdminRole(value) {
  return String(value || "").trim().toLowerCase() === ADMIN_ROLE_SUPER ? ADMIN_ROLE_SUPER : ADMIN_ROLE_NORMAL;
}

export function readSuperAdminEmailsFromEnv() {
  const raw = String(process.env.SUPER_ADMIN_EMAILS || "");
  return new Set(
    raw
      .split(",")
      .map((x) => String(x || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function loadAdminRolesMap(admin) {
  const { data, error } = await admin
    .from(SETTINGS_TABLE)
    .select("value_json")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (error) return {};
  const raw = data?.value_json;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const map = {};
  for (const [key, value] of Object.entries(raw)) {
    map[String(key)] = normalizeAdminRole(value);
  }
  return map;
}

export async function saveAdminRolesMap(admin, rolesMap, adminUserId) {
  const payload = {
    key: SETTINGS_KEY,
    value_json: rolesMap,
    updated_by_admin: adminUserId || null,
    updated_at: new Date().toISOString(),
  };
  let { error } = await admin.from(SETTINGS_TABLE).upsert(payload, { onConflict: "key" });
  const isUpdatedByFkError =
    String(error?.code || "") === "23503" &&
    String(error?.message || "").includes("admin_settings_updated_by_admin_fkey");
  if (isUpdatedByFkError) {
    ({ error } = await admin
      .from(SETTINGS_TABLE)
      .upsert({ ...payload, updated_by_admin: null }, { onConflict: "key" }));
  }
  if (error) throw new Error(String(error?.message || "Failed to save admin roles."));
}

export function resolveAdminRole({ userId, email, rolesMap, currentAdminUserId, superAdminEmails }) {
  const id = String(userId || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const explicit = normalizeAdminRole(rolesMap?.[id] || "");
  if (rolesMap && Object.prototype.hasOwnProperty.call(rolesMap, id)) return explicit;
  if (superAdminEmails?.has(normalizedEmail)) return ADMIN_ROLE_SUPER;
  if ((!superAdminEmails || superAdminEmails.size === 0) && id && id === currentAdminUserId) return ADMIN_ROLE_SUPER;
  return ADMIN_ROLE_NORMAL;
}
