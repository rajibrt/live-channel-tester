"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./public-pages.module.css";

function BrandIcon({ name }) {
  if (name === "facebook") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v8h4v-8h3.5l.5-4h-4V9c0-.6.4-1 1-1Z" /></svg>;
  }
  if (name === "x") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 3H22l-6.8 7.8L23 21h-6.1l-4.8-6.3L6.6 21H3.5l7.1-8.1L3 3h6.3l4.3 5.7L18.9 3Zm-1.1 16.2h1.7L8.4 4.7H6.6l11.2 14.5Z" /></svg>;
  }
  if (name === "whatsapp") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.5 4.1 1.6 5.9L.2 24l6.5-1.7c1.7.9 3.6 1.4 5.5 1.4 6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.1-3.5-8.4Zm-8.4 18.2c-1.7 0-3.4-.5-4.9-1.3l-.4-.2-3.9 1 1-3.8-.2-.4a9.7 9.7 0 1 1 8.4 4.7Zm5.3-7.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-1.8-.9-3-1.7-4.2-3.8-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6L8.8 7c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.7 5.9 5.2 2.2.9 3 .9 4.1.8.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.2-.2-.7-.3-2-.8Z" /></svg>;
  }
  if (name === "linkedin") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.4 7.6H1V22h4.4V7.6ZM3.2 1A2.6 2.6 0 1 0 3.2 6.2 2.6 2.6 0 0 0 3.2 1ZM23 13.7c0-4.3-2.3-6.4-5.4-6.4-2.5 0-3.6 1.4-4.2 2.3v-2h-4.4V22h4.4v-8c0-2.1.4-4.2 3.1-4.2 2.7 0 2.7 2.5 2.7 4.3V22H23v-8.3Z" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 15.5 15.5 8.5M7 17H5a4 4 0 0 1 0-8h4M17 7h2a4 4 0 0 1 0 8h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function copyWithFallback(value) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed");
}

export default function ArticleShareActions({ title, url, labels }) {
  const [copyState, setCopyState] = useState("idle");
  const resetTimerRef = useRef(0);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const shareLinks = [
    { name: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: "x", label: "X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { name: "whatsapp", label: "WhatsApp", href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}` },
    { name: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
  ];

  useEffect(() => () => window.clearTimeout(resetTimerRef.current), []);

  const copyLink = async () => {
    window.clearTimeout(resetTimerRef.current);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else copyWithFallback(url);
      setCopyState("copied");
    } catch {
      try {
        copyWithFallback(url);
        setCopyState("copied");
      } catch {
        setCopyState("error");
      }
    }
    resetTimerRef.current = window.setTimeout(() => setCopyState("idle"), 2500);
  };

  const statusText = copyState === "copied" ? labels.copied : copyState === "error" ? labels.copyFailed : "";

  return (
    <section className={styles.articleShare} aria-label={labels.shareTitle}>
      <span className={styles.articleShareLabel}>{labels.shareTitle}</span>
      <div className={styles.articleShareActions}>
        {shareLinks.map((item) => (
          <a
            key={item.name}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.articleShareIcon} ${styles[`articleShare${item.name[0].toUpperCase()}${item.name.slice(1)}`]}`}
            aria-label={`${labels.shareOn} ${item.label}`}
            title={`${labels.shareOn} ${item.label}`}
          >
            <BrandIcon name={item.name} />
          </a>
        ))}
        <button
          type="button"
          className={`${styles.articleShareIcon} ${styles.articleShareCopy}`}
          onClick={copyLink}
          aria-label={copyState === "copied" ? labels.copied : labels.copyLink}
          title={copyState === "copied" ? labels.copied : labels.copyLink}
        >
          <BrandIcon name="link" />
        </button>
      </div>
      <span className={styles.articleShareStatus} aria-live="polite">{statusText}</span>
    </section>
  );
}
