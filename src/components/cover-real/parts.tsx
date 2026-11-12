"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { errorText } from "@/adapters/documents-contract";
import { backendCovers } from "@/adapters/covers";
import { backendUploads } from "@/adapters/uploads";
import { pickFile, runTerms } from "@/components/covers/add-cover-flow";
import type { CreationIssue } from "@/adapters/covers-contract";
import type { FactLine, HeadlineLine, PolicyView, Stage } from "@/adapters/real-policy";
import s from "@/components/covers/covers.module.css";

/** What a person can do next, per stage of a holding that has no facts yet. */
export const STAGE_NOTE: Record<Stage, { title: string; body: string; cta?: { label: string; href: string } } | null> = {
  reading: { title: "Still being read", body: "We are reading this document. Check again in a moment. If nothing changes, add the document again.", cta: { label: "Add the document again", href: "/covers/add" } },
  choose_plan: { title: "Tell us which plan this is", body: "Pick your insurer and plan so we can read the right details.", cta: { label: "Choose your plan", href: "/covers/add" } },
  needs_review: null,
  ready: null,
};

/** A coded failure in plain words, with the one next step. */
export function ErrorBox({ code, onRetry }: { code: string; onRetry?: () => void }) {
  const retryable = code !== "HOLDINGS_DISABLED" && code !== "UNAUTHENTICATED";
  return (
    <div className={s.card} role="alert" data-testid="real-error">
      <p className={s.lead}>{errorText(code)}</p>
      <div className={s.row}>
        {retryable && onRetry ? <button type="button" className="k-btn k-btn--secondary" onClick={onRetry}>Try again</button> : null}
        {code === "UNAUTHENTICATED" ? <Link className="k-btn" href="/signin">Sign in</Link> : null}
      </div>
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return <p className={s.quiet} role="status">Loading {what}...</p>;
}

export function StageBox({ p, onRetry }: { p: PolicyView; onRetry?: () => void }) {
  const note = STAGE_NOTE[p.stage];
  if (!note) return null;
  return (
    <div className={s.card} data-testid="stage-note">
      <p className={s.lead}><b>{note.title}.</b> {note.body}</p>
      <div className={s.row}>
        {p.stage === "reading" && onRetry ? <button type="button" className="k-btn k-btn--secondary" onClick={onRetry}>Check again</button> : null}
        {note.cta ? <Link className="k-btn" href={note.cta.href}>{note.cta.label}</Link> : null}
      </div>
    </div>
  );
}

export function FactItem({ f }: { f: FactLine }) {
  return (
    <li className={s.fact} data-open={f.open}>
      <span className={s.factName}>{f.label}</span>
      <span className={s.factValue}>{f.value}</span>
      <span className={s.status}>{f.statusText}</span>
      <span className={s.tag} data-testid="fact-source">{f.sourceText}</span>
      {f.quote ? <p className={s.src}>&ldquo;{f.quote}&rdquo;{f.citation ? ` · ${f.citation}` : ""}</p> : f.citation ? <p className={s.src}>{f.citation}</p> : null}
    </li>
  );
}

/** Insurer and product, then the three headline values with their honest status. Nothing before the product is confirmed: the choose-plan note stands in. */
export function Headlines({ p }: { p: PolicyView }) {
  if (p.headlines.length === 0) return null;
  return (
    <ul className={s.facts} data-testid="headlines">
      {p.headlines.map((h) => <HeadlineItem key={h.key} h={h} holdingId={p.id} />)}
    </ul>
  );
}

function HeadlineItem({ h, holdingId }: { h: HeadlineLine; holdingId: string }) {
  return (
    <li className={s.fact} data-open={h.tone === "review" || h.tone === "missing"} data-tone={h.tone} data-testid={`headline-${h.key}`}>
      <span className={s.factName}>{h.label}</span>
      <span className={s.factValue}>{h.value}</span>
      <span className={s.status}>{h.statusText}</span>
      {h.tone === "review" ? <Link className="k-btn k-btn--secondary k-btn--sm" href={`/covers/review?holding=${encodeURIComponent(holdingId)}`}>Review and decide</Link> : null}
    </li>
  );
}

export function Pending({ p }: { p: PolicyView }): ReactNode {
  if (p.pending.length === 0) return null;
  return (
    <div className={s.card} data-testid="pending-conflicts">
      <p className={s.lead}>{p.pending.length === 1 ? "One detail needs your decision" : `${p.pending.length} details need your decision`}: {p.pending.map((c) => c.label).join(", ")}.</p>
      <div className={s.row}><Link className="k-btn" href={`/covers/review?holding=${encodeURIComponent(p.id)}`}>Review and decide</Link></div>
    </div>
  );
}

/** Documents the backend could not turn into a policy yet. `retrying` is still being read; `failed` needs the person to add it again. */
export function CreationIssues({ issues, onRetry }: { issues: CreationIssue[]; onRetry?: () => void }) {
  if (issues.length === 0) return null;
  const failed = issues.filter((i) => i.state === "failed").length;
  const retrying = issues.length - failed;
  return (
    <>
      {retrying > 0 ? (
        <div className={s.card} role="status" data-testid="creation-retrying">
          <p className={s.lead}><b>Still being read.</b> {retrying === 1 ? "A document you added is" : `${retrying} documents you added are`} still being read. Check again in a moment.</p>
          {onRetry ? <div className={s.row}><button type="button" className="k-btn k-btn--secondary" onClick={onRetry}>Check again</button></div> : null}
        </div>
      ) : null}
      {failed > 0 ? (
        <div className={s.card} role="alert" data-testid="creation-failed">
          <p className={s.lead}><b>We could not read {failed === 1 ? "a document" : `${failed} documents`}.</b> {errorText("HOLDING_CREATE_FAILED")}</p>
          <div className={s.row}><Link className="k-btn" href="/covers/add">Add the document again</Link></div>
        </div>
      ) : null}
    </>
  );
}

export const TERMS_TEXT: Record<PolicyView["wordingState"], string> = {
  fss: "Insurer terms attached (verified)",
  manual: "Insurer terms added by you",
  missing: "Insurer terms not attached yet",
};

/**
 * Where the insurer's terms stand. When they are not attached, "Add the terms yourself" takes the person's own PDF through the
 * existing wording flow: upload as the terms, then link to this holding (the same documents route as before). The backend then
 * reports `manual`, so the page asks again once the link is made.
 */
export function TermsStatus({ p, onAdded }: { p: PolicyView; onAdded?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  async function take(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setCode(null);
    try {
      const type = (await backendUploads.list()).policyType;
      if (!type) { setCode("POLICY_TYPE_INVALID"); return; }
      const slot = await runTerms(backendCovers, pickFile(file), type, p.id);
      if (slot.status === "done") onAdded?.();
      else setCode(slot.code ?? "BACKEND_UNREACHABLE");
    } catch (e) {
      setCode(e && typeof e === "object" && "code" in e && typeof e.code === "string" ? e.code : "BACKEND_UNREACHABLE");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className={s.row} data-testid="terms-status" data-state={p.wordingState}>
      <span className={s.lead} role="status">{busy ? "Adding your terms\u2026" : TERMS_TEXT[p.wordingState]}</span>
      {p.wordingState === "missing" ? (
        <>
          <button type="button" className="k-btn k-btn--secondary k-btn--sm" disabled={busy} onClick={() => input.current?.click()}>Add the terms yourself</button>
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden aria-label="Policy terms PDF" data-testid="terms-input" onChange={(e) => void take(e.target.files?.[0])} />
        </>
      ) : null}
      {code ? <p className={s.alert} role="alert">{errorText(code)}</p> : null}
    </div>
  );
}
