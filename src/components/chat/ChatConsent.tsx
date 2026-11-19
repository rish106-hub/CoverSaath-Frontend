"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adapters } from "@/adapters";
import { AdapterError } from "@/adapters/types";
import { errorText } from "@/adapters/documents-contract";
import { makeRequestKey } from "@/adapters/uploads";
import s from "./chat.module.css";

const codeOf = (e: unknown): string => (e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE");

/**
 * The question go-ahead, shared by the chat page and the Ask panel. `consent` is null while checking.
 * A failed check counts as "not given" (fail closed): the card is shown and the person can grant it again.
 * Pass `skip` for sessions that need no check (the demo): consent then reads as true and nothing is fetched.
 * `recheck` changes re-run the check (the panel passes its open state so a withdrawal made elsewhere is picked up).
 */
export function useChatConsent(skip = false, recheck: unknown = null) {
  const [state, setConsent] = useState<boolean | null>(null);
  const consent = skip ? true : state;
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(makeRequestKey());

  useEffect(() => {
    if (skip) return;
    let live = true;
    adapters.chat.consent().then((c) => { if (live) setConsent(c); }, () => { if (live) setConsent(false); });
    return () => { live = false; };
  }, [skip, recheck]);

  /** The server refused a turn for want of the go-ahead: ask again. */
  const required = useCallback(() => { setConsent(false); setAgreed(false); key.current = makeRequestKey(); }, []);

  const accept = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await adapters.chat.grantConsent(key.current);
      setConsent(true);
    } catch (e) {
      setError(codeOf(e));
    } finally {
      setSaving(false);
    }
  }, []);

  const withdraw = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await adapters.chat.revokeConsent();
      required();
    } catch (e) {
      setError(codeOf(e));
    } finally {
      setSaving(false);
    }
  }, [required]);

  return { consent, agreed, setAgreed, saving, error, accept, withdraw, required };
}

type State = ReturnType<typeof useChatConsent>;

/** The card that asks for the go-ahead. The same words are used on the chat page and in the Ask panel. */
export function ChatConsentCard({ c }: { c: State }) {
  return (
    // FOR LEGAL REVIEW: this wording, the purpose and the two providers named are not final.
    <div className={s.card}>
      <p className={s.lead}>To answer a question about your cover we send the question, and short passages from your own cover details that relate to it, to two services.</p>
      <ul className={s.list}>
        <li>A language service (Google Gemini) writes the answer in plain words.</li>
        <li>A search service (Voyage) finds the passages that relate to your question.</li>
      </ul>
      <p className={s.lead}>Your policy file itself is not sent. You can withdraw this at any time.</p>
      <label className={s.check}>
        <input type="checkbox" checked={c.agreed} onChange={(e) => c.setAgreed(e.target.checked)} />
        <span>Yes, you can use these services to answer my questions.</span>
      </label>
      {c.error ? <p className={s.alert} role="alert">{errorText(c.error)}</p> : null}
      <button type="button" className="k-btn k-btn--primary" disabled={!c.agreed || c.saving} onClick={() => void c.accept()}>{c.saving ? "Saving..." : "Continue"}</button>
    </div>
  );
}

/** One small control to take the go-ahead back. Calls the existing revoke; the card then comes back. */
export function WithdrawConsent({ c }: { c: State }) {
  return (
    <div className={s.row}>
      {/* DRAFT - FOR LEGAL REVIEW: withdraw wording is not final. */}
      <button type="button" className="k-btn k-btn--secondary k-btn--sm" disabled={c.saving} onClick={() => void c.withdraw()}>{c.saving ? "Saving..." : "Withdraw consent"}</button>
      <span className={s.quiet}>Stops sending your questions to the language and search services.</span>
      {c.error ? <p className={s.alert} role="alert">{errorText(c.error)}</p> : null}
    </div>
  );
}
