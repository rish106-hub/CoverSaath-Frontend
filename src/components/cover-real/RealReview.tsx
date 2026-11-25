"use client";

import Link from "next/link";
import { PageTitle, SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import s from "@/components/covers/covers.module.css";
import { CreationIssues, ErrorBox, Loading } from "./parts";
import { usePolicies } from "./use-policies";

/** /review for a real account: what in the stored policies needs the owner's decision (open conflicts), each leading to the place to settle it. */
export function RealReview() {
  const { state, issues, reload } = usePolicies();
  const open = state.kind === "ready" ? state.policies.flatMap((p) => p.pending.map((c) => ({ ...c, policy: p }))) : [];
  const waiting = state.kind === "ready" ? state.policies.filter((p) => p.stage === "reading" || p.stage === "choose_plan") : [];
  return (
    <div className={s.stack}>
      <div>
        <PageTitle>{state.kind === "ready" ? (open.length ? `${open.length} thing${open.length === 1 ? "" : "s"} need${open.length === 1 ? "s" : ""} your decision` : "Nothing needs your decision") : "Things to check"}</PageTitle>
      </div>
      {state.kind === "loading" ? <Loading what="what to check" /> : null}
      {state.kind === "error" ? <ErrorBox code={state.code} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length > 0 ? <CreationIssues issues={issues} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length === 0 ? <EmptyState title="Nothing to check yet" body="Anything that needs your decision shows up here." /> : null}
      {state.kind === "ready" ? (
        <>
          {open.length > 0 ? (
            <SectionHeading title="Decisions" description="Two readings of the same thing do not match. You choose.">
              <div className={s.stack}>
                {open.map((c) => (
                  <article key={c.id} className={s.card} aria-label={c.label}>
                    <p className={s.lead}><b>{c.label}</b> · {c.policy.title}{c.policy.insurer ? ` · ${c.policy.insurer}` : ""}</p>
                    <div className={s.row}><Link className="k-btn k-btn--primary" href={`/covers/review?holding=${encodeURIComponent(c.policy.id)}`}>Decide</Link></div>
                  </article>
                ))}
              </div>
            </SectionHeading>
          ) : <p className={s.quiet} role="status">Everything read from your policies matches. Nothing is waiting for you.</p>}
          {waiting.length > 0 ? (
            <SectionHeading title="Still being set up">
              <div className={s.stack}>
                {waiting.map((p) => (
                  <article key={p.id} className={s.card} aria-label={p.title}>
                    <p className={s.lead}><b>{p.title}</b>{p.insurer ? ` · ${p.insurer}` : ""}</p>
                    <div className={s.row}><Link className="k-btn k-btn--secondary" href={p.stage === "choose_plan" ? "/covers/add?resume=1" : `/policies/${encodeURIComponent(p.id)}`}>{p.stage === "choose_plan" ? "Choose your plan" : "Open policy"}</Link></div>
                  </article>
                ))}
              </div>
            </SectionHeading>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
