"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMe } from "./useMe";
import styles from "./EmptyState.module.css";

/** Where "Upload your policy" goes. One place, so the upload flow can move without touching every page. */
export const UPLOAD_HREF = "/covers/add";

/** An honest empty page: what is missing and the one next action. */
export function EmptyState({ title, body, cta = "Upload your policy", href = UPLOAD_HREF, children }: { title: string; body: string; cta?: string; href?: string; children?: ReactNode }) {
  return (
    <section className={styles.box} aria-label={title} data-testid="empty-state">
      <h2 className={styles.h}>{title}</h2>
      <p className={styles.p}>{body}</p>
      <Link href={href} className={styles.cta}>{cta}</Link>
      {children ? <div className={styles.extra}>{children}</div> : null}
    </section>
  );
}

/**
 * Shows `children` (demo or mock content) only to the demo session. Everyone else sees `empty` once we know who they are.
 * While the session is unknown nothing is shown, so demo content can never flash for a real account.
 */
export function DemoGate({ children, empty }: { children: ReactNode; empty: ReactNode }) {
  const { state } = useMe();
  if (state.status === "loading") return null;
  if (state.status === "ready" && state.me.source !== "backend") return <>{children}</>;
  return <>{empty}</>;
}
