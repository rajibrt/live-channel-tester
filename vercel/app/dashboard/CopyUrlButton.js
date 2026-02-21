"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function CopyUrlButton({ value }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      if (!value) return;
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.copyBtn}
      onClick={onCopy}
      title={copied ? "Copied" : "Copy playlist URL"}
      aria-label="Copy playlist URL"
    >
      {copied ? "Copied" : "⧉"}
    </button>
  );
}
