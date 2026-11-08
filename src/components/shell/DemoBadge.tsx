"use client";

import { useState, useSyncExternalStore } from "react";
import { adapters } from "@/adapters";
import { isDemoSession } from "@/adapters/demo";
import { invalidateMe } from "./useMe";
import styles from "./DemoBadge.module.css";

/** Shown only in a demo session: a small label and the way out. */
export function DemoBadge() {
  const demo = useSyncExternalStore(() => () => {}, isDemoSession, () => false);
  const [busy, setBusy] = useState(false);
  if (!demo) return null;
  const out = async () => {
    setBusy(true);
    try {
      await adapters.access.signOut();
    } catch {
      setBusy(false);
      return;
    }
    invalidateMe();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose
    window.location.href = "/"; // full reload: drops the in-memory mock state
  };
  return (
    <div className={styles.badge}>
      <span className={styles.label}>Demo account</span>
      <button type="button" className={styles.out} onClick={out} disabled={busy}>Sign out</button>
    </div>
  );
}
