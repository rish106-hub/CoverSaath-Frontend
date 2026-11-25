"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./ErrorPanel.module.css";

/** Calm fallback shown inside the page area. Never prints the error text; that stays in the console and server log. */
export function ErrorPanel({ onRetry, title = "This didn't load", home = true }: { onRetry?: () => void; title?: string; home?: boolean }) {
  return (
    <div className={styles.box} role="alert">
      <h2 className={styles.h}>{title}</h2>
      <p className={styles.p}>Your information is safe. Try again in a moment.</p>
      <div className={styles.row}>
        {onRetry ? <button type="button" className={styles.btn} onClick={onRetry}>Try again</button> : null}
        {home ? <Link href="/home" className={styles.link}>Go to home</Link> : null}
      </div>
    </div>
  );
}

/** Sized placeholder so the layout does not jump while a page or a lazy piece loads. */
export function PageSkeleton({ height = 220 }: { height?: number }) {
  void height; // kept so existing callers compile; the shared skeleton has fixed block sizes.
  return <Skeleton shape="bento" />;
}
