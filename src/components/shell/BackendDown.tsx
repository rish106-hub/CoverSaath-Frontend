"use client";

import styles from "./BackendDown.module.css";

/** Calm state for when the backend cannot be reached. */
export function BackendDown({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className={styles.box} role="status">
      <h3 className={styles.h}>Can’t reach Knowvia right now</h3>
      <p className={styles.p}>Your information is safe. Try again in a moment.</p>
      {onRetry ? <button type="button" className={styles.btn} onClick={onRetry}>Try again</button> : null}
    </div>
  );
}
