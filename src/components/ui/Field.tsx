// Field: labelled form control with an inline error that is announced to screen readers (spec R1.4).
import type { ReactNode } from "react";
import s from "./kv.module.css";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className={s.field} data-invalid={error ? "" : undefined}>
      <span className={s.fieldLabel}>{label}</span>
      {children}
      {error && <span className={s.fieldError} role="alert">{error}</span>}
    </label>
  );
}
