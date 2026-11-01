"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adapters } from "@/adapters";
import { usePageContext } from "@/agent/page-context";
import { useAgent } from "./AgentProvider";
import styles from "./agent.module.css";

/** Home row: orb, invitation, 3 example chips, and what Knowvia is doing for you. Exported for other branches. */
export function AskStrip() {
  const { open, submit } = useAgent();
  const ctx = usePageContext();
  const ref = useRef<HTMLButtonElement>(null);
  const [counts, setCounts] = useState<{ progress: number; needs: number } | null>(null);

  useEffect(() => {
    let live = true;
    adapters.desk.cases().then((cs) => {
      if (live) setCounts({ progress: cs.filter((c) => c.status === "In progress").length, needs: cs.filter((c) => c.status === "Needs you").length });
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  return (
    <div className={styles.strip}>
      <button ref={ref} type="button" className={styles.stripMain} aria-label="Ask Knowvia" onClick={() => open(ref.current, { anchor: "strip", mode: "text" })}>
        <span className={styles.orb} aria-hidden />
        <span className={styles.stripText}>
          <b>Ask Knowvia anything</b>
          <span>It reads your policies and whatever page you are on.</span>
        </span>
      </button>
      <button type="button" className={styles.stripMic} aria-label="Talk to Knowvia" onClick={() => open(ref.current, { anchor: "strip" })}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
      </button>
      <div className={styles.chips}>
        {ctx.examples.map((e) => (
          <button key={e.say} type="button" className={styles.chip} onClick={() => { open(ref.current, { anchor: "strip", mode: "text" }); submit(e.say); }}>“{e.say}”</button>
        ))}
      </div>
      <Link href="/desk" className={styles.doing}>
        <span>Doing for you</span>
        <span>{counts ? <>{counts.progress} in progress · <span className={styles.needs}>{counts.needs} needs you</span> →</> : "Open Claims and insurer talks →"}</span>
      </Link>
    </div>
  );
}
