import { redirect } from "next/navigation";
import RadioPage from "../../components/radio/RadioPage";
import { loadClientAccessSettingsCached } from "../../lib/clientAccessSettings";
import { getCurrentClient } from "../../lib/clientAuth";
import { getRadioStations } from "../../lib/radioData";

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
  return <RadioPage stations={stations} />;
}

