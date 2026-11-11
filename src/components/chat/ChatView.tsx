"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { adapters } from "@/adapters";
import { AdapterError } from "@/adapters/types";
import { errorText } from "@/adapters/documents-contract";
import { CHAT_MESSAGE_MAX, type TurnAnswer, type TurnEvent } from "@/adapters/chat-contract";
import { MicGlyph } from "@/components/agent/VoiceIcons";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { FALLBACK_NOTICE } from "@/agent/voice-gnani";
import { useHoldings } from "@/components/covers/use-holdings";
import { STATUS_TEXT } from "@/components/covers/format";
import s from "./chat.module.css";

// Chat about the household's cover. The answer streams in; when it is complete it shows the facts it used, each with where it came from, and
// "check with the insurer" where the backend marks a product term. Nothing here decides cover: deterministic backend code does, and the
// page shows its words. Voice reuses the existing speech adapter (the recording goes to the speech service through the BFF and is not kept here);
// only the words come back, and they go to the chat as a voice turn.

const PROMPTS = ["Planned knee surgery in Jan, is it covered?", "What are my waiting periods?", "Cashless hospitals near 400053"] as const;

type Msg = { id: number; role: "user" | "assistant"; text: string; busy?: boolean; error?: string; answer?: TurnAnswer; voice?: boolean };

const codeOf = (e: unknown): string => (e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE");

/** Spoken-question failures in plain words. FOR LEGAL REVIEW: the notice and fallback wording are not final. */
function voiceText(code: string): string {
  if (code === "VOICE_FALLBACK_NOTICE") return `${FALLBACK_NOTICE} Tap the mic to continue.`;
  if (code === "VOICE_MIC_DENIED") return "The microphone is blocked. Type your question, or allow it in your browser.";
  if (code === "VOICE_BAD_AUDIO" || code === "VOICE_TOO_LARGE") return "I could not read that audio. Tap the mic and try again.";
  if (code === "VOICE_BUSY") return "Voice is busy. Try again in a moment.";
  if (code === "VOICE_RATE_LIMITED") return "Voice has reached its limit for now. Type your question.";
  return "Voice is not available here. Type your question.";
}

function FactChips({ a }: { a: TurnAnswer }) {
  if (a.factsUsed.length === 0) return null;
  return (
    <div>
      <p className={s.small}>Facts used</p>
      <ul className={s.facts} aria-label="Facts used">
        {a.factsUsed.map((f) => (
          <li key={f.factId} className={s.chip} data-check={f.checkWithInsurer}>
            <b>{f.label}</b>
            {f.valueText ? <span>{f.valueText}</span> : null}
            <span>{STATUS_TEXT[f.status]}</span>
            {/* FOR LEGAL REVIEW: wording on a product term. The insurer's own wording governs. */}
            {f.checkWithInsurer ? <span data-role="check">Check with the insurer</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Checks({ a }: { a: TurnAnswer }) {
  const checks = a.computed?.checks ?? [];
  if (checks.length === 0) return null;
  return (
    <ul className={s.checks} aria-label="What we checked">
      {checks.map((c) => <li key={c.id} data-status={c.status}>{c.detail}</li>)}
    </ul>
  );
}

export function ChatView() {
  const { holdings, current, select, error: listError } = useHoldings();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  // False on the server and first paint, then what the browser can do: no hydration mismatch.
  const canSpeak = useSyncExternalStore(() => () => undefined, () => adapters.voice.supported(), () => false);
  const [note, setNote] = useState<string | null>(null);
  const thread = useRef<{ id: string; holdingId: string | null } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const holdingId = current?.id;

  useEffect(() => () => { abort.current?.abort(); }, []);
  // A different cover is a different conversation.
  useEffect(() => { thread.current = null; }, [holdingId]);

  const patch = useCallback((id: number, f: (m: Msg) => Msg) => setMsgs((all) => all.map((m) => (m.id === id ? f(m) : m))), []);

  const ask = useCallback(async (raw: string, voice = false) => {
    const text = raw.trim().slice(0, CHAT_MESSAGE_MAX);
    if (!text || busy) return;
    setBusy(true);
    setNote(null);
    setDraft("");
    const uid = (seq.current += 1);
    const aid = (seq.current += 1);
    setMsgs((all) => [...all, { id: uid, role: "user", text, voice }, { id: aid, role: "assistant", text: "", busy: true }]);
    const ac = new AbortController();
    abort.current = ac;
    const onEvent = (e: TurnEvent) => {
      if (e.type === "delta") patch(aid, (m) => ({ ...m, text: m.text + e.data.text }));
      else if (e.type === "answer") patch(aid, (m) => ({ ...m, text: e.data.answer, answer: e.data, busy: false }));
    };
    try {
      let t = thread.current;
      if (!t || t.holdingId !== (holdingId ?? null)) {
        const made = await adapters.chat.startThread(holdingId);
        t = { id: made.id, holdingId: made.holdingId ?? null };
        thread.current = t;
      }
      await adapters.chat.turn(t.id, { message: text, inputKind: voice ? "voice" : "text" }, onEvent, ac.signal);
      patch(aid, (m) => ({ ...m, busy: false }));
    } catch (e) {
      const code = codeOf(e);
      if (code === "NOT_FOUND") thread.current = null; // the thread is gone: the next question opens a new one
      patch(aid, (m) => ({ ...m, busy: false, error: code }));
    } finally {
      setBusy(false);
    }
  }, [busy, holdingId, patch]);

  function speak() {
    if (listening) { adapters.voice.stop?.(); return; }
    if (busy) return;
    setNote(null);
    setListening(true);
    adapters.voice.listen().then(
      (heard) => { setListening(false); if (heard) void ask(heard, true); else setNote("I did not catch that. Tap the mic and try again."); },
      (e: unknown) => { setListening(false); setNote(voiceText(codeOf(e))); },
    );
  }

  const first = msgs.length === 0;
  return (
    <div className={s.stack}>
      <div>
        <Kicker>Your family&rsquo;s cover</Kicker>
        <PageTitle>Ask about your cover</PageTitle>
      </div>

      {holdings && holdings.length > 1 ? (
        <label className={s.field}>Cover
          <select value={holdingId} onChange={(e) => select(e.target.value)} disabled={busy}>
            {holdings.map((h, i) => <option key={h.id} value={h.id}>{`Cover ${i + 1}`}</option>)}
          </select>
        </label>
      ) : null}
      {listError ? <p className={s.alert} role="alert">{errorText(listError)}</p> : null}

      <SectionHeading title="Conversation" description="Answers come from your own documents and the insurer's wording, with the facts shown.">
        {first ? (
          <div className={s.prompts} role="group" aria-label="Suggested questions">
            {PROMPTS.map((p) => <button key={p} type="button" className="k-btn k-btn--secondary" disabled={busy || holdings === null} onClick={() => void ask(p)}>{p}</button>)}
          </div>
        ) : (
          <ol className={s.log} role="log" aria-live="polite" aria-label="Conversation">
            {msgs.map((m) => (
              <li key={m.id} className={s.msg} data-role={m.role} data-busy={m.busy === true}>
                <span className={s.who}>{m.role === "user" ? (m.voice ? "You said" : "You") : "Knowvia"}</span>
                {m.text ? <p>{m.text}</p> : m.busy ? <p className={s.quiet}>Looking in your cover…</p> : null}
                {m.answer ? <FactChips a={m.answer} /> : null}
                {m.answer ? <Checks a={m.answer} /> : null}
                {m.answer && m.answer.openConflicts.length > 0 ? <p className={s.quiet}>Some details in your cover are not settled. <Link href="/covers/review">Review them</Link>.</p> : null}
                {m.answer?.intent === "network_hospitals" ? <p className={s.quiet}><Link href="/hospitals">Open network hospitals</Link></p> : null}
                {m.error ? <p className={s.alert} role="alert">{errorText(m.error)}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </SectionHeading>

      <form className={s.composer} onSubmit={(e) => { e.preventDefault(); void ask(draft); }} aria-label="Ask a question">
        <label className={s.field}>Your question
          <textarea value={draft} maxLength={CHAT_MESSAGE_MAX} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(draft); } }} />
        </label>
        <div className={s.row}>
          <button type="submit" className="k-btn" disabled={busy || draft.trim() === "" || holdings === null}>Ask</button>
          {canSpeak ? (
            <button type="button" className={`k-btn k-btn--secondary ${s.mic}`} data-on={listening} aria-pressed={listening} disabled={busy && !listening} onClick={speak}>
              <MicGlyph size={16} />{listening ? "Stop listening" : "Ask by voice"}
            </button>
          ) : null}
        </div>
        {/* FOR LEGAL REVIEW: microphone permission and consent wording, and what is kept. Not final. Only the words are kept with the conversation. */}
        {canSpeak ? <p className={s.quiet}>{adapters.voice.notice ?? ""} The words you speak are saved with this conversation.</p> : null}
        {note ? <p className={s.note} role="status">{note}</p> : null}
      </form>

      <div className={s.row}>
        <Link className="k-btn k-btn--secondary" href="/hospitals">Network hospitals</Link>
        <Link className="k-btn k-btn--secondary" href="/covers/review">What we found</Link>
      </div>
    </div>
  );
}
