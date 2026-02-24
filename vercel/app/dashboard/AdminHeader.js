"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./page.module.css";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/playlists", label: "Playlists" },
  { href: "/dashboard/channels", label: "Channels" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/local-check", label: "Local Check" },
];

export default function AdminHeader({ title, subtitle }) {
  const pathname = usePathname();

  return (
    <header className={styles.topBar}>
      <div>
        <p className={styles.kicker}>Admin Workspace</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className={styles.ghostBtn}>Logout</button>
      </form>
    </header>
  );
}
