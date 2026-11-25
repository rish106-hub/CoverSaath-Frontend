// Tile shown when one fact failed to load. Exists so a single failure stays local and offers a retry.
import styles from "./tiles.module.css";

export function RetryTile({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className={`${styles.tile} ${styles.plain}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.caption}>Couldn&apos;t load</span>
      <button type="button" className="k-btn k-btn--sm k-btn--secondary" onClick={onRetry}>Try again</button>
    </div>
  );
}
