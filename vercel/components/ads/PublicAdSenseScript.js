"use client";

import Script from "next/script";

const ADSENSE_CLIENT = "ca-pub-3010934061489506";

export default function PublicAdSenseScript() {
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
