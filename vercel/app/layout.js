import "./globals.css";

export const metadata = {
  title: "M3U Live Playlist API",
  description: "Vercel API for public M3U playlist URLs",
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
