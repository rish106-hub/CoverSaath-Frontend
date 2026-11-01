"use client";

import Link from "next/link";
import { SubHeading } from "@/components/type";
import { BackendDown } from "./BackendDown";
import { useMe } from "./useMe";
import styles from "./FamilyOwner.module.css";

/** Owner card on /family, read from the backend. Other members are mock (backend gap). */
export function FamilyOwner() {
  const { state, retry } = useMe();
  if (state.status === "down") return <BackendDown onRetry={retry} />;
  if (state.status === "loading") return <div className={styles.card} aria-busy="true"><span className={styles.sub}>Loading…</span></div>;
  if (state.status === "signed-out") return <div className={styles.card}><SubHeading>Not signed in</SubHeading><Link href="/" className={styles.sub}>Get access</Link></div>;
  const { me } = state;
  return (
    <div className={styles.card} data-testid="owner-card">
      <span className={styles.avatar} aria-hidden>{me.owner.displayName.charAt(0).toUpperCase()}</span>
      <div>
        <SubHeading>{me.owner.displayName}</SubHeading>
        <div className={styles.sub}>Owner · {me.householdName}</div>
      </div>
    </div>
  );
}
