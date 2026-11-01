"use client";

import { useEffect, useState } from "react";
import { adapters } from "@/adapters";
import styles from "./UserChip.module.css";

/** Avatar and name, read back from the household adapter (backend when configured). */
export function UserChip() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    adapters.household.me().then((m) => live && setName(m?.owner.displayName ?? null)).catch(() => live && setName(null));
    return () => {
      live = false;
    };
  }, []);
  const initial = name ? name.charAt(0).toUpperCase() : "·";
  return (
    <div className={styles.chip}>
      <span className={styles.avatar} aria-hidden>{initial}</span>
      <span className={styles.name}>{name ?? "Your account"}</span>
    </div>
  );
}
