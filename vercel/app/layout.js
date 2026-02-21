export const metadata = {
  title: "M3U Live Playlist API",
  description: "Vercel API for public M3U playlist URLs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 24 }}>
        {children}
      </body>
    </html>
  );
}
