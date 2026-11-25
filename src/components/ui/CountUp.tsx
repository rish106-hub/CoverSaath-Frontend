"use client";

// Number that counts up once to its final value. Exists so a key figure gets one calm moment of motion
// and always ends on the exact formatted value.
import { animate } from "motion/react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import styles from "./tiles.module.css";

export function CountUp({ to, format, ms = 900 }: { to: number; format: (n: number) => string; ms?: number }) {
  const reduce = useReducedMotion();
  const [current, setCurrent] = useState<number>(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, to, { duration: ms / 1000, ease: [0.16, 1, 0.3, 1], onUpdate: setCurrent, onComplete: () => setCurrent(to) });
    return () => controls.stop();
  }, [to, ms, reduce]);
  return <span className={styles.countUp}>{format(reduce ? to : current)}</span>;
}
