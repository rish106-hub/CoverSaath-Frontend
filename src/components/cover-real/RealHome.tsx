"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { keyFacts } from "@/adapters/real-policy";
import s from "@/components/covers/covers.module.css";
import { CreationIssues, ErrorBox, FactItem, Loading, Pending, StageBox } from "./parts";
import { usePolicies } from "./use-policies";

/** /home body for a real account: the stored cover and its key facts. */
export function RealHome() {
  const { state, issues, reload } = usePolicies();
  if (state.kind === "loading") return <Loading what="your cover" />;
  if (state.kind === "error") return <ErrorBox code={state.code} onRetry={reload} />;
  if (state.kind === "empty" && issues.length > 0) return <div className={s.stack}><CreationIssues issues={issues} onRetry={reload} /></div>;
  if (state.kind === "empty") return <EmptyState title="Nothing here yet" body="Add your policy and Knowvia reads it for you. What was found in it appears here." cta="Add a cover" href="/covers/add" />;
  return (
    <div className={s.stack}>
      <CreationIssues issues={issues} onRetry={reload} />
      <SectionHeading title="Your cover" actions={<Link href="/policies" className="k-btn k-btn--secondary k-btn--sm">All policies</Link>}>
        <div className={s.stack}>
          {state.policies.map((p) => (
            <article key={p.id} className={s.card} aria-label={p.title}>
              <p className={s.lead}><b>{p.title}</b>{p.insurer ? ` · ${p.insurer}` : ""}</p>
              {p.error ? <ErrorBox code={p.error} onRetry={reload} /> : <StageBox p={p} onRetry={reload} />}
              <Pending p={p} />
              {keyFacts(p).length > 0 ? <ul className={s.facts}>{keyFacts(p).map((f) => <FactItem key={f.key} f={f} />)}</ul> : null}
              <div className={s.row}><Link className="k-btn k-btn--secondary" href={`/policies/${encodeURIComponent(p.id)}`}>See all details</Link></div>
            </article>
          ))}
        </div>
      </SectionHeading>
    </div>
  );
}
