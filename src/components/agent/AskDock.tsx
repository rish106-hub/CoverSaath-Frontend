"use client";

import { useAgent } from "./AgentProvider";
import { MicGlyph } from "./VoiceIcons";
import { KeyHint } from "./KeyHint";
import styles from "./agent.module.css";

/** Bottom-centre voice control on every app page: a labelled button with a breathing mic and a quiet sound wave. */
export function AskDock() {
  const { open, close, view } = useAgent();
  return (
    <button type="button" data-ask-trigger aria-keyshortcuts="V" title="Talk to Knowvia. Or hold V and speak." className={`k-btn k-btn--primary ${styles.dock}`} aria-expanded={view !== "closed"} onClick={(e) => (view === "closed" ? open(e.currentTarget, { anchor: "dock" }) : close())}>
      <span className={styles.dockMic} aria-hidden><MicGlyph size={20} /></span>
      <span className={styles.dockLabel}>Talk to Knowvia</span>
      <KeyHint className={styles.dockKey} />
      <span className={styles.wave} aria-hidden><i /><i /><i /><i /><i /></span>
    </button>
  );
}
