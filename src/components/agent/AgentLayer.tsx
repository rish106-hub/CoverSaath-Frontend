"use client";

import styles from "./agent.module.css";
import { AskCard } from "./AskCard";
import { AskDock } from "./AskDock";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { CommandPalette } from "@/components/palette/CommandPalette";

/** Everything global that Ask Knowvia owns: dock, card, palette, shortcuts overlay. Mounted once by AppShell. */
export function AgentLayer() {
  return (
    <>
      <div className={styles.dockWrap}><AskDock /></div>
      <AskCard />
      <CommandPalette />
      <ShortcutsOverlay />
    </>
  );
}
