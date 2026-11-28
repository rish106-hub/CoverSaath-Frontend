// Bar: horizontal progress meter; the fill animates with transform: scaleX only (spec R1.4).
import s from "./kv.module.css";
import type { SignalKind } from "./Signal";

export function Bar({ value, kind = "ok", label }: { value: number; kind?: SignalKind; label: string }) {
  const fraction = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return (
    <div className={s.bar} data-kind={kind} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-label={label}>
      <div className={s.barFill} style={{ transform: `scaleX(${fraction})` }} />
    </div>
  );
}
