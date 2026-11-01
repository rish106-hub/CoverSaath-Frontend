"use client";

import { useSyncExternalStore } from "react";
import { isLowCapacity, readCapability } from "./capability";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** Plain (non-hook) check for event handlers: reduced-motion request or a low-capacity device. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const asked = typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
  return asked || isLowCapacity(readCapability());
}

/** True when the visitor asked for reduced motion or the device is low-capacity. False on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
