import { redirect } from "next/navigation";
import { getHomeIptvData } from "../../components/iptv/homeData";
import { loadClientAccessSettingsCached } from "../../lib/clientAccessSettings";
import { getCurrentClient } from "../../lib/clientAuth";
import { buildWatchPath } from "../../lib/channelSlug";

export const dynamic = "force-dynamic";

export default async function WatchEntryPage() {
  const [currentClient, accessSettings] = await Promise.all([
    getCurrentClient().catch(() => null),
    loadClientAccessSettingsCached().catch(() => null),
  ]);
  const approvalStatus = String(currentClient?.client?.approval_status || "").trim().toLowerCase();
  const hasApprovedClientSession = !!currentClient && approvalStatus === "approved";
  const hasPublicGuestAccess = !currentClient && accessSettings?.public_guest_access_enabled === true;

  if (!hasApprovedClientSession && !hasPublicGuestAccess) {
    redirect("/client-login");
  }

  const homeData = await getHomeIptvData().catch(() => null);
  const firstChannel = Array.isArray(homeData?.channels) ? homeData.channels[0] : null;
  redirect(firstChannel ? buildWatchPath(firstChannel) : "/");
}
