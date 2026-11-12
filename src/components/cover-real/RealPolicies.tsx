"use client";

import Link from "next/link";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { keyFacts } from "@/adapters/real-policy";
import { EmptyState } from "@/components/shell/EmptyState";
import s from "@/components/covers/covers.module.css";
import { CreationIssues, ErrorBox, FactItem, Loading, StageBox } from "./parts";
import { usePolicies } from "./use-policies";

/** /policies for a real account: the stored holdings. */
export function RealPolicies() {
  const { state, issues, reload } = usePolicies();
  return (
    <div className={s.stack}>
      <div>
        <Kicker>Your family&rsquo;s cover</Kicker>
        <PageTitle>My policies</PageTitle>
      </div>
      <SectionHeading title="Your policies">
        {state.kind === "loading" ? <Loading what="your policies" /> : null}
        {state.kind === "error" ? <ErrorBox code={state.code} onRetry={reload} /> : null}
        {state.kind === "empty" && issues.length > 0 ? <CreationIssues issues={issues} onRetry={reload} /> : null}
        {state.kind === "empty" && issues.length === 0 ? <EmptyState title="No policies yet" body="Add your policy and Knowvia reads it for you. It shows here with what was found in it." cta="Add a cover" href="/covers/add" /> : null}
        {state.kind === "ready" ? (
          <div className={s.stack}>
            <CreationIssues issues={issues} onRetry={reload} />
            {state.policies.map((p) => (
              <article key={p.id} className={s.card} aria-label={p.title}>
                <p className={s.lead}><b>{p.title}</b>{p.insurer ? ` · ${p.insurer}` : ""}</p>
                {p.error ? <ErrorBox code={p.error} onRetry={reload} /> : <StageBox p={p} onRetry={reload} />}
                {keyFacts(p).length > 0 ? <ul className={s.facts}>{keyFacts(p).map((f) => <FactItem key={f.key} f={f} />)}</ul> : null}
                <div className={s.row}><Link className="k-btn k-btn--secondary" href={`/policies/${encodeURIComponent(p.id)}`}>Open policy</Link></div>
              </article>
            ))}
          </div>
        ) : null}
      </SectionHeading>
    </div>
  );
}
