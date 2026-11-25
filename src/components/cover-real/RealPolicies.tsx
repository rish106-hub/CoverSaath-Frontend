"use client";

import { Kicker, PageTitle } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import s from "@/components/covers/covers.module.css";
import { CreationIssues, ErrorBox, Loading, PolicyCard } from "./parts";
import { usePolicies } from "./use-policies";

/** /policies for a real account: the stored holdings. The page title is the only heading above the cards; the count replaces a repeated "Your policies" subheading. */
export function RealPolicies() {
  const { state, issues, reload } = usePolicies();
  return (
    <div className={s.stack}>
      <div>
        <Kicker>Your family&rsquo;s cover</Kicker>
        <PageTitle>My policies</PageTitle>
      </div>
      {state.kind === "loading" ? <Loading what="your policies" /> : null}
      {state.kind === "error" ? <ErrorBox code={state.code} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length > 0 ? <CreationIssues issues={issues} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length === 0 ? <EmptyState title="No policies yet" body="Add your policy and Knowvia reads it for you. It shows here with what was found in it." cta="Add a cover" href="/covers/add" /> : null}
      {state.kind === "ready" ? (
        <>
          <CreationIssues issues={issues} onRetry={reload} />
          <p className={s.quiet} data-testid="policy-count">{state.policies.length === 1 ? "1 policy" : `${state.policies.length} policies`}</p>
          <div className={s.policyGrid}>
            {state.policies.map((p, i) => <PolicyCard key={p.id} p={p} index={i} onRetry={reload} linkLabel="Open policy" />)}
          </div>
        </>
      ) : null}
    </div>
  );
}
