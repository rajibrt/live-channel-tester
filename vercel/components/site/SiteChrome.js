"use client";

import { usePathname } from "next/navigation";
import PublicSiteHeader from "./PublicSiteHeader";
import PublicSiteFooter from "./PublicSiteFooter";
import PublicConsentManager from "./PublicConsentManager";

const MONETIZABLE_PREFIXES = ["/articles"];

function shouldHidePublicChrome(pathname, hasClientSession) {
  const path = String(pathname || "");
  if (!hasClientSession) return false;
  return path.startsWith("/watch/") || path.startsWith("/movie/");
}

export default function SiteChrome({ hasClientSession = false, viewerEntryHref = "/client-login", children }) {
  const pathname = usePathname();
  const path = String(pathname || "");
  const hidePublicChrome = shouldHidePublicChrome(pathname, hasClientSession);
  const isEditorialContent = path === "/" || MONETIZABLE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  return (
    <>
      {!hidePublicChrome ? <PublicSiteHeader viewerEntryHref={viewerEntryHref} /> : null}
      {children}
      {!hidePublicChrome ? <PublicSiteFooter /> : null}
      {!hidePublicChrome ? <PublicConsentManager enableAds={isEditorialContent} /> : null}
    </>
  );
}
