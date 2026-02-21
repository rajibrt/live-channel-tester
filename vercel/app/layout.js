export const metadata = {
  title: "M3U Live Playlist API",
  description: "Vercel API for public M3U playlist URLs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 24, fontFamily: '"Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
