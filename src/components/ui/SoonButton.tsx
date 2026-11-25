// Inert "Soon" control for features that are not live yet. Shown instead of a working-looking button so the screen never implies a feature that does not exist.
import type { ReactNode } from "react";

export function SoonButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button type="button" className={`k-btn ${className}`.trim()} aria-disabled="true" title="Coming soon" onClick={(e) => e.preventDefault()}>
      {children}<span className="k-soon">Soon</span>
    </button>
  );
}
