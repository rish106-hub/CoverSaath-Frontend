"use client";

import dynamic from "next/dynamic";
import styles from "./agent.module.css";
import { AskDock } from "./AskDock";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { useAgent } from "./AgentProvider";

// Both render nothing until opened, so they are fetched on first open instead of with every page.
// loading: null keeps layout untouched; they are overlays.
const AskCard = dynamic(() => import("./AskCard").then((m) => m.AskCard), { ssr: false, loading: () => null });
const AskChat = dynamic(() => import("./AskChat").then((m) => m.AskChat), { ssr: false, loading: () => null });
const CommandPalette = dynamic(() => import("@/components/palette/CommandPalette").then((m) => m.CommandPalette), { ssr: false, loading: () => null });

/** Everything global that Ask Knowvia owns: dock, card, palette, shortcuts overlay. Mounted once by AppShell. */
export function AgentLayer() {
  const { hold, paletteOpen, chatOpen } = useAgent();
  return (
    <>
      <div className={styles.dockWrap}><AskDock /></div>
      {hold.open ? <AskCard /> : null}
      {chatOpen ? <AskChat /> : null}
      {paletteOpen ? <CommandPalette /> : null}
      <ShortcutsOverlay />
    </>
  );
}
