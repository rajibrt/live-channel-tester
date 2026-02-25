import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
