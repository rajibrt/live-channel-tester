import { getSupabaseAdmin } from "./supabaseAdmin";

function parseMaybeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

async function loadWebPushModule() {
  try {
    // Avoid hard build-time dependency; if package is unavailable, push send is skipped.
    const dynamicImport = new Function("m", "return import(m);");
    const mod = await dynamicImport("web-push");
    return mod?.default || mod || null;
  } catch {
    return null;
  }
}

function shouldDeactivateSubscription(error) {
  const status = parseMaybeNumber(error?.statusCode || error?.status || 0);
  if (status === 404 || status === 410) return true;
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("expired") || msg.includes("gone") || msg.includes("invalid endpoint");
}

async function sendAdminPush({ title, message, payload = {}, targetAdminId = "" }) {
  const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:admin@example.com").trim();
  if (!publicKey || !privateKey || !subject) return { delivered: 0, skipped: true };

  const webPush = await loadWebPushModule();
  if (!webPush?.setVapidDetails || !webPush?.sendNotification) {
    return { delivered: 0, skipped: true };
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  const admin = getSupabaseAdmin();
  let query = admin
    .from("admin_push_subscriptions")
    .select("id,admin_user_id,endpoint,p256dh,auth,is_active")
    .eq("is_active", true);
  if (targetAdminId) query = query.eq("admin_user_id", targetAdminId);
  const { data: rows, error } = await query;
  if (error || !Array.isArray(rows) || !rows.length) return { delivered: 0, skipped: true };

  const body = JSON.stringify({
    title: String(title || "Admin notification"),
    body: String(message || "").slice(0, 180),
    data: payload && typeof payload === "object" ? payload : {},
  });

  let delivered = 0;
  for (const row of rows) {
    const endpoint = String(row?.endpoint || "").trim();
    const p256dh = String(row?.p256dh || "").trim();
    const auth = String(row?.auth || "").trim();
    if (!endpoint || !p256dh || !auth) continue;
    try {
      await webPush.sendNotification(
        { endpoint, keys: { p256dh, auth } },
        body
      );
      delivered += 1;
    } catch (err) {
      if (shouldDeactivateSubscription(err)) {
        await admin
          .from("admin_push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }
  }
  return { delivered, skipped: false };
}

export async function createAdminNotification({
  type = "system",
  title = "",
  message = "",
  payload = {},
  targetAdminId = "",
}) {
  const now = new Date().toISOString();
  const admin = getSupabaseAdmin();
  const record = {
    type: String(type || "system"),
    title: String(title || "Notification"),
    message: String(message || ""),
    payload_json: payload && typeof payload === "object" ? payload : {},
    target_admin_id: targetAdminId || null,
    is_read: false,
    read_at: null,
    created_at: now,
  };

  const { error } = await admin.from("admin_notifications").insert(record);
  if (error) return { ok: false, error };

  await sendAdminPush({
    title: record.title,
    message: record.message,
    payload: record.payload_json,
    targetAdminId: targetAdminId || "",
  });
  return { ok: true };
}
