"use client";

import { useEffect } from "react";

/**
 * Last resort when the root layout itself throws. Self-contained: no CSS modules, no providers, so
 * colours are literal copies of the light tokens (paper, ink, graphite, harbour, on-harbour); tests/app/global-error-colours.test.ts keeps them in sync. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("global error", error.digest ?? "");
  }, [error]);
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f5f0", color: "#16130f" }}>
        <div role="alert" style={{ maxWidth: 520, margin: "20vh auto", padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>This page did not load.</h1>
          <p style={{ margin: "0 0 16px", color: "#5f5a52" }}>Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 18px", border: 0, borderRadius: 10, background: "#0e4f4a", color: "#f7f5f0", font: "600 14px system-ui" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
