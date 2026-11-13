import { redirect } from "next/navigation";
import { getHomeIptvData } from "../../components/iptv/homeData";
import { loadClientAccessSettingsCached } from "../../lib/clientAccessSettings";
import { getCurrentClient } from "../../lib/clientAuth";
import { buildWatchPath } from "../../lib/channelSlug";

export const dynamic = "force-dynamic";

export default async function WatchEntryPage({ searchParams }) {
  const query = await searchParams;
  const wantsMovies = String(query?.mode || "").toLowerCase() === "movies";
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
  const target = firstChannel ? buildWatchPath(firstChannel) : "/";
  // keep every query parameter (mode=movies, movie filters) through the redirect
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, String(v)));
    else if (value != null) qs.set(key, String(value));
  }
  const search = qs.toString();
  redirect(firstChannel && search ? `${target}?${search}` : wantsMovies ? `${target}?mode=movies` : target);
}
