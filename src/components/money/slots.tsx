"use client";

import { useState } from "react";
import { adapters, type NotifyChannel } from "@/adapters";
import { BrandLogo, type BrandId } from "@/components/logos/BrandLogo";
import styles from "./money.module.css";

export type RemindItem = { channel: NotifyChannel; label: string; logo: BrandId };

export const RENEWAL_REMINDERS: RemindItem[] = [
  { channel: "google-calendar", label: "Google Calendar", logo: "google-calendar" },
  { channel: "apple-calendar", label: "Apple Calendar", logo: "apple" },
  { channel: "whatsapp", label: "WhatsApp reminder", logo: "whatsapp" },
];

/**
 * Slot for the shared RemindRow (BUILD-SPEC 5.3). W6 swaps this export for the shared component;
 * the props (label, items, subject) are the contract.
 */
export function RemindRowSlot({ label, items = RENEWAL_REMINDERS, subject }: { label: string; items?: RemindItem[]; subject: string }) {
  const [msg, setMsg] = useState("");
  async function go(i: RemindItem) {
    try {
      const res = await adapters.notify.send(i.channel, subject);
      setMsg(res.message);
      if (res.url) window.open(res.url, "_blank", "noopener");
    } catch {
      setMsg("Could not set that up. Try again.");
    }
  }
  return (
    <div className={styles.remind}>
      <span>{label}</span>
      {items.map((i) => (
        <button key={i.channel} type="button" className={styles.rbtn} onClick={() => go(i)}>
          <BrandLogo id={i.logo} size={24} />
          {i.label}
        </button>
      ))}
      <span className={styles.toast} role="status" aria-live="polite">{msg}</span>
    </div>
  );
}
