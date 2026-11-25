"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { adapters } from "@/adapters";
import { AdapterError } from "@/adapters/types";
import { SLOW_AFTER_MS, isTurnTimeout } from "@/adapters/chat-timing";
import { errorText } from "@/adapters/documents-contract";
import { CHAT_MESSAGE_MAX, type TurnAnswer, type TurnEvent } from "@/adapters/chat-contract";
import { MicGlyph } from "@/components/agent/VoiceIcons";
import { voiceOnHold } from "@/components/agent/voice-hold";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { FALLBACK_NOTICE } from "@/agent/voice-gnani";
import { ChatConsentCard, WithdrawConsent, useChatConsent } from "./ChatConsent";
import { useHoldings } from "@/components/covers/use-holdings";
import { statusText } from "@/components/covers/format";
import { INSURER_SOURCE, INSURER_UNCHECKED_LABEL, clipQuote, insurerLine, isInsurerUnchecked } from "@/adapters/insurer-tier";
import { CoverOptions } from "@/components/covers/holding-label";
import s from "./chat.module.css";

// Chat about the household's cover. The answer streams in; when it is complete it shows the facts it used, each with where it came from, and
// "check with the insurer" where the backend marks a product term. Nothing here decides cover: deterministic backend code does, and the
// page shows its words. Voice reuses the existing speech adapter (the recording goes to the speech service through the BFF and is not kept here);
// only the words come back, and they go to the chat as a voice turn.

const PROMPTS = ["Planned knee surgery in Jan, is it covered?", "What are my waiting periods?", "Cashless hospitals near 400053"] as const;

/** Where one assistant turn is: waiting, past SLOW_AFTER_MS, resent after a failure, answered, or ended by a timeout or another failure. */
type TurnPhase = "pending" | "slow" | "retrying";
export type TurnState = TurnPhase | "answered" | "timed_out" | "failed";

type Msg = { id: number; role: "user" | "assistant"; text: string; busy?: boolean; phase?: TurnPhase; error?: string; answer?: TurnAnswer; voice?: boolean; retry?: { text: string; voice: boolean } };

/** Refusals that sending the same message again cannot fix: no Retry. Everything else (a timeout, a dropped stream, a backend hiccup) offers one. */
const NO_RETRY = new Set(["CONSENT_REQUIRED", "UNAUTHENTICATED", "INVALID_INPUT", "DEMO_READ_ONLY", "MEMORY_DISABLED"]);
/** Chat turn failures in plain words: too slow, a coded refusal that has its own line, or the generic line. */
export function turnErrorText(code: string): string {
  if (isTurnTimeout(code)) return "That took too long. Try again.";
  return NO_RETRY.has(code) ? errorText(code) : "Something went wrong. Try again.";
}

const stateOf = (m: Msg): TurnState | undefined => {
  if (m.role !== "assistant") return undefined;
  if (m.error) return isTurnTimeout(m.error) ? "timed_out" : "failed";
  if (m.busy) return m.phase ?? "pending";
  return m.answer ? "answered" : undefined;
};

/** The last finished answer only, so a screen reader hears it once, whole, and not each streamed chunk. Empty while a turn is running. */
export function announcementOf(all: Msg[]): string {
  const last = all[all.length - 1];
  return last && last.role === "assistant" && !last.busy && last.answer ? last.text : "";
}

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
            <span>{statusText(f.status, f.sourceTier)}</span>
            {/* FOR LEGAL REVIEW: wording on a product term. The insurer's own wording governs. */}
            {f.checkWithInsurer ? <span data-role="check">Check with the insurer</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const DOC_LABEL: Record<string, string> = { policy_schedule: "Policy schedule", policy_wording: "Policy terms and conditions", endorsement: "Endorsement", [INSURER_SOURCE]: INSURER_UNCHECKED_LABEL };

type Cite = { documentKind?: string | null; page?: number | null };
const isInsurerCite = (c: Cite): boolean => c.documentKind === INSURER_SOURCE;

/** Document and page for each source the answer rests on, from the answer's own citations and those on its facts. Deduplicated.
 *  The insurer's wording is its own line, "From the insurer's wording, not checked" (FOR LEGAL REVIEW), never "Your document". */
export function citationLines(a: TurnAnswer): string[] {
  const fromSources: Cite[] = (a.sources ?? []).map((x) => ({ documentKind: x.kind === "wording" ? "policy_wording" : x.kind, page: x.page }));
  // The card's insurer-tier sources (ida_wording, not checked) read the same as the stream's insurer sources.
  const fromCard: Cite[] = (a.card?.sources ?? []).filter((c) => isInsurerUnchecked(c.tier, c.status)).map((c) => ({ documentKind: INSURER_SOURCE, page: c.page }));
  const all: Cite[] = [...fromSources, ...fromCard, ...(a.citations ?? []), ...a.factsUsed.map((f) => f.citation).filter((c): c is NonNullable<typeof c> => Boolean(c))];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of all) {
    const line = isInsurerCite(c) ? insurerLine(c.page) : `${c.documentKind ? DOC_LABEL[c.documentKind] ?? "Your document" : "Your document"}${c.page ? `, page ${c.page}` : ""}`;
    if (!seen.has(line)) { seen.add(line); out.push(line); }
  }
  return out;
}

/** Quotes of insurer-tier sources on the card, at most 160 characters each. No link: there is no document of the household behind them. */
export function insurerQuotes(a: TurnAnswer): string[] {
  const quotes = [...(a.card?.sources ?? []).filter((c) => isInsurerUnchecked(c.tier, c.status)).map((c) => c.quote), ...(a.sources ?? []).filter((x) => x.kind === INSURER_SOURCE).map((x) => x.quote)];
  return [...new Set(quotes.map((q) => clipQuote(q)).filter((q): q is string => Boolean(q)))];
}

function Citations({ a }: { a: TurnAnswer }) {
  const lines = citationLines(a);
  if (lines.length === 0) return null;
  const quotes = insurerQuotes(a);
  return (
    <div>
      <p className={s.small}>Sources</p>
      <ul className={s.facts} aria-label="Sources">
        {lines.map((l) => <li key={l} className={s.chip}>{l}</li>)}
      </ul>
      {quotes.map((q) => <p key={q} className={s.small}><q>{q}</q></p>)}
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
  // /chat?holding=<id> opens the conversation on that policy (the policy page links here).
  const wanted = useSyncExternalStore(() => () => undefined, () => new URLSearchParams(window.location.search).get("holding") ?? undefined, () => undefined);
  const { holdings, current, select, error: listError } = useHoldings(wanted);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  // False on the server and first paint, then what the browser can do: no hydration mismatch.
  const canSpeak = useSyncExternalStore(() => () => undefined, () => !voiceOnHold() && adapters.voice.supported(), () => false);
  const [note, setNote] = useState<string | null>(null);
  const thread = useRef<{ id: string; holdingId: string | null } | null>(null);
  const abort = useRef<AbortController | null>(null);
  // A ref, not the `busy` state: two submits in the same tick would both read busy=false and send the question twice.
  const inFlight = useRef(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const seq = useRef(0);
  const holdingId = current?.id;
  // null while checking. A failed check counts as not given: the card shows (fail closed).
  const cc = useChatConsent();
  const { consent, required } = cc;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abort.current?.abort(); clearTimeout(slowTimer.current); };
  }, []);
  // A different cover is a different conversation.
  useEffect(() => { thread.current = null; }, [holdingId]);

  const patch = useCallback((id: number, f: (m: Msg) => Msg) => { if (mounted.current) setMsgs((all) => all.map((m) => (m.id === id ? f(m) : m))); }, []);

  const ask = useCallback(async (raw: string, voice = false, resent = false) => {
    const text = raw.trim().slice(0, CHAT_MESSAGE_MAX);
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNote(null);
    setDraft("");
    const uid = (seq.current += 1);
    const aid = (seq.current += 1);
    setMsgs((all) => [...all, { id: uid, role: "user", text, voice }, { id: aid, role: "assistant", text: "", busy: true, phase: resent ? "retrying" : "pending" }]);
    const ac = new AbortController();
    abort.current = ac;
    clearTimeout(slowTimer.current);
    slowTimer.current = setTimeout(() => patch(aid, (m) => (m.busy ? { ...m, phase: "slow" } : m)), SLOW_AFTER_MS);
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
      patch(aid, (m) => ({ ...m, busy: false, phase: undefined }));
    } catch (e) {
      const code = codeOf(e);
      if (code === "NOT_FOUND") thread.current = null; // the thread is gone: the next question opens a new one
      if (code === "CONSENT_REQUIRED") required(); // withdrawn or expired: ask again
      // Partial words of the failed turn are cleared; the Retry button resends the same text.
      patch(aid, (m) => ({ ...m, busy: false, phase: undefined, text: "", answer: undefined, error: code, retry: NO_RETRY.has(code) ? undefined : { text, voice } }));
    } finally {
      clearTimeout(slowTimer.current);
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [holdingId, patch, required]);

  /** Drops the failed pair and sends the same words again, as a voice turn if it was one. */
  function retry(uid: number, aid: number, r: { text: string; voice: boolean }) {
    if (inFlight.current) return;
    setMsgs((all) => all.filter((m) => m.id !== uid && m.id !== aid));
    void ask(r.text, r.voice, true);
  }

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

  const announcement = announcementOf(msgs);
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
            <CoverOptions holdings={holdings} />
          </select>
        </label>
      ) : null}
      {listError ? <p className={s.alert} role="alert">{errorText(listError)}</p> : null}

      {consent === false ? (
        <SectionHeading title="Before we answer"><ChatConsentCard c={cc} /></SectionHeading>
      ) : null}

      <SectionHeading title="Conversation" description="Answers come from your own documents and the insurer's wording, with the facts shown.">
        {first ? (
          <div className={s.prompts} role="group" aria-label="Suggested questions">
            {PROMPTS.map((p) => <button key={p} type="button" className="k-btn k-btn--secondary" disabled={busy || holdings === null || consent === false} onClick={() => void ask(p)}>{p}</button>)}
          </div>
        ) : (
          <>
          {/* aria-live="off" on the log: its implicit polite live region would re-read every streamed chunk. The finished answer is announced once, below. */}
          <ol className={s.log} role="log" aria-live="off" aria-label="Conversation">
            {msgs.map((m, i) => (
              <li key={m.id} className={s.msg} data-role={m.role} data-busy={m.busy === true} data-state={stateOf(m)} aria-busy={m.busy === true ? "true" : undefined}>
                <span className={s.who}>{m.role === "user" ? (m.voice ? "You said" : "You") : "Knowvia"}</span>
                {m.text ? <p>{m.text}</p> : m.busy ? <p className={s.quiet}>{m.phase === "retrying" ? "Trying again…" : "Looking in your cover…"}</p> : null}
                {m.busy && m.phase === "slow" ? <p className={s.quiet} role="status" data-role="still-working">Still working…</p> : null}
                {m.answer?.modelStatus === "numbers_unverified" ? <p className={s.quiet} data-role="numbers-unverified">The figures in this answer are not matched to a fact in your cover.</p> : null}
                {m.answer ? <FactChips a={m.answer} /> : null}
                {m.answer ? <Citations a={m.answer} /> : null}
                {m.answer ? <Checks a={m.answer} /> : null}
                {m.answer && m.answer.openConflicts.length > 0 ? <p className={s.quiet}>Some details in your cover are not settled. <Link href="/covers/review">Review them</Link>.</p> : null}
                {m.answer?.intent === "network_hospitals" ? <p className={s.quiet}><Link href="/hospitals">Open network hospitals</Link></p> : null}
                {m.error ? <p className={s.alert} role="alert">{turnErrorText(m.error)}</p> : null}
                {m.error && m.retry ? <div className={s.row}><button type="button" className="k-btn k-btn--secondary" disabled={busy} onClick={() => retry(msgs[i - 1]?.id ?? 0, m.id, m.retry!)}>Retry</button></div> : null}
              </li>
            ))}
          </ol>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-role="answer-announcer">{announcement}</p>
          </>
        )}
      </SectionHeading>

      <form className={s.composer} onSubmit={(e) => { e.preventDefault(); void ask(draft); }} aria-label="Ask a question">
        <label className={s.field}>Your question
          <textarea value={draft} maxLength={CHAT_MESSAGE_MAX} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(draft); } }} />
        </label>
        <div className={s.row}>
          <button type="submit" className="k-btn" disabled={busy || draft.trim() === "" || holdings === null || consent === false}>Ask</button>
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

      {consent === true ? <WithdrawConsent c={cc} /> : null}

      <div className={s.row}>
        <Link className="k-btn k-btn--secondary" href="/hospitals">Network hospitals</Link>
        <Link className="k-btn k-btn--secondary" href="/covers/review">What we found</Link>
      </div>
    </div>
  );
}
