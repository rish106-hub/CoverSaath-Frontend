"use client";

import { useEffect, useRef } from "react";
import { SHORTCUTS, type ShortcutSection } from "@/lib/shortcuts";
import { useAgent } from "./AgentProvider";
import styles from "./agent.module.css";

const SECTIONS: ShortcutSection[] = ["Go to", "Act", "Move", "On a page"];
const pretty = (k: string) => (k === "escape" ? "Esc" : k === "enter" ? "Enter" : k.toUpperCase());

/** `?` overlay. The only place besides /shortcuts where key hints are shown. */
export function ShortcutsOverlay() {
  const { helpOpen, setHelpOpen } = useAgent();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (helpOpen) ref.current?.focus(); }, [helpOpen]);
  if (!helpOpen) return null;
  return (
    <div className={styles.scrim} onClick={() => setHelpOpen(false)}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-label="Keyboard shortcuts" className={`${styles.panel} ${styles.overlay}`} onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts</h2>
        {SECTIONS.map((sec) => (
          <section key={sec}>
            <h3>{sec}</h3>
            {SHORTCUTS.filter((s) => s.section === sec).map((s) => (
              <div key={s.id} className={styles.row}>
                <span>{s.label}{s.scope ? ` (${s.scope.slice(1)})` : ""}</span>
                <span className={styles.keys}>{s.keys.map((k) => <kbd key={k} className={styles.kbd}>{pretty(k)}</kbd>)}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
