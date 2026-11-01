"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adapters } from "@/adapters";
import { usePageContext } from "@/agent/page-context";
import { useAgent } from "./AgentProvider";
import styles from "./AskChat.module.css";

/** The chat half of the Ask Knowvia panel: shared thread, one input, mic for dictation. Loaded on first expand. */
export function AskChatPane() {
  const { chatOpen, thread, thinking, hold, submit, close, toggleMic } = useAgent();
  const ctx = usePageContext();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const canSpeak = typeof window !== "undefined" && adapters.voice.supported();

  useEffect(() => { if (chatOpen) input.current?.focus(); }, [chatOpen]);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [thread.length, thinking, chatOpen]);

  const send = () => {
    const said = text.trim();
    if (!said) return;
    submit(said);
    setText("");
  };

  return (
    <>
      <div className={styles.thread} role="log" aria-live="polite" aria-label="Conversation">
        {thread.length === 0 ? (
          <div className={styles.empty}>
            <p>Ask about your cover, claims or the page you are on.</p>
            <div className={styles.starters}>
              {ctx.examples.slice(0, 3).map((e) => (
                <button key={e.say} type="button" className={styles.starter} onClick={() => submit(e.say)}>{e.say}</button>
              ))}
            </div>
          </div>
        ) : null}
        {thread.map((m) => (
          <div key={m.id} className={`${styles.msg} ${m.role === "user" ? styles.mine : styles.theirs}`}>
            <p>{m.text}</p>
            {m.route ? (
              <Link href={m.route} className="k-btn k-btn--sm" onClick={close}>{m.goLabel ?? "Open"}</Link>
            ) : null}
          </div>
        ))}
        {thinking ? <div className={`${styles.msg} ${styles.theirs} ${styles.dots}`} role="status" aria-label="Knowvia is replying"><i /><i /><i /></div> : null}
        <div ref={end} />
      </div>

      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={input} className={styles.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question" aria-label="Message to Ask Knowvia" autoComplete="off" />
        {canSpeak ? (
          <button type="button" className="k-btn" aria-pressed={hold.state === "listening"} onClick={toggleMic} aria-label="Speak your question">
            {hold.state === "listening" ? "Stop" : "Speak"}
          </button>
        ) : null}
        <button type="submit" className="k-btn k-btn--primary" disabled={!text.trim()}>Send</button>
      </form>
    </>
  );
}
