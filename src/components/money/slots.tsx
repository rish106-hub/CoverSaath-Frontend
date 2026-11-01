"use client";

import { RemindRow, nextIso } from "@/components/remind";

const RENEWAL_DATES = [
  { title: "Northstar group cover renews", date: "2026-11-13", detail: "Via HR, nothing to pay" },
  { title: "Meridian senior plan renews", date: nextIso(13, "MAR"), detail: "Parents, compare first" },
  { title: "Kaveri super top-up renews", date: nextIso(14, "JUN"), detail: "Family" },
];

/** Renewals reminder row (BUILD-SPEC 5.3). `subject` is kept for callers; the dates come from the renewals list. */
export function RemindRowSlot({ label, subject }: { label: string; subject?: string }) {
  void subject;
  return <RemindRow label={label} items={RENEWAL_DATES} />;
}
