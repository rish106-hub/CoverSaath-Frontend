"use client";

import { useAgent } from "./AgentProvider";
import { MicGlyph } from "./VoiceIcons";
import { KeyHint } from "./KeyHint";
import { voiceOnHold } from "./voice-hold";
import styles from "./agent.module.css";

/** Bottom-centre voice control on every app page: a labelled button with a breathing mic and a quiet sound wave. */
export function AskDock() {
  const { open, close, view } = useAgent();
  return (
    <button type="button" data-ask-trigger aria-keyshortcuts={voiceOnHold() ? undefined : "V"} title={voiceOnHold() ? "Ask Knowvia" : "Talk to Knowvia. Or hold V and speak."} className={`k-btn k-btn--primary ${styles.dock}`} aria-expanded={view !== "closed"} onClick={(e) => (view === "closed" ? open(e.currentTarget, voiceOnHold() ? { anchor: "dock", mode: "text" } : { anchor: "dock" }) : close())}>
      {voiceOnHold() ? null : <span className={styles.dockMic} aria-hidden><MicGlyph size={20} /></span>}
      <span className={styles.dockLabel}>{voiceOnHold() ? "Ask Knowvia" : "Talk to Knowvia"}</span>
      {voiceOnHold() ? null : <KeyHint className={styles.dockKey} />}
      {voiceOnHold() ? null : <span className={styles.wave} aria-hidden><i /><i /><i /><i /><i /></span>}
    </button>
  );
}
