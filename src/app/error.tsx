"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/shell/ErrorPanel";

/** Catches errors on public pages (landing, sign-in, welcome, status). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("page error", error.digest ?? "");
  }, [error]);
  return <ErrorPanel onRetry={reset} home={false} />;
}
