"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import styles from "../../workspace.module.css";
import ChannelsTab from "./ChannelsTab";
import GroupsTab from "./GroupsTab";
import HealthTab from "./HealthTab";
import SettingsTab from "./SettingsTab";
import { buildGroups } from "./groupUtils";

const TABS = [
  { id: "channels", label: "Channels" },
  { id: "groups", label: "Groups" },
  { id: "health", label: "Health" },
  { id: "settings", label: "Settings" },
];

function CopyLink({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      className={styles.ghostBtn}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy the playlist link:", value);
        }
      }}
    >
      <Copy size={14} />
      {copied ? "Copied" : "Copy M3U link"}
    </button>
  );
}

export default function PlaylistWorkspace({
  initialTab = "channels",
  playlist,
  playlistUrl = "",
  initialChannels = [],
  initialGroups = [],
  initialSourceCounts = {},
}) {
  const [tab, setTab] = useState(initialTab);
  const [channels, setChannels] = useState(() => initialChannels.map((c) => ({ ...c })));
  const [savedGroups, setSavedGroups] = useState(initialGroups);
  const [sourceCounts, setSourceCounts] = useState(initialSourceCounts || {});
  const [channelsGroup, setChannelsGroup] = useState(null);

  const groups = useMemo(() => buildGroups(channels, savedGroups), [channels, savedGroups]);
  const totals = useMemo(() => {
    const dead = channels.filter((c) => String(c.status || "").toUpperCase() === "DEAD").length;
    return { total: channels.length, dead, live: channels.length - dead };
  }, [channels]);

  const switchTab = useCallback(
    (next) => {
      setTab(next);
      const url = new URL(window.location.href);
      if (next === "channels") url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url.toString());
    },
    []
  );

  const tabCount = { channels: totals.total, groups: groups.length };

  return (
    <section className={styles.page}>
      <div className={styles.workspaceHead}>
        <div>
          <Link href="/dashboard/playlists" className={styles.breadcrumb}>
            ← All playlists
          </Link>
          <div className={styles.workspaceTitle}>
            <h2>{playlist.name}</h2>
            <span className={styles.muted}>
              /{playlist.slug} · {totals.total} channels · <span className={styles.good}>{totals.live} live</span>
              {totals.dead ? (
                <>
                  {" "}
                  · <span className={styles.bad}>{totals.dead} dead</span>
                </>
              ) : null}
            </span>
          </div>
        </div>
        <div className={styles.headActions}>
          <CopyLink value={playlistUrl} />
          <Link href={`/dashboard/playlists/${encodeURIComponent(playlist.slug)}/classic`} className={styles.ghostBtn}>
            Classic editor
          </Link>
        </div>
      </div>

      <nav className={styles.tabs} role="tablist" aria-label="Playlist sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
            {tabCount[t.id] !== undefined ? <span className={styles.tabCount}>{tabCount[t.id]}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "channels" ? (
        <ChannelsTab
          key={channelsGroup || "default"}
          initialGroup={channelsGroup}
          playlistSlug={playlist.slug}
          channels={channels}
          setChannels={setChannels}
          groups={groups}
          setSavedGroups={setSavedGroups}
          sourceCounts={sourceCounts}
          setSourceCounts={setSourceCounts}
        />
      ) : null}
      {tab === "groups" ? (
        <GroupsTab
          playlistSlug={playlist.slug}
          groups={groups}
          setChannels={setChannels}
          setSavedGroups={setSavedGroups}
          onOpenGroup={(name) => {
            setChannelsGroup(name);
            switchTab("channels");
          }}
        />
      ) : null}
      {tab === "health" ? (
        <HealthTab
          playlistSlug={playlist.slug}
          channels={channels}
          setChannels={setChannels}
          groups={groups}
          setSavedGroups={setSavedGroups}
          setSourceCounts={setSourceCounts}
        />
      ) : null}
      {tab === "settings" ? <SettingsTab playlist={playlist} playlistUrl={playlistUrl} /> : null}
    </section>
  );
}
