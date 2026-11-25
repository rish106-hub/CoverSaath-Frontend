"use client";

import { usePathname } from "next/navigation";
import { useAgent } from "./AgentProvider";
import { MicGlyph } from "./VoiceIcons";
import { KeyHint } from "./KeyHint";
import { voiceOnHold } from "./voice-hold";
import styles from "./agent.module.css";

/** Bottom-right round Ask button on every app page except /chat, where the chat itself is the assistant. The label stays for screen readers. */
export function AskDock() {
  const { open, close, view } = useAgent();
  const pathname = usePathname();
  if (pathname?.startsWith("/chat")) return null;
  const label = voiceOnHold() ? "Ask Knowvia" : "Talk to Knowvia";
  return (
    <button type="button" data-ask-trigger data-testid="ask-fab" aria-label={label} aria-keyshortcuts={voiceOnHold() ? undefined : "V"} title={voiceOnHold() ? "Ask Knowvia" : "Talk to Knowvia. Or hold V and speak."} className={`k-btn k-btn--primary ${styles.dock}`} aria-expanded={view !== "closed"} onClick={(e) => (view === "closed" ? open(e.currentTarget, voiceOnHold() ? { anchor: "dock", mode: "text" } : { anchor: "dock" }) : close())}>
      {voiceOnHold() ? <MicGlyph size={22} /> : <span className={styles.dockMic} aria-hidden><MicGlyph size={20} /></span>}
      <span className={`sr-only ${styles.dockLabel}`}>{label}</span>
      {voiceOnHold() ? null : <KeyHint className={styles.dockKey} />}
      {voiceOnHold() ? null : <span className={styles.wave} aria-hidden><i /><i /><i /><i /><i /></span>}
    </button>
  );
}
