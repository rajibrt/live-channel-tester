import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "WEBTV BD || TV Beyond Borders",
  description: "WEBTV BD streaming platform",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }) {
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

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
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
