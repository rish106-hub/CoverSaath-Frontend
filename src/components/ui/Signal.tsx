// Signal: coloured dot (or pill) that carries status meaning by colour, not by tag text.
// Presentation-only primitive of the flat redesign (spec R1.4).
import type { ReactNode } from "react";
import s from "./kv.module.css";

export type SignalKind = "ok" | "warn" | "orange" | "bad";

export function Signal({ kind, variant = "dot", children }: { kind: SignalKind; variant?: "dot" | "pill"; children: ReactNode }) {
  return (
    <span className={`${s.signal} ${variant === "pill" ? s.signalTag : ""}`.trim()} data-kind={kind}>
      <span className={s.dot} aria-hidden="true" />
      {children}
    </span>
  );
}
