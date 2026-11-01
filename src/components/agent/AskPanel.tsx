"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePageContext } from "@/agent/page-context";
import { commandsFor } from "@/agent/voice-commands";
import { usePathname } from "next/navigation";
import { adapters } from "@/adapters";
import { useAgent } from "./AgentProvider";
import { KeyHint } from "./KeyHint";
import styles from "./AskPanel.module.css";

// The thread and input load the first time chat is opened; voice never waits for them.
const AskChatPane = dynamic(() => import("./AskChatPane").then((m) => m.AskChatPane), { ssr: false, loading: () => null });

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
    </svg>
  );
}

/** Ask Knowvia: one panel. Voice is the default; the arrow expands the same panel upward into chat. */
export function AskPanel() {
  const { view, hold, speaking, transcript, reply, done, note, thinking, close, setChat, toggleMic, submit } = useAgent();
  const ctx = usePageContext();
  const commands = commandsFor(usePathname() ?? "/home");
  const mic = useRef<HTMLButtonElement>(null);
  const arrow = useRef<HTMLButtonElement>(null);
  const prev = useRef(view);
  const chat = view === "chat";
  const [chatSeen, setChatSeen] = useState(chat);
  if (chat && !chatSeen) setChatSeen(true);

  // Focus follows the mode: mic in voice, arrow when folding back. The chat pane focuses its own input.
  useEffect(() => {
    if (prev.current !== view) {
      if (view === "voice" && prev.current === "chat") arrow.current?.focus();
      if (view === "voice" && prev.current === "closed") mic.current?.focus();
    }
    prev.current = view;
  }, [view]);

  if (view === "closed") return null;

  const listening = hold.state === "listening";
  const working = hold.state === "working" || thinking;
  const label = speaking ? "Speaking" : listening ? "Listening" : working ? "Thinking" : hold.state === "done" ? "Ready for your next question" : "Tap the mic and talk";
  const steps = reply?.steps ?? [];
  const go = reply?.route && done >= 3 ? reply : null;
  const state = speaking ? "speaking" : listening ? "listening" : working ? "thinking" : "idle";

  return (
    <div role="dialog" aria-label="Ask Knowvia" data-view={view} data-state={state} className={styles.sheet}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <b>Ask Knowvia</b>
          <span className={styles.reads}>Reading {ctx.reads}</span>
        </div>
        <button type="button" className="k-btn k-btn--sm" onClick={close}>Close</button>
      </div>

      <div id="ask-chat-pane" className={styles.chatWrap} data-open={chat} aria-hidden={!chat}>
        <div className={styles.chatInner}>{chatSeen ? <div className={styles.chatBody}><AskChatPane /></div> : null}</div>
      </div>

      <div className={styles.voice}>
        <div className={styles.status} role="status" aria-live="polite">
          <span className={styles.label}>{label}</span>
          {state === "idle" && !chat && adapters.voice.supported() ? <span className={styles.holdHint}>Or hold <KeyHint /> and speak</span> : null}
          {transcript && !chat ? <div className={styles.say}>{transcript}</div> : null}
          {reply && done >= 3 && !chat ? <div className={styles.reply}>{reply.reply}</div> : null}
          {note ? <div className={styles.note}>{note}</div> : null}
        </div>

        {!chat && steps.length ? (
          <ol className={styles.steps}>
            {steps.map((s, i) => (
              <li key={s} className={`${styles.step} ${i < done ? styles.stepDone : ""}`}>
                <i aria-hidden>{i < done ? "✓" : i + 1}</i>
                {s}
              </li>
            ))}
          </ol>
        ) : null}

        {!chat && go ? (
          <Link className={styles.go} href={go.route as string} onClick={close}>
            {go.goLabel ?? "Go there"}<span aria-hidden>→</span>
          </Link>
        ) : null}

        <div className={styles.controls}>
          <button ref={mic} type="button" className={styles.mic} aria-label="Talk to Knowvia" aria-pressed={listening} onClick={toggleMic}>
            <span className={styles.micRing} aria-hidden />
            <MicIcon />
          </button>
          <button
            ref={arrow}
            type="button"
            className={styles.arrow}
            aria-label={chat ? "Back to voice" : "Open chat"}
            aria-expanded={chat}
            aria-controls="ask-chat-pane"
            onClick={() => setChat()}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={styles.chev}>
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
        </div>

        {!chat && !transcript && !thinking ? (
          <div className={styles.examples}>
            <span className={styles.tryLabel}>You can say</span>
            {commands.map((c) => (
              <button key={c} type="button" className={styles.ex} onClick={() => submit(c)}>
                “{c}”
              </button>
            ))}
          </div>
        ) : null}
        {!chat && transcript ? (
          <div className={styles.examples}>
            <span className={styles.tryLabel}>Try saying</span>
            {ctx.examples.map((e) => (
              <button key={e.say} type="button" className={styles.ex} onClick={() => submit(e.say)}>
                {e.say}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
