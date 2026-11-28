"use client";
// Segmented: small exclusive choice control built from toggle buttons (spec R1.4).
import s from "./kv.module.css";

export function Segmented({ options, value, onChange, label }: { options: string[]; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <div className={s.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option} type="button" className={`${s.segment} ${s.pressable} ${s.focusable}`} aria-pressed={option === value} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}
