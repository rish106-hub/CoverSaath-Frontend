"use client";

import dynamic from "next/dynamic";
import styles from "./agent.module.css";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { VoiceCoach } from "./VoiceCoach";
import { useAgent } from "./AgentProvider";
import { voiceOnHold } from "./voice-hold";

// The panel renders nothing until opened; the palette is fetched on first use. loading: null keeps layout untouched.
const AskPanel = dynamic(() => import("./AskPanel").then((m) => m.AskPanel), { ssr: false, loading: () => null });
const CommandPalette = dynamic(() => import("@/components/palette/CommandPalette").then((m) => m.CommandPalette), { ssr: false, loading: () => null });

/** Everything global that Ask Knowvia owns: voice coach, card, palette, shortcuts overlay. Mounted once by AppShell. */
export function AgentLayer() {
  const { view, paletteOpen } = useAgent();
  return (
    <>
      <div className={styles.dockWrap}>{voiceOnHold() ? null : <VoiceCoach />}</div>
      {view !== "closed" ? <AskPanel /> : null}
      {paletteOpen ? <CommandPalette /> : null}
      <ShortcutsOverlay />
    </>
  );
}
