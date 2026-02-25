import styles from "../page.module.css";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import ChannelAttachForm from "./ChannelAttachForm";

async function getPageData() {
  const supabase = getSupabaseAdmin();
  const [{ data: playlists }, { data: groups }, { data: links }] = await Promise.all([
    supabase.from("playlists").select("slug,name").order("updated_at", { ascending: false }),
    supabase
      .from("playlist_groups")
      .select("playlist_slug,name,position")
      .order("playlist_slug", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("playlist_channels")
      .select("playlist_slug,channel_id")
      .order("playlist_slug", { ascending: true }),
  ]);

  const categoryMap = new Map();
  const channelNameMap = new Map();
  for (const row of groups || []) {
    const slug = String(row?.playlist_slug || "").trim().toLowerCase();
    const name = String(row?.name || "").trim();
    if (!slug || !name) continue;
    if (!categoryMap.has(slug)) categoryMap.set(slug, []);
    const list = categoryMap.get(slug);
    if (!list.includes(name)) list.push(name);
  }

  const channelIds = [...new Set((links || []).map((x) => Number(x?.channel_id)).filter((x) => Number.isFinite(x)))];
  if (channelIds.length) {
    const { data: channelRows } = await supabase
      .from("channels")
      .select("id,category,name")
      .in("id", channelIds);
    const byChannelId = new Map(
      (channelRows || []).map((row) => [
        Number(row.id),
        {
          category: String(row.category || "").trim(),
          name: String(row.name || "").trim(),
        },
      ])
    );

    for (const row of links || []) {
      const slug = String(row?.playlist_slug || "").trim().toLowerCase();
      if (!slug) continue;
      const channelMeta = byChannelId.get(Number(row?.channel_id)) || { category: "", name: "" };
      const category = String(channelMeta.category || "").trim();
      const channelName = String(channelMeta.name || "").trim();
      if (!category) continue;
      if (!categoryMap.has(slug)) categoryMap.set(slug, []);
      const list = categoryMap.get(slug);
      if (!list.includes(category)) list.push(category);

      if (channelName) {
        if (!channelNameMap.has(slug)) channelNameMap.set(slug, []);
        const nameList = channelNameMap.get(slug);
        if (!nameList.includes(channelName)) nameList.push(channelName);
      }
    }
  }

  const categoriesByPlaylist = Object.fromEntries(categoryMap.entries());
  const channelNamesByPlaylist = Object.fromEntries(channelNameMap.entries());
  return {
    playlists: Array.isArray(playlists) ? playlists : [],
    categoriesByPlaylist,
    channelNamesByPlaylist,
  };
}

export default async function ChannelsPage() {
  const { playlists, categoriesByPlaylist, channelNamesByPlaylist } = await getPageData();
  return (
    <section className={styles.card}>
      <h2>Add New Channel</h2>
      <p className={styles.hint}>Add a new stream link and choose which playlist/category it belongs to.</p>
      <ChannelAttachForm
        playlists={playlists}
        categoriesByPlaylist={categoriesByPlaylist}
        channelNamesByPlaylist={channelNamesByPlaylist}
      />
    </section>
  );
}
