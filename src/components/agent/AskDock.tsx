"use client";

import { usePageContext } from "@/agent/page-context";
import { useAgent } from "./AgentProvider";
import styles from "./agent.module.css";

/** Bottom-centre pill on every app page. */
export function AskDock() {
  const { open, hold } = useAgent();
  const ctx = usePageContext();
  return (
    <button type="button" data-ask-trigger className={styles.dock} aria-label="Ask Knowvia, hold V" aria-expanded={hold.open} onClick={(e) => open(e.currentTarget, { anchor: "dock", mode: "text" })}>
      <span className={styles.orb} aria-hidden />
      <span className={styles.dockText}><b>Ask Knowvia</b><span>Reads this page · {ctx.page}</span></span>
      <kbd className={styles.kbd}>Hold V</kbd>
    </button>
  );
}
