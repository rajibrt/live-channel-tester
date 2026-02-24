"use client";

import styles from "./iptv.module.css";

const COPY = {
  en: {
    title: "Cookie & History Preferences",
    body: "Allow cookies and history sync to improve your experience across devices.",
    bullets: [
      "Sync recent watch history between devices",
      "Restore your last viewed channel quickly",
      "Keep personalized viewing continuity",
    ],
    allow: "Allow",
    decline: "Decline",
    lang: "বাংলাতে দেখুন",
  },
  bn: {
    title: "কুকি ও হিস্টরি পারমিশন",
    body: "পারমিশন দিলে আপনার অভিজ্ঞতা একাধিক ডিভাইসে ভালোভাবে সিঙ্ক হবে।",
    bullets: [
      "এক ডিভাইসের recent history অন্য ডিভাইসে দেখা যাবে",
      "শেষ দেখা চ্যানেল দ্রুত রিস্টোর হবে",
      "ব্যক্তিগত viewing continuity বজায় থাকবে",
    ],
    allow: "Allow",
    decline: "Decline",
    lang: "View in English",
  },
};

export default function CookieConsentBanner({
  consent = "unknown",
  language = "en",
  onToggleLanguage,
  onAllow,
  onDecline,
}) {
  if (consent === "accepted" || consent === "declined") return null;
  const copy = COPY[language] || COPY.en;

  return (
    <section className={styles.cookieBanner} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className={styles.cookieBannerHead}>
        <h3>{copy.title}</h3>
        <button type="button" className={styles.cookieLangBtn} onClick={onToggleLanguage}>
          {copy.lang}
        </button>
      </div>
      <p>{copy.body}</p>
      <ul>
        {copy.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className={styles.cookieActions}>
        <button type="button" className={styles.cookieDeclineBtn} onClick={onDecline}>
          {copy.decline}
        </button>
        <button type="button" className={styles.cookieAllowBtn} onClick={onAllow}>
          {copy.allow}
        </button>
      </div>
    </section>
  );
}
