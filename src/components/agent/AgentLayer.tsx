"use client";

import dynamic from "next/dynamic";
import styles from "./agent.module.css";
import { AskDock } from "./AskDock";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { useAgent } from "./AgentProvider";

// The panel renders nothing until opened; the palette is fetched on first use. loading: null keeps layout untouched.
const AskPanel = dynamic(() => import("./AskPanel").then((m) => m.AskPanel), { ssr: false, loading: () => null });
const CommandPalette = dynamic(() => import("@/components/palette/CommandPalette").then((m) => m.CommandPalette), { ssr: false, loading: () => null });

/** Everything global that Ask Knowvia owns: dock, card, palette, shortcuts overlay. Mounted once by AppShell. */
export function AgentLayer() {
  const { view, paletteOpen } = useAgent();
  return (
    <>
      <div className={styles.dockWrap}><AskDock /></div>
      {view !== "closed" ? <AskPanel /> : null}
      {paletteOpen ? <CommandPalette /> : null}
      <ShortcutsOverlay />
    </>
  );
}
