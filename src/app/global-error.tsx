"use client";

import { useEffect } from "react";

/** Last resort when the root layout itself throws. Self-contained: no CSS modules, no providers. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("global error", error.digest ?? "");
  }, [error]);
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf8f4", color: "#1c1a17" }}>
        <div role="alert" style={{ maxWidth: 520, margin: "20vh auto", padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 16px", color: "#5b564e" }}>Your information is safe. Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 18px", border: 0, borderRadius: 10, background: "#1f4b4f", color: "#fff", font: "600 14px system-ui" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
