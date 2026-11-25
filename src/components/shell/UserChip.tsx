"use client";

import Link from "next/link";
import { DemoBadge } from "./DemoBadge";
import { useMe } from "./useMe";
import { ShimmerBlock } from "@/components/ui/Skeleton";
import styles from "./UserChip.module.css";

/** Avatar and name, read from the shared useMe store so the chip and page heading agree and never swap text. */
export function UserChip() {
  const { state } = useMe();
  const name = state.status === "ready" ? state.me.owner.displayName : null;
  if (state.status === "loading") {
    return (
      <>
        <Link href="/profile" className={styles.chip} aria-label="Your profile">
          <ShimmerBlock style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
          <ShimmerBlock style={{ width: 80, height: 14 }} />
        </Link>
        <DemoBadge />
      </>
    );
  }
  const initial = name ? name.charAt(0).toUpperCase() : "·";
  return (
    <>
      <Link href="/profile" className={styles.chip} aria-label={`Your profile${name ? `, ${name}` : ""}`}>
        <span className={styles.avatar} aria-hidden>{initial}</span>
        <span className={styles.name}>{name ?? "Profile"}</span>
      </Link>
      <DemoBadge />
    </>
  );
}
