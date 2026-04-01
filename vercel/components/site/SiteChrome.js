"use client";

import { usePathname } from "next/navigation";
import PublicSiteHeader from "./PublicSiteHeader";
import PublicSiteFooter from "./PublicSiteFooter";

function shouldHidePublicChrome(pathname, hasClientSession) {
  const path = String(pathname || "");
  if (!hasClientSession) return false;
  return path === "/" || path.startsWith("/watch/") || path.startsWith("/movie/");
}

export default function SiteChrome({ hasClientSession = false, viewerEntryHref = "/client-login", children }) {
  const pathname = usePathname();
  const hidePublicChrome = shouldHidePublicChrome(pathname, hasClientSession);

  return (
    <>
      {!hidePublicChrome ? <PublicSiteHeader viewerEntryHref={viewerEntryHref} /> : null}
      {children}
      {!hidePublicChrome ? <PublicSiteFooter /> : null}
    </>
  );
}
