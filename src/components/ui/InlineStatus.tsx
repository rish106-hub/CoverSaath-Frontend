// InlineStatus: always-mounted live region so screen readers announce later changes (spec R1.4).
import type { ReactNode } from "react";
import s from "./kv.module.css";

export function InlineStatus({ kind, children }: { kind: "idle" | "busy" | "ok" | "error"; children?: ReactNode }) {
  return (
    <div className={s.status} data-kind={kind} role={kind === "error" ? "alert" : "status"}>
      {kind === "ok" && (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 10.5l4 4 8-9" />
        </svg>
      )}
      {children}
    </div>
  );
}
