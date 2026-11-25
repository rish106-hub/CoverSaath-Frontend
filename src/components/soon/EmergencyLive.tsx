"use client";

// Live emergency actions: two phone numbers and the network hospital finder.
// Exists so someone in a hospital corridor gets a number to call instantly, with no signed-in-state gating and no motion.
import Link from "next/link";
import { BentoGrid } from "@/components/ui";
import styles from "./soon.module.css";

export function EmergencyLive() {
  return (
    <div className={styles.live} data-testid="emergency-live">
      <BentoGrid cols={3}>
        <a className={`${styles.action} ${styles.call}`} href="tel:112">Call 112</a>
        <a className={`${styles.action} ${styles.call}`} href="tel:108">Call 108 (ambulance)</a>
        <Link className={`${styles.action} ${styles.find}`} href="/hospitals">Find network hospitals</Link>
      </BentoGrid>
    </div>
  );
}
