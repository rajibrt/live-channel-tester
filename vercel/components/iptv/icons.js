"use client";

import React from "react";
import {
  Baby,
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Church,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Film,
  Globe,
  Grid3X3,
  Heart,
  LoaderCircle,
  LogOut,
  Maximize2,
  Menu,
  MonitorPlay,
  Moon,
  Music,
  Newspaper,
  Pause,
  Play,
  Radio,
  Search,
  Settings,
  Sparkles,
  Square,
  Sun,
  Tags,
  Trophy,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const iconMap = {
  Menu,
  Grid3x3: Grid3X3,
  Bell,
  BellOff,
  BellRing,
  Moon,
  Sun,
  User,
  LogOut,
  Search,
  Heart,
  Clock: Clock3,
  Newspaper,
  Trophy,
  Film,
  Sparkles,
  Tags,
  Baby,
  Music,
  BookOpen,
  Church,
  Download,
  Globe,
  Earth: Globe,
  MonitorPlay,
  Radio,
  Eye,
  EyeOff,
  X,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Settings,
  LoaderCircle,
};

export function Icon({ name, size = 20, className = "", fill = "none", stroke = "currentColor", strokeWidth = 2 }) {
  const LucideIcon = iconMap[name] || Search;
  return (
    <LucideIcon
      size={size}
      className={className}
      color={stroke}
      strokeWidth={strokeWidth}
      fill={fill}
      aria-hidden="true"
      focusable="false"
    />
  );
}
