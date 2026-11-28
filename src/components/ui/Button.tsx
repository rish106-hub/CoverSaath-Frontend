"use client";
// Button: the single filled main action (primary) or outlined/quiet secondary action, with busy and done feedback.
// The spinner is delayed 250ms so fast actions do not flash it (spec R1.4).
import { useEffect, useState, type ButtonHTMLAttributes } from "react";
import s from "./kv.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "quiet";
  size?: "md" | "lg";
  state?: "idle" | "busy" | "done";
  busyLabel?: string;
  doneLabel?: string;
  arrow?: boolean;
}

export function Button({ variant = "primary", size = "md", state = "idle", busyLabel, doneLabel, arrow, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  const [spinnerVisible, setSpinnerVisible] = useState(false);
  useEffect(() => {
    if (state !== "busy") return;
    const timer = setTimeout(() => setSpinnerVisible(true), 250);
    // Reset in cleanup so a later busy period starts hidden again.
    return () => { clearTimeout(timer); setSpinnerVisible(false); };
  }, [state]);

  const busy = state === "busy";
  const done = state === "done";
  const classes = [s.button, s.pressable, s.focusable, s[variant], size === "lg" ? s.lg : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button {...rest} type={type} className={classes} disabled={disabled || busy || done} aria-busy={busy ? "true" : undefined}>
      {busy && spinnerVisible && <span className={s.spinner} data-spinner="" aria-hidden="true" />}
      {done && (
        <svg className={s.tick} data-tick="" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 10.5l4 4 8-9" />
        </svg>
      )}
      <span>{busy ? (busyLabel ?? children) : done ? (doneLabel ?? children) : children}</span>
      {arrow && !busy && !done && <span aria-hidden="true">→</span>}
    </button>
  );
}
