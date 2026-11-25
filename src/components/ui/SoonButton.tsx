// Disabled-looking button for features that are not built yet. Exists so every page shows the same
// honest "Soon" state instead of a dead or hidden control.
import type { ReactNode } from "react";

export function SoonButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button type="button" className={`k-btn ${className}`.trim()} aria-disabled="true" title="Coming soon" onClick={(e) => e.preventDefault()}>
      {children}
      <span className="k-soon">Soon</span>
    </button>
  );
}
