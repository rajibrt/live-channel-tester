"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Activity, CircleUserRound, LayoutDashboard, ListVideo, MonitorPlay, Tv, Users } from "lucide-react";
import styles from "./dashboard-shell.module.css";

const NAV_GROUPS = [
  {
    label: "Main",
    items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Content",
    items: [
      { href: "/dashboard/playlists", label: "Playlists", icon: ListVideo },
      { href: "/dashboard/channels", label: "Add New Channel", icon: Tv },
    ],
  },
  {
    label: "Operations",
    items: [{ href: "/dashboard/local-check", label: "Local Check", icon: Activity }],
  },
  {
    label: "Access",
    items: [{ href: "/dashboard/clients", label: "Clients", icon: Users }],
  },
];

function sectionMeta(pathname) {
  if (!pathname) return { title: "Overview", subtitle: "Admin control center" };
  if (pathname === "/dashboard") return { title: "Overview", subtitle: "Admin control center" };
  if (pathname.startsWith("/dashboard/playlists/")) {
    const slug = pathname.split("/").filter(Boolean).at(-1) || "playlist";
    return { title: "Playlist Editor", subtitle: `Editing: ${slug}` };
  }
  if (pathname.startsWith("/dashboard/playlists")) {
    return { title: "Playlists", subtitle: "Manage playlists and public token links" };
  }
  if (pathname.startsWith("/dashboard/channels")) {
    return { title: "Add New Channel", subtitle: "Manage channel metadata and assignments" };
  }
  if (pathname.startsWith("/dashboard/local-check")) {
    return { title: "Local Check", subtitle: "Run route-aware stream health verification" };
  }
  if (pathname.startsWith("/dashboard/clients")) {
    return { title: "Client Users", subtitle: "Create and control viewer login accounts" };
  }
  return { title: "Dashboard", subtitle: "Admin workspace" };
}

export default function DashboardShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = useMemo(() => sectionMeta(pathname), [pathname]);

  const isActive = (href) => {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className={styles.page}>
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarTop}>
          <div className={styles.brandMark}>IP</div>
          <div>
            <p className={styles.brandKicker}>Admin Workspace</p>
            <h1 className={styles.brandTitle}>StreamTV</h1>
          </div>
        </div>

        <nav className={styles.navWrap}>
          {NAV_GROUPS.map((group) => (
            <section key={group.label} className={styles.navGroup}>
              <p className={styles.groupLabel}>{group.label}</p>
              <div className={styles.navList}>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <item.icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.viewerLink}>
            <MonitorPlay size={16} aria-hidden="true" />
            <span>Open Client View</span>
          </Link>
        </div>
      </aside>

      {mobileOpen ? <button className={styles.overlay} onClick={() => setMobileOpen(false)} aria-label="Close sidebar" /> : null}

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button type="button" className={styles.mobileMenuBtn} onClick={() => setMobileOpen((v) => !v)}>
              <CircleUserRound size={16} aria-hidden="true" />
              Menu
            </button>
            <p className={styles.headerKicker}>Dashboard</p>
            <h2 className={styles.headerTitle}>{meta.title}</h2>
            <p className={styles.headerSubtitle}>{meta.subtitle}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className={styles.logoutBtn}>Logout</button>
          </form>
        </header>

        <section className={styles.content}>{children}</section>
      </main>
    </div>
  );
}
