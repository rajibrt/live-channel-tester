import { redirect } from "next/navigation";
import { getPlaylistSummaries } from "../../../lib/playlistAdminData";
import PlaylistCards from "./PlaylistCards";

export const dynamic = "force-dynamic";

export default async function PlaylistsPage({ searchParams }) {
  const query = (await searchParams) || {};
  // Old links (/dashboard/playlists?selected=slug) open the new workspace.
  const selected = String(query?.selected || "").trim().toLowerCase();
  if (selected) redirect(`/dashboard/playlists/${encodeURIComponent(selected)}`);

  const playlists = await getPlaylistSummaries();
  return <PlaylistCards playlists={playlists} />;
}
