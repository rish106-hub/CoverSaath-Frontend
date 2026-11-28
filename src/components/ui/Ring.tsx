// Ring: circular progress with its label in the centre; colour follows the signal kind (spec R1.4).
import s from "./kv.module.css";
import type { SignalKind } from "./Signal";

const SIZE = 112;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Ring({ value, label, kind }: { value: number; label: string; kind?: SignalKind }) {
  const percent = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const resolvedKind: SignalKind = kind ?? (percent === 100 ? "ok" : "warn");
  return (
    <span className={s.ring} data-kind={resolvedKind}>
      <svg className={s.ringSvg} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
        <circle className={s.ringTrack} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} />
        <circle
          className={s.ringFill} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <text className={s.ringText} x="50%" y="50%" textAnchor="middle" dominantBaseline="central">{label}</text>
      </svg>
    </span>
  );
}
