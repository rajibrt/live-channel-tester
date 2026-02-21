import { requireAdmin } from "../../lib/auth";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

async function getData() {
  const supabase = getSupabaseAdmin();
  const { data: playlists } = await supabase
    .from("playlists")
    .select("slug,name,channel_count,updated_at")
    .order("updated_at", { ascending: false });
  const { data: tokens } = await supabase
    .from("playlist_tokens")
    .select("playlist_slug,token,is_active")
    .eq("is_active", true);
  const tokenBySlug = Object.fromEntries((tokens || []).map((t) => [t.playlist_slug, t.token]));
  return { playlists: playlists || [], tokenBySlug };
}

export default async function DashboardPage() {
  await requireAdmin();
  const { playlists, tokenBySlug } = await getData();
  const base = process.env.PUBLIC_PLAYLIST_BASE_URL || "";

  return (
    <main>
      <h1>Admin Dashboard</h1>
      <form action="/api/auth/logout" method="post" style={{ marginBottom: 18 }}>
        <button type="submit">Logout</button>
      </form>

      <section style={{ marginBottom: 24 }}>
        <h2>Create / Update Playlist</h2>
        <form method="post" action="/api/admin/playlists">
          <input name="slug" placeholder="playlist-slug" required style={{ marginRight: 8 }} />
          <input name="name" placeholder="Playlist name" required style={{ marginRight: 8 }} />
          <button type="submit">Save Playlist</button>
        </form>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Add / Update Channel + Attach Playlist</h2>
        <form method="post" action="/api/admin/channels">
          <input name="playlist_slug" placeholder="playlist slug" required style={{ marginRight: 8 }} />
          <input name="stream_url" placeholder="stream url" required style={{ marginRight: 8 }} />
          <input name="name" placeholder="channel name" required style={{ marginRight: 8 }} />
          <input name="category" placeholder="category" style={{ marginRight: 8 }} />
          <input name="logo_url" placeholder="logo url" style={{ marginRight: 8 }} />
          <button type="submit">Save Channel</button>
        </form>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Generate Permanent Token</h2>
        <form method="post" action="/api/admin/tokens">
          <input name="playlist_slug" placeholder="playlist slug" required style={{ marginRight: 8 }} />
          <button type="submit">Generate / Rotate Token</button>
        </form>
      </section>

      <section>
        <h2>Playlists</h2>
        <table cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th align="left">Slug</th>
              <th align="left">Name</th>
              <th align="left">Channels</th>
              <th align="left">Token URL</th>
            </tr>
          </thead>
          <tbody>
            {playlists.map((p) => {
              const token = tokenBySlug[p.slug];
              const url = token && base ? `${base}/playlist/${token}.m3u` : "";
              return (
                <tr key={p.slug}>
                  <td>{p.slug}</td>
                  <td>{p.name}</td>
                  <td>{p.channel_count}</td>
                  <td>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer">{url}</a>
                    ) : (
                      <span>Generate token</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
