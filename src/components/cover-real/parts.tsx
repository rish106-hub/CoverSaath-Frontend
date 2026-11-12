"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { errorText } from "@/adapters/documents-contract";
import type { FactLine, PolicyView, Stage } from "@/adapters/real-policy";
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
      {f.quote ? <p className={s.src}>&ldquo;{f.quote}&rdquo;{f.citation ? ` · ${f.citation}` : ""}</p> : f.citation ? <p className={s.src}>{f.citation}</p> : null}
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
