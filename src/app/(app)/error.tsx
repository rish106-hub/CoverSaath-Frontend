"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/shell/ErrorPanel";

/** Catches a throwing page inside the app shell, so the sidebar and header stay. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("page error", error.digest ?? "");
  }, [error]);
  return <ErrorPanel onRetry={reset} />;
}
