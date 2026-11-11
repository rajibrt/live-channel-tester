"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import styles from "../../workspace.module.css";
import { normalizeGroup } from "./groupUtils";

async function groupAction(playlistSlug, body) {
  const res = await fetch(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/groups`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Group update failed.");
  return json;
}

export default function GroupsTab({ playlistSlug, groups, setChannels, setSavedGroups, onOpenGroup }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null); // { name, draft }
  const [deleting, setDeleting] = useState(null); // { name, total, moveTo }
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  const names = groups.map((g) => g.name);

  const run = async (fn, success) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      if (success) setMessage(success);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveOrder = (next) =>
    run(async () => {
      await groupAction(playlistSlug, { action: "reorder", names: next });
      setSavedGroups(next);
    });

  const moveGroup = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= names.length) return;
    const next = [...names];
    [next[index], next[target]] = [next[target], next[index]];
    saveOrder(next);
  };

  const dropAt = (target) => {
    const from = dragIndex;
    setDragIndex(null);
    setDropIndex(null);
    if (from === null || target === null || from === target) return;
    const next = [...names];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    saveOrder(next);
  };

  const moveToTop = (index) => {
    if (index <= 0) return;
    const next = [...names];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    saveOrder(next);
  };

  const sortAZ = () => {
    const next = [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    run(async () => {
      await groupAction(playlistSlug, { action: "reorder", names: next });
      setSavedGroups(next);
    }, "Groups sorted A–Z.");
  };

  const addGroup = () => {
    const name = newName.trim();
    if (!name) return;
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setError(`“${name}” already exists.`);
      return;
    }
    run(async () => {
      await groupAction(playlistSlug, { action: "add", name });
      setSavedGroups([...names, name]);
      setNewName("");
    }, `Group “${name}” added. Move channels into it from the Channels tab.`);
  };

  const renameGroup = () => {
    const from = editing.name;
    const to = editing.draft.trim();
    if (!to || to === from) {
      setEditing(null);
      return;
    }
    run(async () => {
      const json = await groupAction(playlistSlug, { action: "rename", from, to });
      setChannels((prev) => prev.map((c) => (normalizeGroup(c.category) === from ? { ...c, category: to } : c)));
      setSavedGroups((prev) => {
        const list = prev.length ? prev : names;
        const replaced = list.map((n) => (n === from ? to : n));
        return [...new Set(replaced)];
      });
      setEditing(null);
      return json;
    }, `Renamed “${from}” to “${to}”.`);
  };

  const deleteGroup = () => {
    const { name, total, moveTo } = deleting;
    if (total && !moveTo) {
      setError("Choose where to move the channels first.");
      return;
    }
    run(async () => {
      await groupAction(playlistSlug, { action: "delete", name, move_to: moveTo || "" });
      if (total) setChannels((prev) => prev.map((c) => (normalizeGroup(c.category) === name ? { ...c, category: moveTo } : c)));
      setSavedGroups((prev) => (prev.length ? prev : names).filter((n) => n !== name));
      setDeleting(null);
    }, total ? `Deleted “${name}” and moved ${total} channel(s) to “${moveTo}”.` : `Deleted “${name}”.`);
  };

  return (
    <div className={styles.listPanel}>
      <div className={styles.toolbar}>
        <input
          className={styles.input}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addGroup();
          }}
          placeholder="New group name"
          aria-label="New group name"
        />
        <button type="button" className={styles.primaryBtn} onClick={addGroup} disabled={busy || !newName.trim()}>
          <Plus size={16} />
          Add group
        </button>
        <button type="button" className={styles.ghostBtn} onClick={sortAZ} disabled={busy || names.length < 2}>
          Sort A–Z
        </button>
      </div>
      <p className={styles.muted}>
        The order here is the order viewers see. Drag a row by its handle (or use the arrows) to reorder; changes save immediately.
        Renaming a group renames it for every channel in it; deleting a group moves its channels to another group.
      </p>
      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}

      <ul className={styles.channelList}>
        <li className={`${styles.groupRow} ${styles.listHeader}`}>
          <span>Order</span>
          <span>Group</span>
          <span>Channels</span>
          <span>Dead</span>
          <span />
        </li>
        {groups.map((g, index) => (
          <li
            key={g.name}
            className={`${styles.groupRow} ${dragIndex === index ? styles.dragging : ""} ${dropIndex === index && dragIndex !== index ? styles.dropTarget : ""}`}
            draggable={!busy && !editing}
            onDragStart={(e) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", g.name);
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dropIndex !== index) setDropIndex(index);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDropIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              dropAt(index);
            }}
          >
            <span className={styles.orderBtns}>
              <span className={styles.dragHandle} title="Drag to reorder" aria-hidden="true">
                <GripVertical size={16} />
              </span>
              <button type="button" className={styles.iconBtn} disabled={busy || index === 0} onClick={() => moveGroup(index, -1)} aria-label={`Move ${g.name} up`}>
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                disabled={busy || index === groups.length - 1}
                onClick={() => moveGroup(index, 1)}
                aria-label={`Move ${g.name} down`}
              >
                <ArrowDown size={14} />
              </button>
            </span>
            {editing?.name === g.name ? (
              <span className={styles.inlineEdit}>
                <input
                  className={styles.input}
                  value={editing.draft}
                  onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameGroup();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  autoFocus
                  aria-label="Group name"
                />
                <button type="button" className={styles.iconBtn} onClick={renameGroup} disabled={busy} aria-label="Save name">
                  <Check size={14} />
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => setEditing(null)} aria-label="Cancel">
                  <X size={14} />
                </button>
              </span>
            ) : (
              <button type="button" className={styles.groupLink} onClick={() => onOpenGroup?.(g.name)} title="Show channels in this group">
                {g.name}
              </button>
            )}
            <span>{g.total}</span>
            <span className={g.dead ? styles.bad : styles.muted}>{g.dead || "—"}</span>
            <span className={styles.rowActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => moveToTop(index)} disabled={busy || index === 0} title="Move to the top">
                Top
              </button>
              <button type="button" className={styles.ghostBtn} onClick={() => setEditing({ name: g.name, draft: g.name })} disabled={busy}>
                <Pencil size={14} />
                Rename
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => setDeleting({ name: g.name, total: g.total, moveTo: "" })}
                disabled={busy}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>

      {deleting ? (
        <div className={styles.modalWrap} role="dialog" aria-modal="true" aria-labelledby="delete-group-title">
          <div className={styles.modalCard}>
            <div className={styles.modalHead}>
              <h3 id="delete-group-title">Delete “{deleting.name}”?</h3>
              <button type="button" className={styles.iconBtn} onClick={() => setDeleting(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            {deleting.total ? (
              <label className={styles.field}>
                <span>Move its {deleting.total} channel(s) to</span>
                <select className={styles.select} value={deleting.moveTo} onChange={(e) => setDeleting({ ...deleting, moveTo: e.target.value })}>
                  <option value="">Choose a group…</option>
                  {names
                    .filter((n) => n !== deleting.name)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <p className={styles.muted}>This group is empty.</p>
            )}
            {error ? <p className={styles.errorText}>{error}</p> : null}
            <div className={styles.modalFoot}>
              <button type="button" className={styles.ghostBtn} onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button type="button" className={styles.dangerBtn} onClick={deleteGroup} disabled={busy || (deleting.total && !deleting.moveTo)}>
                Delete group
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
