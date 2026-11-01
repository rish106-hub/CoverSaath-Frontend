"use client";

import { useAgent } from "./AgentProvider";
import { MicGlyph } from "./VoiceIcons";
import styles from "./agent.module.css";

/** Small mic in the top bar, next to the theme button. Opens the panel in voice mode. */
export function HeaderMic() {
  const { open, close, view } = useAgent();
  return (
    <button type="button" className={styles.headMic} aria-label="Talk to Knowvia" title="Talk to Knowvia. Or hold V and speak." aria-keyshortcuts="V" aria-expanded={view !== "closed"} onClick={(e) => (view === "closed" ? open(e.currentTarget, { anchor: "dock" }) : close())}>
      <MicGlyph size={18} />
    </button>
  );
}
