"use client";

import { useEffect, useState } from "react";
import styles from "./public-pages.module.css";

const OFFSET = 104; // sticky site header + a little air

// "On this page": smooth animated scroll to a section, highlights the section being read.
export default function ArticleToc({ items = [], label = "On this page" }) {
  const [active, setActive] = useState(items[0]?.id || "");

  useEffect(() => {
    const headings = items.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (!headings.length) return undefined;
    const onScroll = () => {
      let current = headings[0].id;
      for (const h of headings) if (h.getBoundingClientRect().top - OFFSET - 24 <= 0) current = h.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  const go = (event, id) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const lenis = typeof window !== "undefined" ? window.__webtvbdLenis : null;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (lenis && !reduce) {
      // Lenis already honours the heading's scroll-margin-top (96px), so only a little extra here
      lenis.scrollTo(target, { offset: -8, duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - OFFSET;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    }
    window.history.replaceState(window.history.state, "", `#${id}`);
    setActive(id);
    // brief highlight on arrival
    target.classList.remove(styles.adFlash);
    window.setTimeout(() => {
      target.classList.add(styles.adFlash);
      window.setTimeout(() => target.classList.remove(styles.adFlash), 1600);
    }, reduce ? 0 : 700);
  };

  return (
    <nav className={styles.adToc} aria-label={label}>
      <p>{label}</p>
      <ol>
        {items.map((item) => (
          <li key={item.id} className={active === item.id ? styles.adTocActive : undefined}>
            <a href={`#${item.id}`} onClick={(event) => go(event, item.id)} aria-current={active === item.id ? "location" : undefined}>
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
