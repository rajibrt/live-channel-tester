"use client";

import { useEffect, useMemo, useState } from "react";

export function usePersistentArray(key, initial = [], options = {}) {
  const persist = options?.persist !== false;
  const clearOnDisable = options?.clearOnDisable !== false;
  const storageKey = useMemo(() => `iptv:v1:${key}`, [key]);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    if (!persist) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setValue(parsed);
    } catch {
      // ignore invalid localStorage
    }
  }, [storageKey, persist]);

  useEffect(() => {
    if (!persist) {
      if (!clearOnDisable) return;
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore storage quota errors
      }
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore storage quota errors
    }
  }, [storageKey, value, persist]);

  return [value, setValue];
}
