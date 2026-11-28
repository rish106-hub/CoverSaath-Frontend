"use client";
// Tabs: tab strip with Left and Right arrow navigation; ends wrap around (spec R1.4).
import type { KeyboardEvent } from "react";
import s from "./kv.module.css";

export function Tabs({ tabs, value, onChange, label }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void; label: string }) {
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0 || tabs.length === 0) return;
    event.preventDefault();
    onChange(tabs[(index + step + tabs.length) % tabs.length].id);
  }
  return (
    <div className={s.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button key={tab.id} type="button" role="tab" aria-selected={tab.id === value} tabIndex={tab.id === value ? 0 : -1} className={`${s.tab} ${s.pressable} ${s.focusable}`} onClick={() => onChange(tab.id)} onKeyDown={(event) => move(event, index)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
