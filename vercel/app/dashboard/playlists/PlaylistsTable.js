"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import styles from "../page.module.css";

export default function PlaylistsTable({ items = [], selectedSlug = "" }) {
  const router = useRouter();
  const [rows, setRows] = useState(Array.isArray(items) ? items : []);
  const [editSlug, setEditSlug] = useState("");
  const [draftName, setDraftName] = useState("");
  const [savingSlug, setSavingSlug] = useState("");
  const [error, setError] = useState("");
  const [deleteSlug, setDeleteSlug] = useState("");

  const normalizedSelected = useMemo(
    () => String(selectedSlug || "").trim().toLowerCase(),
    [selectedSlug]
  );

  const startEdit = (row) => {
    setError("");
    setEditSlug(String(row?.slug || ""));
    setDraftName(String(row?.name || ""));
  };

  const cancelEdit = () => {
    setEditSlug("");
    setDraftName("");
    setError("");
  };

  async function confirmDelete() {
    const slug = String(deleteSlug || "").trim();
    if (!slug) return;
    setSavingSlug(slug);
    setError("");
    try {
      const res = await fetch("/api/admin/playlists/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to delete playlist.");
      const nextRows = rows.filter((row) => String(row.slug) !== slug);
      setRows(nextRows);
      setDeleteSlug("");
      if (normalizedSelected === slug.toLowerCase()) {
        const fallback = String(nextRows[0]?.slug || "").trim();
        if (fallback) {
          router.replace(`/dashboard/playlists?selected=${encodeURIComponent(fallback)}#playlist-editor`);
        } else {
          router.replace("/dashboard/playlists");
        }
      }
      router.refresh();
    } catch (e) {
      setError(e?.message || "Failed to delete playlist.");
    } finally {
      setSavingSlug("");
    }
  }

  async function saveRename(oldSlug) {
    const nextName = String(draftName || "").trim();
    if (!nextName) return;
    setSavingSlug(oldSlug);
    setError("");
    try {
      const res = await fetch("/api/admin/playlists/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ old_slug: oldSlug, new_name: nextName }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to rename playlist.");
      const nextItem = payload?.item || {};
      const nextSlug = String(nextItem.slug || oldSlug);
      const nextUpdatedAt = String(nextItem.updated_at || "");
      setRows((prev) =>
        prev.map((row) =>
          String(row.slug) === oldSlug
            ? { ...row, slug: nextSlug, name: nextName, updated_at: nextUpdatedAt }
            : row
        )
      );
      setEditSlug("");
      setDraftName("");
      const shouldMoveSelected = normalizedSelected === String(oldSlug || "").toLowerCase();
      if (shouldMoveSelected) {
        router.replace(`/dashboard/playlists?selected=${encodeURIComponent(nextSlug)}#playlist-editor`);
      }
      router.refresh();
    } catch (e) {
      setError(e?.message || "Failed to rename playlist.");
    } finally {
      setSavingSlug("");
    }
  }

  if (!rows.length) return <p className={styles.pending}>No playlist found yet.</p>;

  return (
    <>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Channels</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const slug = String(row.slug || "");
              const isEditing = editSlug === slug;
              const isSaving = savingSlug === slug;
              return (
                <tr
                  key={slug}
                  className={
                    slug.toLowerCase() === normalizedSelected
                      ? styles.selectedRow
                      : undefined
                  }
                >
                  <td>
                    <div className={styles.renameCell}>
                      {isEditing ? (
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className={styles.inlineRenameInput}
                          aria-label={`Rename playlist ${slug}`}
                          disabled={isSaving}
                        />
                      ) : (
                        <span>{String(row.name || "")}</span>
                      )}
                      <div className={styles.nameActions}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              aria-label="Save playlist name"
                              onClick={() => saveRename(slug)}
                              disabled={isSaving || !String(draftName || "").trim()}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              aria-label="Cancel rename"
                              onClick={cancelEdit}
                              disabled={isSaving}
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              aria-label="Edit playlist name"
                              onClick={() => startEdit(row)}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              aria-label="Delete playlist"
                              onClick={() => setDeleteSlug(slug)}
                              disabled={isSaving}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td><code>{slug}</code></td>
                  <td>{Number(row.channel_count || 0)}</td>
                  <td>{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
                  <td>
                    <Link
                      href={`/dashboard/playlists?selected=${encodeURIComponent(slug)}#playlist-editor`}
                      className={styles.navCta}
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error ? <p className={styles.errorText}>{error}</p> : null}

      <AlertDialog open={Boolean(deleteSlug)} onOpenChange={(v) => (!v ? setDeleteSlug("") : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this playlist and its related mappings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <button type="button" className={styles.secondaryBtn} disabled={Boolean(savingSlug)}>
                Cancel
              </button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={confirmDelete}
                disabled={Boolean(savingSlug)}
              >
                {savingSlug ? "Deleting..." : "Delete Playlist"}
              </button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
