// 4px progress track with fill. Exists so tiles and bar lists show proportion the same way.
import styles from "./tiles.module.css";

export type MeterTone = "plain" | "ink" | "marker" | "signal" | "mist" | "ochre" | "violet" | "dark";

export function Meter({ value, tone = "plain" }: { value: number; tone?: MeterTone }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={`${styles.meter} ${tone === "plain" ? styles.meterPlain : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={styles.meterFill} style={{ width: `${pct}%` }} />
    </div>
  );
}
