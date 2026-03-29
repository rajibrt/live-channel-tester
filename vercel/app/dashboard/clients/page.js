import ManageClientUsers from "./ManageClientUsers";
import styles from "../page.module.css";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { getActiveViewerSnapshot } from "../../../lib/activeViewers";

export const dynamic = "force-dynamic";

function pickProviderUserId(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const fb = identities.find((item) => String(item?.provider || "").toLowerCase() === "facebook");
  const meta = user?.user_metadata || {};
  return String(
    fb?.identity_id ||
      fb?.id ||
      meta?.provider_id ||
      meta?.sub ||
      user?.id ||
      ""
  ).trim();
}

function pickFacebookProfileUrl(user, providerUserId) {
  const meta = user?.user_metadata || {};
  const direct = String(meta?.link || meta?.profile_url || "").trim();
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  const username = String(meta?.user_name || meta?.username || "").trim();
  if (/^[A-Za-z0-9.]{3,100}$/.test(username)) return `https://www.facebook.com/${username}`;
  if (/^\d{5,30}$/.test(providerUserId)) return `https://www.facebook.com/profile.php?id=${providerUserId}`;
  return "";
}

async function syncMissingFacebookClientUsers(admin) {
  try {
    const [{ data: listed, error: listErr }, { data: currentUsers }, { data: adminUsers }] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("client_users").select("user_id,email"),
      admin.from("admin_users").select("user_id"),
    ]);
    if (listErr) return;

    const existingIds = new Set((currentUsers || []).map((x) => String(x?.user_id || "").trim()).filter(Boolean));
    const existingEmails = new Set((currentUsers || []).map((x) => String(x?.email || "").trim().toLowerCase()).filter(Boolean));
    const adminIds = new Set((adminUsers || []).map((x) => String(x?.user_id || "").trim()).filter(Boolean));

    const inserts = [];
    const now = new Date().toISOString();
    for (const user of listed?.users || []) {
      const userId = String(user?.id || "").trim();
      if (!userId || existingIds.has(userId) || adminIds.has(userId)) continue;

      const provider = String(user?.app_metadata?.provider || "").trim().toLowerCase();
      const providers = Array.isArray(user?.app_metadata?.providers)
        ? user.app_metadata.providers.map((p) => String(p || "").toLowerCase())
        : [];
      const hasFacebookIdentity = Array.isArray(user?.identities)
        ? user.identities.some((item) => String(item?.provider || "").toLowerCase() === "facebook")
        : false;
      const isFacebook = provider === "facebook" || providers.includes("facebook") || hasFacebookIdentity;
      if (!isFacebook) continue;

      const providerUserId = pickProviderUserId(user);
      const fallbackEmail = `fb_${providerUserId || userId}@facebook.local`;
      const normalizedEmail = String(user?.email || "").trim().toLowerCase();
      const loginEmail = normalizedEmail && !existingEmails.has(normalizedEmail) ? normalizedEmail : fallbackEmail;
      const fullName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim();
      const avatarUrl = String(user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "").trim();
      const profileUrl = pickFacebookProfileUrl(user, providerUserId);
      const rawMeta = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
      const oauthProfile = profileUrl ? { ...rawMeta, profile_url: profileUrl } : rawMeta;

      inserts.push({
        user_id: userId,
        email: loginEmail,
        full_name: fullName,
        mobile_number: "",
        mobile_login_key: null,
        approval_status: "pending",
        approved_at: null,
        approved_by_admin: null,
        approval_note: "",
        auth_provider: "facebook",
        provider_user_id: providerUserId,
        avatar_url: avatarUrl,
        oauth_profile_json: oauthProfile,
        lifetime_watch_count: 0,
        lifetime_watch_seconds: 0,
        last_watched_at: null,
        is_active: true,
        created_at: String(user?.created_at || now),
        updated_at: now,
      });
      existingEmails.add(loginEmail);
    }

    if (!inserts.length) return;
    await admin.from("client_users").upsert(inserts, { onConflict: "user_id" });
    await admin.from("client_state").upsert(
      inserts.map((x) => ({
        user_id: x.user_id,
        favorites: [],
        recent: [],
        last_channel_id: "",
        theme: "dark",
        updated_at: now,
      })),
      { onConflict: "user_id" }
    );
  } catch {
    // keep dashboard usable even when auth sync fails transiently
  }
}

async function getClientUsers() {
  const admin = getSupabaseAdmin();
  await syncMissingFacebookClientUsers(admin);
  const [{ data: users }, { data: pushSubscriptions }] = await Promise.all([
    admin
      .from("client_users")
      .select("user_id,email,full_name,mobile_number,is_active,approval_status,approval_note,auth_provider,provider_user_id,avatar_url,oauth_profile_json,lifetime_watch_count,lifetime_watch_seconds,last_watched_at,created_at,updated_at")
      .order("created_at", { ascending: false }),
    admin
      .from("client_push_subscriptions")
      .select("user_id,is_active,updated_at")
      .eq("is_active", true),
  ]);

  const pushByUser = (Array.isArray(pushSubscriptions) ? pushSubscriptions : []).reduce((map, row) => {
    const key = String(row?.user_id || "").trim();
    if (!key) return map;
    const current = map.get(key) || { push_enabled: false, push_subscription_count: 0, push_updated_at: "" };
    current.push_enabled = true;
    current.push_subscription_count += 1;
    const updatedAt = String(row?.updated_at || "");
    if (!current.push_updated_at || new Date(updatedAt).getTime() > new Date(current.push_updated_at).getTime()) {
      current.push_updated_at = updatedAt;
    }
    map.set(key, current);
    return map;
  }, new Map());

  return (Array.isArray(users) ? users : []).map((user) => {
    const pushState = pushByUser.get(String(user?.user_id || "").trim()) || {
      push_enabled: false,
      push_subscription_count: 0,
      push_updated_at: "",
    };
    return {
      ...user,
      watch_count: Math.max(0, Number(user?.lifetime_watch_count || 0)),
      total_watch_seconds: Math.max(0, Number(user?.lifetime_watch_seconds || 0)),
      last_watched_at: String(user?.last_watched_at || ""),
      push_enabled: !!pushState.push_enabled,
      push_subscription_count: Math.max(0, Number(pushState.push_subscription_count || 0)),
      push_updated_at: String(pushState.push_updated_at || ""),
    };
  });
}

export default async function ClientsPage() {
  const [items, activeViewers] = await Promise.all([getClientUsers(), getActiveViewerSnapshot()]);

  return (
    <section className={styles.card}>
      <ManageClientUsers initialItems={items} initialActiveViewers={activeViewers?.viewers || []} />
    </section>
  );
}
