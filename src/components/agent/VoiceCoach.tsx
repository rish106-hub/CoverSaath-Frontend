"use client";

import { useEffect, useRef, useState } from "react";
import { useAgent } from "./AgentProvider";
import styles from "./agent.module.css";

const KEY = "knowvia.voiceCoach";
const MAX_SHOWS = 2;

function readCount(): number {
  try { return Number.parseInt(window.localStorage.getItem(KEY) ?? "0", 10) || 0; } catch { return MAX_SHOWS; }
}
function writeCount(n: number) {
  try { window.localStorage.setItem(KEY, String(n)); } catch { /* storage unavailable: show nothing more this session */ }
}

/** First-run coach card above the dock. Shows on at most two visits, then never. */
export function VoiceCoach() {
  const { open, view } = useAgent();
  const [shown, setShown] = useState(false);
  const tryBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const n = readCount();
    if (n >= MAX_SHOWS) return;
    writeCount(n + 1);
    const id = setTimeout(() => setShown(true), 0);
    return () => clearTimeout(id);
  }, []);

  const dismiss = (forever: boolean) => {
    if (forever) writeCount(MAX_SHOWS);
    setShown(false);
  };

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); dismiss(true); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [shown]);

  // Opening the panel by any route counts as having found the voice control.
  if (shown && view !== "closed") { writeCount(MAX_SHOWS); setShown(false); }

  if (!shown) return null;
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="voice-coach-title" className={styles.coach}>
      <p id="voice-coach-title" className={styles.coachText}><b>Talk to Knowvia.</b> Say what you need, it can open pages and answer questions.</p>
      <div className={styles.coachActions}>
        <button ref={tryBtn} type="button" className="k-btn k-btn--primary k-btn--sm" onClick={() => { dismiss(true); open(document.querySelector<HTMLElement>("[data-ask-trigger]"), { anchor: "dock" }); }}>Try it</button>
        <button type="button" className="k-btn k-btn--sm" onClick={() => dismiss(true)}>Not now</button>
      </div>
    </div>
  );
}
