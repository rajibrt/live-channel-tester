"use client";

import { useEffect, useMemo, useState } from "react";

export function usePersistentArray(key, initial = []) {
  const storageKey = useMemo(() => `iptv:v1:${key}`, [key]);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setValue(parsed);
    } catch {
      // ignore invalid localStorage
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore storage quota errors
    }
  }, [storageKey, value]);

  return [value, setValue];
}
