"use client";

import { usePathname } from "next/navigation";
import PublicSiteHeader from "./PublicSiteHeader";
import PublicSiteFooter from "./PublicSiteFooter";
import PublicConsentManager from "./PublicConsentManager";

const MONETIZABLE_PREFIXES = ["/articles"];

function shouldHidePublicChrome(pathname, hasClientSession) {
  const path = String(pathname || "");
  if (!hasClientSession) return false;
  return path.startsWith("/watch/") || path.startsWith("/movie/") || path === "/radio";
}

export default function SiteChrome({ hasClientSession = false, viewerEntryHref = "/client-login", radioHref = "/client-login?next=%2Fradio", moviesHref = "/client-login?next=%2Fwatch%3Fmode%3Dmovies", children }) {
  const pathname = usePathname();
  const path = String(pathname || "");
  const hidePublicChrome = shouldHidePublicChrome(pathname, hasClientSession);
  const isEditorialContent = path === "/" || MONETIZABLE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  return (
    <>
      {!hidePublicChrome ? <PublicSiteHeader viewerEntryHref={viewerEntryHref} radioHref={radioHref} moviesHref={moviesHref} /> : null}
      {children}
      {!hidePublicChrome ? <PublicSiteFooter /> : null}
      {!hidePublicChrome ? <PublicConsentManager enableAds={isEditorialContent} /> : null}
    </>
  );
}
