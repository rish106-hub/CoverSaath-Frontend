"use client";

import { useState } from "react";
import { adapters, type NotifyChannel } from "@/adapters";
import { BrandLogo, type BrandId } from "@/components/logos/BrandLogo";
import ui from "./ui.module.css";

export type RemindItem = { channel: NotifyChannel; label: string; logo: BrandId; subject: string };

/** Slot for the shared RemindRow. W6 swaps this for the W4 component; props match BUILD-SPEC 5.3. */
export function RemindRowSlot({ label, items }: { label: string; items: RemindItem[] }) {
  const [done, setDone] = useState<Record<string, string>>({});
  async function go(it: RemindItem) {
    const r = await adapters.notify.send(it.channel, it.subject);
    setDone((d) => ({ ...d, [it.channel]: r.message }));
    if (r.url) window.open(r.url, "_blank", "noopener,noreferrer");
  }
  return (
    <div className={ui.row + " " + ui.wrap} role="group" aria-label={label}>
      <span className={ui.small}>{label}</span>
      {items.map((it) => (
        <button key={it.channel} type="button" className={ui.chip + (done[it.channel] ? " " + ui.chipOn : "")} onClick={() => go(it)}>
          <BrandLogo id={it.logo} size={22} />
          {done[it.channel] ?? it.label}
        </button>
      ))}
    </div>
  );
}
