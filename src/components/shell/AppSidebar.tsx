"use client";

import Link from "next/link";
import { PAGES, RAIL, navHref, pageFor, railFor, type PageDef } from "@/lib/ia";
import { useNavAudience } from "./EmptyState";
import { BrandMark } from "@/components/brand/BrandMark";
import { UserChip } from "./UserChip";
import styles from "./AppSidebar.module.css";

/** Kept exported for the older stored preference; the rail no longer has collapsible groups, so nothing reads it. */
export const NAV_CLOSED_KEY = "knowvia.nav.closed";

/**
 * Left rail pinned on every app page: brand, the one main action (Add a policy), the five places,
 * then Emergency, Settings and the signed-in person. Laptop and desktop only; under 1024px the shell is replaced by the viewport gate.
 */
export function AppSidebar({ pathname = "/home" }: { pathname?: string }) {
  const audience = useNavAudience();
  const place = railFor(pathname);
  const page = pageFor(pathname);
  const clean = pathname.replace(/\/+$/, "");
  const emergencyHref = navHref(PAGES.find((p) => p.route === "/emergency") as PageDef, audience);
  return (
    <aside id="app-sidebar" className={styles.aside} aria-label="Knowvia">
      <span className={styles.brand}><BrandMark size={32} /></span>
      <Link href="/covers/add" className={styles.add} data-testid="rail-add">Add a policy</Link>
      <nav className={styles.nav} aria-label="Knowvia sections">
        {RAIL.map((p) => {
          const on = place?.id === p.id;
          return (
            <Link key={p.id} href={p.href} className={on ? styles.on : styles.item} aria-current={on ? "page" : undefined}>
              {p.label}
            </Link>
          );
        })}
      </nav>
      <div className={styles.bottom}>
        <Link href={emergencyHref} className={styles.emergency} aria-current={page?.route === "/emergency" ? "page" : undefined}>Emergency</Link>
        <Link href="/settings" className={styles.settings} aria-current={clean === "/settings" ? "page" : undefined}>Settings</Link>
        <UserChip />
      </div>
    </aside>
  );
}
