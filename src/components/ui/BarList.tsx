// Label / track / value rows for comparing amounts. Exists so every bars panel uses the same 80px / 1fr / 70px layout.
import styles from "./tiles.module.css";

export type BarRow = { label: string; pct: number; value: string; tone?: string };

const FILL: Record<string, string> = { ink: styles.fillInk, marker: styles.fillMarker, signal: styles.fillSignal };

export function BarList({ rows }: { rows: BarRow[] }) {
  return (
    <div className={styles.bars} role="list">
      {rows.map((r, rowIndex) => {
        const pct = Math.max(0, Math.min(100, Number.isFinite(r.pct) ? r.pct : 0));
        return (
          <div key={r.label} className={styles.bar} role="listitem" data-testid="bar-row">
            <span className={styles.barLabel}>{r.label}</span>
            <span className={styles.barTrack}>
              <span className={`${styles.barFill} ${(r.tone && FILL[r.tone]) || ""}`.trim()} style={{ width: `${pct}%`, "--bar-index": rowIndex } as React.CSSProperties} />
            </span>
            <span className={styles.barValue}>{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}
