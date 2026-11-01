"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GROUPS, pageFor, pagesIn } from "@/lib/ia";
import { readingList } from "@/data/mock/learn";
import { BrandMark } from "@/components/brand/BrandMark";
import { UserChip } from "./UserChip";
import styles from "./AppSidebar.module.css";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Left sidebar pinned on every app page. Below 960px it becomes a top bar with a menu button
 * that opens the same sidebar as a drawer. The "Today" and "Reading list" blocks only show on /home.
 */
export function AppSidebar({ pathname = "/home" }: { pathname?: string }) {
  // Open for one pathname only, so a route change closes the drawer without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const asideRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const page = pageFor(pathname);
  const home = page?.route === "/home";

  const close = useCallback(() => {
    setOpenAt(null);
    menuRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const aside = asideRef.current;
    aside?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !aside) return;
      const items = Array.from(aside.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !aside.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !aside.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <div className={styles.topbar}>
        <button ref={menuRef} type="button" className={styles.menu} aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpenAt(pathname)}>
          Menu
        </button>
        <BrandMark size={28} />
      </div>
      {open ? <div className={styles.scrim} onClick={close} aria-hidden data-testid="sidebar-scrim" /> : null}
      <aside id="app-sidebar" ref={asideRef} className={`${styles.aside} ${open ? styles.open : ""}`} aria-label="Knowvia">
        <div className={styles.head}>
          <span className={styles.brand}><BrandMark size={32} /></span>
          <button type="button" className={styles.close} onClick={close}>Close</button>
        </div>
        <nav className={styles.groups} aria-label="Knowvia sections">
          {GROUPS.map((g) => (
            <div key={g.id} className={styles.group}>
              <span className={styles.gname}>
                <i style={{ background: g.color }} aria-hidden />
                {g.label}
              </span>
              {pagesIn(g.id)
                .filter((p) => p.route !== "/emergency")
                .map((p) => {
                  const on = page?.group === g.id && page.tab === p.tab;
                  return (
                    <Link key={p.route} href={p.href} className={on ? styles.on : styles.item} aria-current={on ? "page" : undefined}>
                      {p.tab}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <Link href="/emergency" className={styles.emergency} aria-current={page?.route === "/emergency" ? "page" : undefined}>
          <span aria-hidden>●</span> Emergency
        </Link>
        {home ? (
          <>
            <hr className={styles.rule} />
            <div className={styles.block}>
              <div className={styles.label}>Today</div>
              <div className={styles.text}>Father’s senior plan renews in <b>132 days</b>.</div>
              <Link href="/compare" className={styles.link}>Review it →</Link>
            </div>
            <hr className={styles.rule} />
            <div className={styles.block}>
              <div className={styles.label}>Reading list</div>
              {readingList.map((r) => (
                <Link key={r.title} href="/home" className={styles.read}>
                  <span>{r.title}</span>
                  <span className={styles.meta}>{r.minutes} min</span>
                </Link>
              ))}
            </div>
          </>
        ) : null}
        <UserChip />
      </aside>
    </>
  );
}
