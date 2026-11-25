"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import s from "@/components/covers/covers.module.css";
import { CreationIssues, ErrorBox, GlanceBand, Loading, PolicyCard } from "./parts";
import { usePolicies } from "./use-policies";

/** /home body for a real account: a glance band and one visual card per stored policy, in the same shape as the designed demo home. */
export function RealHome() {
  const { state, issues, reload } = usePolicies();
  if (state.kind === "loading") return <Loading what="your cover" />;
  if (state.kind === "error") return <ErrorBox code={state.code} onRetry={reload} />;
  if (state.kind === "empty" && issues.length > 0) return <div className={s.stack}><CreationIssues issues={issues} onRetry={reload} /></div>;
  if (state.kind === "empty") return <EmptyState title="Nothing here yet" body="Add your policy and Knowvia reads it for you. What was found in it appears here." cta="Add a cover" href="/covers/add" />;
  return (
    <div className={s.stack}>
      <CreationIssues issues={issues} onRetry={reload} />
      <SectionHeading title="Your cover at a glance">
        <GlanceBand policies={state.policies} />
      </SectionHeading>
      <SectionHeading title="Your policies" actions={<Link href="/policies" className="k-btn k-btn--secondary k-btn--sm">All policies</Link>}>
        <div className={s.policyGrid}>
          {state.policies.map((p, i) => (
            <PolicyCard key={p.id} p={p} index={i} onRetry={reload} linkLabel="See all details" withPending />
          ))}
        </div>
      </SectionHeading>
    </div>
  );
}
