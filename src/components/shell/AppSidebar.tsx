"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GROUPS, pageFor, pagesIn, type GroupId } from "@/lib/ia";
import { DemoGate } from "./EmptyState";
import { readingList } from "@/data/mock/learn";
import { BrandMark } from "@/components/brand/BrandMark";
import { UserChip } from "./UserChip";
import styles from "./AppSidebar.module.css";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const NAV_CLOSED_KEY = "knowvia.nav.closed";

function readClosed(): GroupId[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(NAV_CLOSED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is GroupId => GROUPS.some((g) => g.id === x)) : [];
  } catch {
    return [];
  }
}

/** Small shape per group, so the group never relies on colour alone (the label is always there too). */
function GroupIcon({ id }: { id: GroupId }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true, focusable: false } as const;
  if (id === "cover") return <svg {...common}><path d="M8 1.8 13.2 3.7v4c0 3-2.1 5.2-5.2 6.5C4.9 12.900 2.800 10.700 2.800 7.700v-4z" /></svg>;
  if (id === "family") return <svg {...common}><circle cx="5.500" cy="5" r="2" /><circle cx="11" cy="6" r="1.600" /><path d="M2 13c0-2.200 1.600-3.600 3.500-3.600S9 10.800 9 13M9.500 12.500c0-1.500 0.800-2.600 2.200-2.600S14 11 14 12.500" /></svg>;
  if (id === "money") return <svg {...common}><circle cx="8" cy="8" r="6" /><path d="M8 4.500v7M10 6.200C9.600 5.600 8.900 5.400 8 5.400c-1.100 0-1.900.5-1.900 1.300 0 .9.800 1.200 1.900 1.400 1.100.2 1.900.5 1.900 1.400 0 .8-.8 1.300-1.900 1.300-1 0-1.700-.3-2.100-.9" /></svg>;
  return <svg {...common}><circle cx="8" cy="8" r="6" /><path d="M6.200 6.200C6.300 5.100 7 4.600 8 4.600c1 0 1.800.6 1.800 1.600 0 1.500-1.800 1.500-1.800 3M8 11.200v.1" /></svg>;
}

/**
 * Left sidebar pinned on every app page. Between 960 and 1199px it is an icon rail (labels move to tooltips). Below 960px it becomes a top bar with a menu button
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
  // Closed groups are remembered per viewer. Read after mount so server and client markup match.
  const [closed, setClosed] = useState<GroupId[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable on the client, after hydration
  useEffect(() => { setClosed(readClosed()); }, []);
  const toggle = useCallback((id: GroupId) => {
    setClosed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { window.localStorage.setItem(NAV_CLOSED_KEY, JSON.stringify(next)); } catch { /* storage blocked: stays in memory */ }
      return next;
    });
  }, []);

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
          {GROUPS.map((g) => {
            const here = page?.group === g.id;
            const expanded = here || !closed.includes(g.id);
            return (
              <div key={g.id} className={styles.group} data-group={g.id}>
                <button
                  type="button"
                  className={styles.gbtn}
                  aria-expanded={expanded}
                  aria-controls={`nav-group-${g.id}`}
                  aria-disabled={here ? true : undefined}
                  data-tip={g.label}
                  onClick={() => { if (!here) toggle(g.id); }}
                >
                  <span className={styles.gicon}><GroupIcon id={g.id} /></span>
                  <span className={styles.label}>{g.label}</span>
                  <span className={styles.chev} aria-hidden />
                </button>
                <div id={`nav-group-${g.id}`} className={styles.links} hidden={!expanded}>
                  {pagesIn(g.id)
                    .filter((p) => p.route !== "/emergency")
                    .map((p) => {
                      const on = here && page.tab === p.tab;
                      return (
                        <Link key={p.route} href={p.href} className={on ? styles.on : styles.item} aria-current={on ? "page" : undefined} data-tip={p.tab} data-glyph={p.tab.charAt(0)}>
                          <span className={styles.label}>{p.tab}</span>
                        </Link>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </nav>
        <Link href="/emergency" className={styles.emergency} aria-current={page?.route === "/emergency" ? "page" : undefined} data-tip="Emergency">
          <span aria-hidden>●</span> <span className={styles.label}>Emergency</span>
        </Link>
        {home ? (
          <DemoGate empty={null}>
            <hr className={`${styles.rule} ${styles.extra}`} />
            <div className={`${styles.block} ${styles.extra}`}>
              <div className={styles.blabel}>Today</div>
              <div className={styles.text}>Father’s senior plan renews in <b>132 days</b>.</div>
              <Link href="/compare" className={styles.link}>Review it →</Link>
            </div>
            <hr className={`${styles.rule} ${styles.extra}`} />
            <div className={`${styles.block} ${styles.extra}`}>
              <div className={styles.blabel}>Reading list</div>
              {readingList.map((r) => (
                <Link key={r.title} href="/home" className={styles.read}>
                  <span>{r.title}</span>
                  <span className={styles.meta}>{r.minutes} min</span>
                </Link>
              ))}
            </div>
          </DemoGate>
        ) : null}
        <UserChip />
      </aside>
    </>
  );
}
