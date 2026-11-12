import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Messages shown inside the radio spectrum, managed from Dashboard → Radio.
// Stored in admin_settings.radio_spectrum_messages (no new table needed).
export const RADIO_MESSAGES_KEY = "radio_spectrum_messages";
export const DEFAULT_CREDIT = "Developed by WEBTVBD.com";

export const DEFAULT_RADIO_MESSAGES = {
  enabled: true,
  credit: { text: DEFAULT_CREDIT, enabled: true },
  items: [],
  seconds: 8,
};

export function cleanRadioMessages(input) {
  const v = input && typeof input === "object" ? input : {};
  const seconds = Math.max(4, Math.min(30, Number.parseInt(v.seconds, 10) || 8));
  const creditText = String(v.credit?.text ?? DEFAULT_CREDIT).trim().slice(0, 120) || DEFAULT_CREDIT;
  const items = [];
  for (const it of Array.isArray(v.items) ? v.items.slice(0, 30) : []) {
    const text = String(it?.text || "").replace(/\s+/g, " ").trim().slice(0, 220);
    if (!text) continue;
    items.push({
      id: String(it?.id || Math.random().toString(36).slice(2, 10)).slice(0, 40),
      text,
      enabled: it?.enabled !== false,
      announcementId: it?.announcementId ? String(it.announcementId).slice(0, 60) : "",
    });
  }
  return { enabled: v.enabled !== false, credit: { text: creditText, enabled: v.credit?.enabled !== false }, items, seconds };
}

export async function loadRadioMessagesSetting(supabase = getSupabaseAdmin()) {
  const { data, error } = await supabase.from("admin_settings").select("value_json").eq("key", RADIO_MESSAGES_KEY).maybeSingle();
  if (error || !data?.value_json) return { ...DEFAULT_RADIO_MESSAGES };
  return cleanRadioMessages(data.value_json);
}

// What the player rotates through: enabled messages in order, credit line after them.
async function loadPlayerMessages() {
  const s = await loadRadioMessagesSetting().catch(() => ({ ...DEFAULT_RADIO_MESSAGES }));
  if (!s.enabled) return { list: [], seconds: s.seconds };
  const list = s.items.filter((i) => i.enabled).map((i) => i.text);
  if (s.credit.enabled) list.push(s.credit.text);
  return { list, seconds: s.seconds };
}

export const getRadioPlayerMessages = unstable_cache(loadPlayerMessages, ["radio-spectrum-messages"], {
  revalidate: 60,
  tags: ["radio-messages"],
});
