// Placeholder tile for a feature that is not built yet. Exists so the page stays honest and keeps its grid.
import styles from "./tiles.module.css";

export function SoonTile({ label, caption }: { label: string; caption?: string }) {
  return (
    <div className={`${styles.tile} ${styles.plain} ${styles.soon}`} aria-disabled="true" tabIndex={0} title="Coming soon">
      <span className={styles.soonBody}>
        <span className={styles.label}>
          <svg className={styles.clock} width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" />
            <path d="M8 4.5V8l2.25 1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {label}
        </span>
        {caption && <span className={styles.caption}>{caption}</span>}
      </span>
      <span className={styles.soonTag}>Coming soon</span>
    </div>
  );
}
