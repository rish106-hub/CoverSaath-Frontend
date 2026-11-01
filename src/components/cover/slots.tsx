"use client";

import { AskStrip } from "@/components/agent";
import { RemindRow, nextIso } from "@/components/remind";
import { yearTiles } from "@/data/mock/home";

/** Board Home: the Ask Knowvia strip under the greeting. */
export function AskKnowviaStripSlot() {
  return <AskStrip />;
}

/** Board Home: "Add all N dates" row under the Your year heading. */
export function RemindRowSlot({ count }: { count: number }) {
  const items = yearTiles.slice(0, count).map((t) => ({ title: t.t, date: nextIso(t.d, t.m), detail: t.s }));
  return <RemindRow label={`Add all ${count} dates`} items={items} />;
}
