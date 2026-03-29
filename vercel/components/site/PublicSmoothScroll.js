"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

const DISABLED_PREFIXES = [
  "/dashboard",
  "/login",
  "/client-login",
  "/client-signup",
  "/client-reset-password",
  "/admin-reset-password",
  "/playlist/",
  "/watch/",
  "/movie/",
];

export default function PublicSmoothScroll() {
  const pathname = usePathname();
  const path = String(pathname || "");

  useEffect(() => {
    if (!path || DISABLED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return undefined;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      return undefined;
    }

    const lenis = new Lenis({
      autoRaf: false,
      duration: 1.05,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.9,
      touchMultiplier: 1,
    });

    let frameId = 0;

    const onFrame = (time) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(onFrame);
    };

    frameId = window.requestAnimationFrame(onFrame);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      lenis.destroy();
    };
  }, [path]);

  return null;
}
