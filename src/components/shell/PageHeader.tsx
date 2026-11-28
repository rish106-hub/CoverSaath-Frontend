"use client";

import Link from "next/link";
import { railFor } from "@/lib/ia";
import styles from "./PageHeader.module.css";

/** Sub-tabs of the current rail place (for example Compare under My policies). Renders nothing for places without tabs and for pages outside the rail. */
export function PageHeader({ pathname }: { pathname: string }) {
  const place = railFor(pathname);
  if (!place || place.tabs.length === 0) return null;
  const clean = pathname.replace(/\/+$/, "");
  // Policy detail paths sit under "All policies"; add-a-policy paths match no tab, so none is current there.
  const current = clean.startsWith("/policies/") ? "/policies" : clean;
  return (
    <nav className={styles.tabs} aria-label={place.label} data-testid="page-subtabs">
      {place.tabs.map((t) => {
        const on = t.route === current;
        return (
          <Link key={t.route} href={t.route} className={on ? styles.on : styles.tab} aria-current={on ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
