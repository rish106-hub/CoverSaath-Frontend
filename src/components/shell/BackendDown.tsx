"use client";

import styles from "./BackendDown.module.css";

/** Calm state for when the backend cannot be reached. */
export function BackendDown({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className={styles.box} role="status">
      <h2 className={styles.h}>Knowvia is not answering.</h2>
      <p className={styles.p}>This page will load when the service is back.</p>
      {onRetry ? <button type="button" className={styles.btn} onClick={onRetry}>Try again</button> : null}
    </div>
  );
}
