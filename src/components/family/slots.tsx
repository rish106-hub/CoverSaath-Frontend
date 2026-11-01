"use client";

import { RemindRow, nextIso } from "@/components/remind";
import { familyDates } from "@/data/mock";

/** "Put these dates on" row for the dates the documents give. */
export function RemindRowSlot({ subject }: { subject: string }) {
  const items = familyDates.map((d) => ({ title: d.title, date: nextIso(d.day, d.month), detail: `${d.who} · ${subject}` }));
  return <RemindRow label="Put these dates on" items={items} />;
}
