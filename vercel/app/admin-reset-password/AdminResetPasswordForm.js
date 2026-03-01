"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import styles from "../login/page.module.css";

function getClient() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !anon) return null;
  return createClient(url, anon);
}

export default function AdminResetPasswordForm() {
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const supabase = useMemo(() => getClient(), []);

  useEffect(() => {
    let active = true;
    async function initRecovery() {
      if (!supabase) {
        if (active) setError("Missing client env for Supabase.");
        return;
      }
      setWorking(true);
      setError("");
      try {
        const currentUrl = new URL(window.location.href);
        const params = currentUrl.searchParams;
        const code = String(params.get("code") || "").trim();
        const tokenHash = String(params.get("token_hash") || "").trim();
        const type = String(params.get("type") || "").trim();
        const hash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
        const accessToken = String(hash.get("access_token") || "").trim();
        const refreshToken = String(hash.get("refresh_token") || "").trim();

        if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) throw codeError;
        } else if (tokenHash && type === "recovery") {
          const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (otpError) throw otpError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else {
          throw new Error("Missing recovery token.");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) throw new Error("Session could not be recovered.");
        if (!active) return;
        setReady(true);
      } catch {
        if (!active) return;
        setError("Reset link is invalid or expired. Request a new one from the login page.");
      } finally {
        if (active) setWorking(false);
      }
    }
    initRecovery();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setWorking(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      window.location.replace("/login?reset=updated");
    } catch {
      setError("Could not update password. Try requesting a fresh reset link.");
      setWorking(false);
    }
  }

  if (working && !ready && !error) {
    return <p className={styles.note}>Validating reset link...</p>;
  }

  if (error && !ready) {
    return (
      <div>
        <p className={`${styles.note} ${styles.errorNote}`} role="alert">
          {error}
        </p>
        <a className={styles.link} href="/login">
          Back to login
        </a>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error ? (
        <p className={`${styles.note} ${styles.errorNote}`} role="alert">
          {error}
        </p>
      ) : null}
      <label className={styles.field}>
        <span>New Password</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label className={styles.field}>
        <span>Confirm New Password</span>
        <input
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>
      <button type="submit" className={styles.submit} disabled={working}>
        {working ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
