"use client";

import Link from "next/link";
import styles from "./ErrorPanel.module.css";

/** Calm fallback shown inside the page area. Never prints the error text; that stays in the console and server log. */
export function ErrorPanel({ onRetry, title = "That did not load", home = true }: { onRetry?: () => void; title?: string; home?: boolean }) {
  return (
    <div className={styles.box} role="alert">
      <h2 className={styles.h}>{title}</h2>
      <p className={styles.p}>Your information is safe. Try again, and if it keeps happening, come back in a moment.</p>
      <div className={styles.row}>
        {onRetry ? <button type="button" className={styles.btn} onClick={onRetry}>Try again</button> : null}
        {home ? <Link href="/home" className={styles.link}>Go to home</Link> : null}
      </div>
    </div>
  );
}

/** Sized placeholder so the layout does not jump while a page or a lazy piece loads. */
export function PageSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className={styles.skel} aria-busy="true" aria-label="Loading">
      <div className={styles.bar} /><div className={styles.bar} /><div className={styles.bar} />
      <div className={styles.block} style={{ height }} />
    </div>
  );
}
