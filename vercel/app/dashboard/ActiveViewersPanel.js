"use client";

import styles from "./page.module.css";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

function formatDuration(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function ActiveViewersPanel({ title = "Watching Now", viewers = [] }) {
  const count = Array.isArray(viewers) ? viewers.length : 0;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" className={`${styles.statCard} ${styles.statCardButton}`}>
          <p>{title}</p>
          <strong>{count}</strong>
          <small className={styles.metaMuted}>Click to view active sessions</small>
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent className={styles.viewerModal}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Logged-in clients active on website in the recent window.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {count ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Channel</th>
                  <th>Active For</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {viewers.map((row) => (
                  <tr key={row.user_id}>
                    <td>{row.full_name || "Client"}</td>
                    <td>{row.email || row.mobile_number || "-"}</td>
                    <td>{row.current_channel_name || "-"}</td>
                    <td>{formatDuration(row.active_for_seconds)}</td>
                    <td>{row.last_seen_at ? new Date(row.last_seen_at).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.hint}>No active viewer session found right now.</p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <button type="button" className={styles.secondaryBtn}>Close</button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
