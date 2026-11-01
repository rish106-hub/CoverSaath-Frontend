"use client";

import type { NotifyChannel } from "@/adapters";
import { RemindRow } from "@/components/remind";

export type RemindItem = { channel: NotifyChannel; label: string; logo: string; subject: string };

/** Desk thread row: tell me when this case moves. Channels come from `items`; the date is the expected decision day. */
export function RemindRowSlot({ label, items }: { label: string; items: RemindItem[] }) {
  const subject = items[0]?.subject ?? "Case update";
  return <RemindRow label={label} channels={items.map((i) => i.channel)} items={[{ title: subject, date: "2026-11-03", detail: "Decision expected" }]} />;
}
