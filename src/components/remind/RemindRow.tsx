"use client";

import { useState } from "react";
import { useSingleFlight } from "@/lib/use-single-flight";
import { adapters, type NotifyChannel } from "@/adapters";
import { BrandLogo, type BrandId } from "@/components/logos";
import { buildIcs, googleCalendarUrl, type RemindItem } from "./ics";
import styles from "./RemindRow.module.css";

const CHANNELS: Record<NotifyChannel, { label: string; logo: BrandId }> = {
  "google-calendar": { label: "Google Calendar", logo: "google-calendar" },
  "apple-calendar": { label: "Apple Calendar", logo: "apple" },
  whatsapp: { label: "WhatsApp reminder", logo: "whatsapp" },
  email: { label: "Email me", logo: "gmail" },
};

export const DEFAULT_CHANNELS: NotifyChannel[] = ["google-calendar", "apple-calendar", "whatsapp"];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** "Put these on your calendar" row (BUILD-SPEC 5.3). Google opens a prefilled event, Apple downloads an .ics, the rest confirm by toast. */
export function RemindRow({ label, items, channels = DEFAULT_CHANNELS }: { label: string; items: RemindItem[]; channels?: NotifyChannel[] }) {
  const [message, setMessage] = useState("");

  const { run: once, busy, alive } = useSingleFlight();

  function run(channel: NotifyChannel) {
    return once(async () => {
      const subject = items.map((i) => i.title).join(", ");
      try {
        const res = await adapters.notify.send(channel, subject);
        if (!alive()) return;
        if (channel === "google-calendar" && items[0]) window.open(googleCalendarUrl(items[0]), "_blank", "noopener");
        if (channel === "apple-calendar") download("knowvia-reminders.ics", buildIcs(items));
        setMessage(res.message);
      } catch {
        if (alive()) setMessage("That did not go through. Try again.");
      }
    });
  }

  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.buttons}>
        {channels.map((c) => (
          <button key={c} type="button" className={styles.btn} onClick={() => run(c)} disabled={busy}>
            <BrandLogo id={CHANNELS[c].logo} size={24} />
            {CHANNELS[c].label}
          </button>
        ))}
      </div>
      <span role="status" aria-live="polite" className={styles.toast}>{message}</span>
    </div>
  );
}
