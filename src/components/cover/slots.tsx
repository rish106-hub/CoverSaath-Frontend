"use client";

import { useRef } from "react";
import { useAgent } from "@/components/agent";
import { RemindRow, nextIso } from "@/components/remind";
import { usePageContext } from "@/agent/page-context";
import { yearTiles } from "@/data/mock/home";
import s from "./AskStrip.module.css";

/** Overview: the Ask Knowvia row under the greeting. One invitation, at most two short suggestions. */
export function AskKnowviaStripSlot() {
  const { open, submit } = useAgent();
  const ctx = usePageContext();
  const ref = useRef<HTMLButtonElement>(null);
  const ask = (say?: string) => {
    open(ref.current, { anchor: "strip", mode: "text" });
    if (say) submit(say);
  };
  return (
    <div className={s.strip}>
      <button ref={ref} type="button" className={s.main} onClick={() => ask()}>
        <span className={s.orb} aria-hidden />
        <b>Ask Knowvia anything</b>
      </button>
      <button type="button" className={s.chip} aria-label="Talk to Knowvia" onClick={() => open(ref.current, { anchor: "strip" })}>Talk</button>
      <div className={s.chips}>
        {ctx.examples.slice(0, 2).map((e) => (
          <button key={e.say} type="button" className={s.chip} onClick={() => ask(e.say)}>{e.say}</button>
        ))}
      </div>
    </div>
  );
}

/** Board Home: "Add all N dates" row under the Your year heading. */
export function RemindRowSlot({ count }: { count: number }) {
  const items = yearTiles.slice(0, count).map((t) => ({ title: t.t, date: nextIso(t.d, t.m), detail: t.s }));
  return <RemindRow label={`Add all ${count} dates`} items={items} />;
}
