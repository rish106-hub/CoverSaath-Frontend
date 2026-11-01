"use client";

import { useEffect } from "react";
import { isLowCapacity, readCapability } from "@/lib/capability";

/** Marks <html data-motion="reduced"> once on low-capacity devices so CSS animations drop to 1 ms. Renders nothing. */
export function CapabilityInit() {
  useEffect(() => {
    if (isLowCapacity(readCapability())) document.documentElement.setAttribute("data-motion", "reduced");
  }, []);
  return null;
}
