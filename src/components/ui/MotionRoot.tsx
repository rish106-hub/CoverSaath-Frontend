"use client";

// App-wide motion switch. Exists so every motion/react animation (CountUp, Reveal) honours the OS
// "reduce motion" setting from one place instead of each component checking it.
import { MotionConfig } from "motion/react";

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
