"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { errorText } from "@/adapters/documents-contract";
import { backendCovers } from "@/adapters/covers";
import { backendUploads } from "@/adapters/uploads";
import { pickFile, runTerms } from "@/components/covers/add-cover-flow";
import type { CreationIssue } from "@/adapters/covers-contract";
import { keyFacts, type FactLine, type HeadlineLine, type PolicyView, type Stage } from "@/adapters/real-policy";
import { Skeleton } from "@/components/ui/Skeleton";
import s from "@/components/covers/covers.module.css";

/** What a person can do next, per stage of a holding that has no facts yet. */
export const STAGE_NOTE: Record<Stage, { title: string; body: string; cta?: { label: string; href: string } } | null> = {
  reading: { title: "Still being read", body: "We are reading this document. Check again in a moment. If nothing changes, add the document again.", cta: { label: "Add the document again", href: "/covers/add" } },
  choose_plan: { title: "Tell us which plan this is", body: "Pick your insurer and plan so we can read the right details.", cta: { label: "Choose your plan", href: "/covers/add?resume=1" } },
  needs_review: null,
  ready: null,
};

/** A coded failure in plain words, with the one next step. */
export function ErrorBox({ code, onRetry }: { code: string; onRetry?: () => void }) {
  const retryable = code !== "HOLDINGS_DISABLED" && code !== "UNAUTHENTICATED";
  return (
    <div className={`${s.note} ${s.noteAlert}`} role="alert" data-testid="real-error">
      <p className={s.lead}>{errorText(code)}</p>
      <div className={s.row}>
        {retryable && onRetry ? <button type="button" className="k-btn k-btn--secondary" onClick={onRetry}>Try again</button> : null}
        {code === "UNAUTHENTICATED" ? <Link className="k-btn" href="/signin">Sign in</Link> : null}
      </div>
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  void what; // kept for call-site compatibility; the skeleton replaces the sentence.
  return <Skeleton shape="bento" />;
}

export function StageBox({ p, onRetry }: { p: PolicyView; onRetry?: () => void }) {
  const note = STAGE_NOTE[p.stage];
  if (!note) return null;
  return (
    <div className={s.note} data-testid="stage-note">
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
    <ul className={s.heads} data-testid="headlines">
      {p.headlines.map((h) => <HeadlineItem key={h.key} h={h} holdingId={p.id} />)}
    </ul>
  );
}

function HeadlineItem({ h, holdingId }: { h: HeadlineLine; holdingId: string }) {
  return (
    <li className={s.head} data-open={h.tone === "review" || h.tone === "missing"} data-tone={h.tone} data-testid={`headline-${h.key}`}>
      <span className={s.factName}>{h.label}</span>
      <span className={s.headValue}>{h.value}</span>
      <span className={s.status}>{h.statusText}</span>
      {h.tone === "review" ? <Link className="k-btn k-btn--secondary k-btn--sm" href={`/covers/review?holding=${encodeURIComponent(holdingId)}`}>Review and decide</Link> : null}
    </li>
  );
}

export function Pending({ p }: { p: PolicyView }): ReactNode {
  if (p.pending.length === 0) return null;
  return (
    <div className={s.note} data-testid="pending-conflicts">
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
 * The backend answers wordingState `missing` with wordingReason `not_checked` while an FSS handoff is open, and `pending` for the
 * few seconds after a holding is ready while the insurer pack is pulled. Either way the insurer's wording has not been looked up
 * yet: that is waiting, not an error and not "not attached". FOR LEGAL REVIEW: wording not final.
 */
export const isWaitingForWording = (p: Pick<PolicyView, "wordingState" | "wordingReason">): boolean => p.wordingState === "missing" && (p.wordingReason === "pending" || p.wordingReason === "not_checked");
// FOR LEGAL REVIEW: wording not final.
export const WAITING_TEXT = "Insurer terms loading\u2026";

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
    <div className={s.row} data-testid="terms-status" data-state={isWaitingForWording(p) ? "waiting" : p.wordingState}>
      <span className={s.lead} role="status">{busy ? "Adding your terms\u2026" : isWaitingForWording(p) ? WAITING_TEXT : TERMS_TEXT[p.wordingState]}</span>
      {p.wordingState === "missing" && p.wordingReason !== "pending" ? (
        <>
          <button type="button" className="k-btn k-btn--secondary k-btn--sm" disabled={busy} onClick={() => input.current?.click()}>Add the terms yourself</button>
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden aria-label="Policy terms PDF" data-testid="terms-input" onChange={(e) => void take(e.target.files?.[0])} />
        </>
      ) : null}
      {code ? <p className={s.alert} role="alert">{errorText(code)}</p> : null}
    </div>
  );
}

/** Accent colours for the top rule of each policy card, cycled in order. Group tokens only. */
const CARD_ACCENTS = ["var(--harbour)", "var(--sea-glass)", "var(--ochre)"];

/**
 * One holding as a visual card: accent rule, insurer badge, product as a heading, the three headline values, then what needs doing.
 * `withPending` shows the decision note on home; the list leaves it to the headline row link. Every value comes from the holding.
 */
export function PolicyCard({ p, index, onRetry, linkLabel, withPending = false }: { p: PolicyView; index: number; onRetry?: () => void; linkLabel: string; withPending?: boolean }) {
  const facts = keyFacts(p);
  const initial = (p.insurer ?? p.title).trim().charAt(0).toUpperCase();
  return (
    <article className={s.policyCard} style={{ borderTopColor: CARD_ACCENTS[index % CARD_ACCENTS.length] }} aria-label={p.title}>
      <div className={s.policyTop}>
        <span className={s.badge} aria-hidden>{initial}</span>
        <div className={s.policyName}>
          <h3 className={s.policyTitle}>{p.title}</h3>
          {p.insurer ? <span className={s.quiet}>{p.insurer}</span> : null}
        </div>
      </div>
      <Headlines p={p} />
      {p.error ? <ErrorBox code={p.error} onRetry={onRetry} /> : <StageBox p={p} onRetry={onRetry} />}
      {withPending ? <Pending p={p} /> : null}
      {facts.length > 0 ? <ul className={s.facts}>{facts.map((f) => <FactItem key={f.key} f={f} />)}</ul> : null}
      <div className={s.row}><Link className="k-btn k-btn--secondary" href={`/policies/${encodeURIComponent(p.id)}`}>{linkLabel}</Link></div>
    </article>
  );
}

/** The one thing to do next across the account, picked by urgency. Null when there is nothing to do but ask. */
export type NextStep = { label: string; detail: string; href: string };
export function nextStepOf(policies: PolicyView[]): NextStep {
  const open = policies.find((x) => x.pending.length > 0);
  if (open) return { label: "Decide on open details", detail: open.pending.length === 1 ? "One detail needs your decision" : `${open.pending.length} details need your decision`, href: `/covers/review?holding=${encodeURIComponent(open.id)}` };
  const plan = policies.find((x) => x.stage === "choose_plan");
  if (plan) return { label: "Pick your plan", detail: "So we read the right details", href: "/covers/add?resume=1" };
  const first = policies[0];
  return { label: "Ask about your cover", detail: "Questions answered from your policy", href: `/chat?holding=${encodeURIComponent(first.id)}` };
}

/**
 * Dark band at the top of /home. Tiles are the first policy's headline values that were found (a missing or conflicting value is left out, never
 * faked; the conflict is the next step), the policy count, and the next step. With several policies the tile detail names the policy so a value is never unplaced.
 */
export function GlanceBand({ policies }: { policies: PolicyView[] }) {
  const first = policies[0];
  const many = policies.length > 1;
  const found = first.headlines.filter((h) => h.tone === "read" || h.tone === "confirmed");
  const next = nextStepOf(policies);
  const to = `/policies/${encodeURIComponent(first.id)}`;
  return (
    <section className={s.glance} aria-label="Your cover at a glance" data-testid="glance">
      <div className={s.tiles}>
        <Link href="/policies" className={s.tile}>
          <span className={s.tileHead}><b>Policies</b></span>
          <span className={s.tileValue}>{policies.length}</span>
          <span className={s.tileDetail}>{many ? "on your account" : "on your account, read for you"}</span>
        </Link>
        {found.map((h) => (
          <Link key={h.key} href={to} className={`${s.tile} ${s.tileLight}`}>
            <span className={s.tileHead}><b>{h.label}</b></span>
            <span className={`${s.tileValue} ${h.key === "policy_period" ? s.tileValueSm : ""}`}>{h.value}</span>
            <span className={s.tileDetail}>{many ? `${h.statusText}, ${first.title}` : h.statusText}</span>
          </Link>
        ))}
        <Link href={next.href} className={`${s.tile} ${s.tileMarker}`}>
          <span className={s.tileHead}><b>Next step</b></span>
          <span className={s.tileValueSm}>{next.label}</span>
          <span className={s.tileDetail}>{next.detail}</span>
        </Link>
      </div>
    </section>
  );
}
