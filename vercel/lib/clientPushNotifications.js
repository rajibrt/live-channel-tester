import { getSupabaseAdmin } from "./supabaseAdmin";

function parseMaybeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

async function loadWebPushModule() {
  try {
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

export async function sendClientPush({
  title = "",
  message = "",
  payload = {},
  targetUserIds = [],
} = {}) {
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
    .from("client_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,is_active")
    .eq("is_active", true);

  if (Array.isArray(targetUserIds) && targetUserIds.length) {
    query = query.in("user_id", targetUserIds.map((v) => String(v || "").trim()).filter(Boolean));
  }

  const { data: rows, error } = await query;
  if (error || !Array.isArray(rows) || !rows.length) return { delivered: 0, skipped: true };

  const data = payload && typeof payload === "object" ? payload : {};
  const body = JSON.stringify({
    title: String(title || "WEBTV BD"),
    body: String(message || "").slice(0, 220),
    data,
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
          .from("client_push_subscriptions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", row.id);
      }
    }
  }
  return { delivered, skipped: false };
}
