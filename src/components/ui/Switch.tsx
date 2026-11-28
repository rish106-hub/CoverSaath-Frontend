"use client";
// Switch: on/off setting exposed as role="switch" and named by its label (spec R1.4).
import s from "./kv.module.css";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`${s.switch} ${s.pressable} ${s.focusable}`} onClick={() => onChange(!checked)}>
      <span className={s.switchKnob} aria-hidden="true" />
    </button>
  );
}
