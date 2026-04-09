import "./globals.css";
import Script from "next/script";
import { cookies } from "next/headers";
import { LanguageProvider } from "../components/i18n/LanguageProvider";
import PublicSmoothScroll from "../components/site/PublicSmoothScroll";
import SiteChrome from "../components/site/SiteChrome";
import { getCurrentClient } from "../lib/clientAuth";
import { getHomeIptvData } from "../components/iptv/homeData";
import { buildWatchPath } from "../lib/channelSlug";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "../lib/i18n/dictionaries";
import { getBaseUrl } from "../lib/siteUrl";

const baseUrl = getBaseUrl();
const buildVersion = String(process.env.NEXT_PUBLIC_BUILD_VERSION || "dev").trim() || "dev";
const ADSENSE_CLIENT = "ca-pub-3010934061489506";
const PUBLIC_LOCALE_COOKIE = "site_lang";
export const metadata = {
  title: "WEBTVBD || TV Beyond Borders",
  description: "WEBTVBD live streaming platform for channels, categories, and on-demand viewer access.",
  metadataBase: new URL(baseUrl),
  openGraph: {
    type: "website",
    url: baseUrl,
    title: "WEBTVBD || TV Beyond Borders",
    description: "Watch live channels on WEBTVBD.",
    images: [{ url: "/android-chrome-512x512.png", width: 512, height: 512, alt: "WEBTVBD" }],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const cookieLocale = String(cookieStore.get(PUBLIC_LOCALE_COOKIE)?.value || cookieStore.get("lang")?.value || "").trim().toLowerCase();
  const initialLocale = SUPPORTED_LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const currentClient = await getCurrentClient().catch(() => null);
  const approvalStatus = String(currentClient?.client?.approval_status || "").trim().toLowerCase();
  const hasApprovedClientSession = !!currentClient && approvalStatus === "approved";
  let viewerEntryHref = "/client-login";
  if (hasApprovedClientSession) {
    const homeData = await getHomeIptvData().catch(() => null);
    const firstChannel = Array.isArray(homeData?.channels) ? homeData.channels[0] : null;
    viewerEntryHref = firstChannel ? buildWatchPath(firstChannel) : "/client-login";
  }
  const themeInitScript = `
    (function () {
      try {
        var saved = localStorage.getItem("iptv:theme");
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        var useDark = saved ? saved === "dark" : true;
        if (!saved && prefersDark) useDark = true;
        if (useDark) document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
      } catch (_) {
        document.documentElement.classList.add("dark");
      }
    })();
  `;
  const pwaInstallBridgeScript = `
    (function () {
      try {
        var swUrl = "/sw.js?v=${encodeURIComponent(buildVersion)}";
        if ("serviceWorker" in navigator) {
          window.addEventListener("load", function () {
            navigator.serviceWorker.register(swUrl).catch(function () {});
          });
        }
        var ua = String(navigator.userAgent || "").toLowerCase();
        if (ua.indexOf("webtvbdapp") !== -1) return;
        var isAppLaunch = false;
        try {
          var params = new URL(window.location.href).searchParams;
          isAppLaunch = params.get("app") === "1";
        } catch (_) {}
        if (isAppLaunch) return;
        window.__pwaDeferredInstallPrompt = window.__pwaDeferredInstallPrompt || null;
        window.addEventListener("beforeinstallprompt", function (event) {
          event.preventDefault();
          window.__pwaDeferredInstallPrompt = event;
          window.dispatchEvent(new Event("pwa-install-available"));
        });
        window.addEventListener("appinstalled", function () {
          window.__pwaDeferredInstallPrompt = null;
        });
      } catch (_) {
        // no-op
      }
    })();
  `;

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <head>
        <meta name="google-adsense-account" content={ADSENSE_CLIENT} />
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: pwaInstallBridgeScript }} />
      </head>
      <body>
        <LanguageProvider initialLocale={initialLocale}>
          <PublicSmoothScroll hasClientSession={hasApprovedClientSession} />
          <SiteChrome hasClientSession={hasApprovedClientSession} viewerEntryHref={viewerEntryHref}>
            {children}
          </SiteChrome>
        </LanguageProvider>
        <Script id="statcounter-config" strategy="afterInteractive">
          {`
            window.sc_project = 12383019;
            window.sc_invisible = 1;
            window.sc_security = "596c1a94";
          `}
        </Script>
        <Script
          id="statcounter-loader"
          src="https://www.statcounter.com/counter/counter.js"
          strategy="afterInteractive"
        />
        <noscript>
          <div className="statcounter">
            <a title="site stats" href="https://statcounter.com/" target="_blank" rel="noreferrer">
              <img
                className="statcounter"
                src="https://c.statcounter.com/12383019/0/596c1a94/1/"
                alt="site stats"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </a>
          </div>
        </noscript>
        <a
          href="https://statcounter.com/p12383019/?guest=1"
          target="_blank"
          rel="noreferrer"
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
        >
          View My Stats
        </a>
      </body>
    </html>
  );
}
