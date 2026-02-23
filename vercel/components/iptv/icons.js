"use client";

import React from "react";

const paths = {
  Menu: "M4 6h16M4 12h16M4 18h16",
  Grid3x3: "M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z",
  Bell: "M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.42L4 17h5m3 0a3 3 0 0 1-6 0",
  Moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z",
  Sun: "M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.41 1.41M7.05 16.95l-1.41 1.41m0-12.72 1.41 1.41m10.31 10.31 1.41 1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  User: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  Search: "m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4z",
  Heart: "m12 21-1.6-1.5C5 14.6 2 11.8 2 8.4A4.4 4.4 0 0 1 6.4 4C8 4 9.5 4.8 10.4 6.1L12 8l1.6-1.9A4.4 4.4 0 0 1 17.6 4 4.4 4.4 0 0 1 22 8.4c0 3.4-3 6.2-8.4 11.1z",
  Clock: "M12 7v5l3 3M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  Newspaper: "M4 5h12a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5zm4 4h6M8 13h6M8 17h4",
  Trophy: "M8 21h8M12 17v4M8 4h8v4a4 4 0 0 1-8 0V4zm-4 1h4v2a3 3 0 0 1-3 3H4V5zm16 0h-4v2a3 3 0 0 0 3 3h1V5z",
  Film: "M3 5h18v14H3V5zm4 0v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4",
  Sparkles: "m12 3 1.6 3.6L17 8l-3.4 1.4L12 13l-1.6-3.6L7 8l3.4-1.4L12 3zm-6 9 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zm12 0 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z",
  Baby: "M12 2a2 2 0 0 1 2 2v1h1a3 3 0 1 1 0 6h-1v1h1a3 3 0 0 1 0 6h-1v1a2 2 0 1 1-4 0v-1H9a3 3 0 0 1 0-6h1v-1H9a3 3 0 1 1 0-6h1V4a2 2 0 0 1 2-2z",
  Music: "M9 18V6l11-2v12M9 10l11-2M6 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm11-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  BookOpen: "M3 5a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3V5zm18 0a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3V5z",
  Church: "M12 3v6m0-6 3 3m-3-3-3 3M6 10h12v11H6V10zm3 11v-5h6v5",
  Globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0c2.8 0 5 4.5 5 10s-2.2 10-5 10-5-4.5-5-10 2.2-10 5-10zm-9 10h18",
  Earth: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-8 8h16m-9 10c1.5-2 2.5-5 2.5-8S12.5 6 11 4",
  MonitorPlay: "M3 5h18v12H3V5zm9 15v-3m-4 3h8m-6-11 4 2-4 2V9z",
  Radio: "M4 10h16v10H4V10zm3-4h13M9 3l-2 3m8 7h3m-6 0h1m-6 0h1",
  X: "M6 6l12 12M18 6 6 18",
  Play: "M8 5v14l11-7z",
  Pause: "M8 5h3v14H8zm5 0h3v14h-3z",
  Square: "M6 6h12v12H6z",
  Volume2: "M11 5 6 9H3v6h3l5 4V5zm4 3a5 5 0 0 1 0 8m2-11a8 8 0 0 1 0 14",
  VolumeX: "M11 5 6 9H3v6h3l5 4V5zm5 4 4 4m0-4-4 4",
  Maximize2: "M15 3h6v6M9 21H3v-6M21 9V3h-6M3 15v6h6",
  ChevronLeft: "m15 18-6-6 6-6",
  ChevronRight: "m9 18 6-6-6-6",
  Settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.7 4a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.06-.33.1-.66.1-1z",
  LoaderCircle: "M12 2a10 10 0 1 0 10 10",
};

export function Icon({ name, size = 20, className = "", fill = "none", stroke = "currentColor", strokeWidth = 2 }) {
  const path = paths[name] || paths.Search;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
