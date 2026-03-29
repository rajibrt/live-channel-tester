"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

const ADSENSE_CLIENT = "ca-pub-3010934061489506";

function shouldDisableAds(pathname) {
  const path = String(pathname || "");
  if (!path) return true;
  if (path === "/") return false;
  if (path === "/articles" || path.startsWith("/articles/")) return false;
  return true;
}

export default function PublicAdSenseScript() {
  const pathname = usePathname();

  if (shouldDisableAds(pathname)) {
    return null;
  }

  return (
    <>
      <meta name="google-adsense-account" content={ADSENSE_CLIENT} />
      <Script
        id="adsense-loader"
        strategy="afterInteractive"
        async
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      />
    </>
  );
}
