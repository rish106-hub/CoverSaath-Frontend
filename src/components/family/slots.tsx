"use client";

import { useState } from "react";
import { adapters, type NotifyChannel } from "@/adapters";
import styles from "./family.module.css";

/**
 * Slot for the shared reminder row ("Put these dates on" + three channels).
 * W6 builds the real RemindRow and swaps this file's export; keep the props stable.
 */
export function RemindRowSlot({ subject }: { subject: string }) {
  const [sent, setSent] = useState<NotifyChannel | null>(null);
  const channels: { id: NotifyChannel; label: string }[] = [
    { id: "google-calendar", label: "Google Calendar" },
    { id: "apple-calendar", label: "Apple Calendar" },
    { id: "whatsapp", label: "WhatsApp reminder" },
  ];
  return (
    <div className={styles.remind} data-testid="remind-row-slot">
      <span>Put these dates on</span>
      {channels.map((c) => (
        <button key={c.id} type="button" className={styles.rbtn} data-on={sent === c.id} onClick={() => adapters.notify.send(c.id, subject).then(() => setSent(c.id))}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
