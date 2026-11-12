import { redirect } from "next/navigation";
import RadioPage from "../../components/radio/RadioPage";
import { loadClientAccessSettingsCached } from "../../lib/clientAccessSettings";
import { getCurrentClient } from "../../lib/clientAuth";
import { getRadioStations } from "../../lib/radioData";
import { getRadioPlayerMessages } from "../../lib/radioMessages";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Radio | WEBTVBD",
  description: "Listen to Bangladeshi FM radio stations live on WEBTVBD.",
  robots: { index: false, follow: true },
};

export default async function RadioRoute() {
  const [currentClient, accessSettings] = await Promise.all([
    getCurrentClient().catch(() => null),
    loadClientAccessSettingsCached().catch(() => null),
  ]);
  const approved = !!currentClient && String(currentClient?.client?.approval_status || "approved").toLowerCase() === "approved";
  const guest = !currentClient && accessSettings?.public_guest_access_enabled === true;
  if (!approved && !guest) redirect(`/client-login?next=${encodeURIComponent("/radio")}`);

  const stations = await getRadioStations().catch(() => []);
  let favorites = [];
  if (approved) {
    const { data } = await getSupabaseAdmin()
      .from("client_radio_favorites")
      .select("station_id")
      .eq("user_id", currentClient.user.id)
      .then((r) => r, () => ({ data: [] }));
    favorites = (data || []).map((r) => String(r.station_id));
  }
  const messages = await getRadioPlayerMessages().catch(() => ({ list: ["Developed by WEBTVBD.com"], seconds: 8 }));
  return <RadioPage stations={stations} initialFavorites={favorites} signedIn={approved} messages={messages} />;
}

