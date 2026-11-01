"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePageContext } from "@/agent/page-context";
import { STATE_LABEL } from "@/agent/hold";
import { useAgent } from "./AgentProvider";
import styles from "./agent.module.css";

/** 460 px card beside its trigger: LISTENING → WORKING → DONE. Never a full-page sheet. */
export function AskCard() {
  const { hold, mode, anchor, anchorRect, transcript, reply, done, note, close, submit } = useAgent();
  const ctx = usePageContext();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hold.open && mode === "text") input.current?.focus();
  }, [hold.open, mode, hold.state]);

  if (!hold.open) return null;

  const style =
    anchor === "strip" && anchorRect
      ? { top: Math.max(80, Math.min(anchorRect.bottom + 8, window.innerHeight - 560)), left: Math.max(16, Math.min(anchorRect.left, window.innerWidth - 476)) }
      : undefined;
  const live = hold.state === "listening";
  const steps = reply?.steps ?? [];
  const go = reply?.route && done >= 3 ? reply : null;

  return (
    <div role="dialog" aria-label="Ask Knowvia" className={`${styles.card} ${style ? "" : styles.cardDock}`} style={style}>
      <div className={styles.head}>
        <span className={`${styles.orb} ${live ? styles.orbLive : ""}`} aria-hidden />
        <div className={styles.headText}>
          <b>Ask Knowvia</b>
          <span className={styles.reads}>Reading {ctx.reads}</span>
        </div>
        <button type="button" className={styles.x} onClick={close}>Esc</button>
      </div>

      <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={styles.label}>{STATE_LABEL[hold.state]}</span>
        {transcript ? <div className={styles.say}>“{transcript}”</div> : null}
        {reply && done >= 3 ? <div className={styles.reply}>{reply.reply}</div> : null}
        {note ? <div className={styles.note}>{note}</div> : null}
      </div>

      {steps.length ? (
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={s} className={`${styles.step} ${i < done ? styles.stepDone : ""}`}>
              <i aria-hidden>{i < done ? "✓" : i + 1}</i>
              {s}
            </li>
          ))}
        </ol>
      ) : null}

      {go ? (
        <Link className={styles.go} href={go.route as string} onClick={close}>
          {go.goLabel ?? "Go there"}<span aria-hidden>→</span>
        </Link>
      ) : null}

      {mode === "text" || hold.state === "done" ? (
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); submit(text); setText(""); }}>
          <input ref={input} className={styles.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type what you need" aria-label="Type to Ask Knowvia" />
          <button type="submit" className={styles.send}>Ask</button>
        </form>
      ) : null}

      <div className={styles.examples}>
        <span className={styles.tryLabel}>Try saying, on this page</span>
        {ctx.examples.map((e) => (
          <button key={e.say} type="button" className={styles.ex} onClick={() => submit(e.say)}>“{e.say}”</button>
        ))}
      </div>

      <div className={styles.foot}>
        <span><kbd className={styles.kbd}>V</kbd> hold to talk</span>
        <span><kbd className={styles.kbd}>Esc</kbd> close</span>
        <span>English, Hindi or both</span>
      </div>
    </div>
  );
}
