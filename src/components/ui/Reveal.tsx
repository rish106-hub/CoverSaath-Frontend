"use client";

// Entrance for an item the user just created. Exists so a new card settles in instead of popping;
// not for page load (the app has no load motion).
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export function Reveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div>{children}</div>;
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.76, ease: [0.25, 1, 0.5, 1] }}>
      {children}
    </motion.div>
  );
}
