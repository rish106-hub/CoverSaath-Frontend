"use client";

import { useSyncExternalStore } from "react";
import { returnPathFromSearch } from "@/lib/return-path";

/** The validated `?next=` path on the current URL, or null. Never logged or sent to analytics. */
export function useReturnPath(): string | null {
  return useSyncExternalStore(() => () => {}, () => returnPathFromSearch(window.location.search), () => null);
}
