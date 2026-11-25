// Honest placeholder control for features that are not built yet.
// Exists so no button lies: it looks like a normal button, says "Soon", and does nothing on click.
import type { ReactNode } from "react";

export function SoonButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={`k-btn ${className}`.trim()}
      aria-disabled="true"
      title="Coming soon"
      onClick={(e) => e.preventDefault()}
    >
      {children}
      <span className="k-soon">Soon</span>
    </button>
  );
}
