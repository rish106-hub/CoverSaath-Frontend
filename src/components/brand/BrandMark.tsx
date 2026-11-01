import Link from "next/link";
import styles from "./BrandMark.module.css";

/** The Knowvia K mark plus wordmark, as one link. `compact` shows the mark only. */
export function BrandMark({ href = "/home", size = 32, compact = false, className = "" }: { href?: string; size?: number; compact?: boolean; className?: string }) {
  return (
    <Link href={href} aria-label="Knowvia home" className={`${styles.brand} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/knowvia-mark.svg" alt="" width={size} height={size} className={styles.mark} />
      {compact ? null : <span className={styles.word}>Knowvia</span>}
    </Link>
  );
}
