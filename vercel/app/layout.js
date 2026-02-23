import "./globals.css";

export const metadata = {
  title: "M3U Live Playlist API",
  description: "Vercel API for public M3U playlist URLs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
