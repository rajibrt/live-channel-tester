"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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

export default function PublicSmoothScroll({ hasClientSession = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const path = String(pathname || "");
  const search = searchParams.toString();
  const isViewerShell = hasClientSession && (path.startsWith("/watch/") || path.startsWith("/movie/"));

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [path, search]);

  useEffect(() => {
    if (typeof window.history?.scrollRestoration !== "string") {
      return undefined;
    }

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousRestoration || "auto";
    };
  }, []);

  useEffect(() => {
    if (!path || isViewerShell || DISABLED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
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
  }, [isViewerShell, path]);

  return null;
}
