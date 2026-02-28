"use client";

import { useEffect, useState } from "react";

export default function FacebookHashHandler() {
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = String(window.location.hash || "");
    if (!hash.includes("access_token=")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = String(params.get("access_token") || "").trim();
    if (!accessToken) return;
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    let active = true;
    setWorking(true);
    setMessage("Completing Facebook sign-in...");

    fetch("/api/client/auth/facebook/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(payload?.error || "Facebook sign-in failed.");
        const next = String(payload?.redirect_to || "/");
        window.location.replace(next);
      })
      .catch((err) => {
        if (!active) return;
        const msg = err?.message || "Facebook sign-in failed.";
        setMessage(msg);
        const q = new URLSearchParams();
        q.set("error", "facebook_profile");
        window.history.replaceState({}, "", `/client-login?${q.toString()}`);
      })
      .finally(() => {
        if (active) setWorking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!working && !message) return null;
  return (
    <p role="status" style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
      {message}
    </p>
  );
}
