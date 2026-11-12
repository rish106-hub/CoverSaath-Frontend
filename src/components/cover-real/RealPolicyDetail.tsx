"use client";

import Link from "next/link";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { GROUP_ORDER, groupOf } from "@/components/covers/format";
import { stateOf } from "@/adapters/real-policy";
import s from "@/components/covers/covers.module.css";
import { ErrorBox, FactItem, Loading, Pending, StageBox } from "./parts";
import { usePolicies } from "./use-policies";

/** /policies/[id] for a real account: the holding's facts, each with its status and where it was read. */
export function RealPolicyDetail({ id }: { id: string }) {
  const { state, reload } = usePolicies();
  if (state.kind === "loading") return <Loading what="your policy" />;
  if (state.kind === "error") return <ErrorBox code={state.code} onRetry={reload} />;
  const p = state.kind === "ready" ? state.policies.find((x) => x.id === id) : undefined;
  if (!p) return <EmptyState title="Policy not found" body="This policy is not on your account. Add your policy to see it here." cta="Add a cover" href="/covers/add" />;
  const groups = GROUP_ORDER.map((label) => ({ label, facts: p.facts.filter((f) => groupOf(f.group) === label) })).filter((g) => g.facts.length > 0);
  return (
    <div className={s.stack}>
      <div>
        <Kicker>Your family&rsquo;s cover</Kicker>
        <PageTitle>{p.title}</PageTitle>
        {p.insurer ? <p className={s.quiet}>{p.insurer}</p> : null}
      </div>
      {p.error ? <ErrorBox code={p.error} onRetry={reload} /> : <StageBox p={p} onRetry={reload} />}
      <Pending p={p} />
      {p.stage !== "reading" && p.stage !== "choose_plan" && !p.error && p.facts.length === 0 ? <p className={s.quiet}>Nothing has been read from this policy yet.</p> : null}
      {groups.map((g) => (
        <SectionHeading key={g.label} title={g.label}>
          <ul className={s.facts}>{g.facts.map((f) => <FactItem key={f.key} f={f} />)}</ul>
        </SectionHeading>
      ))}
      {p.notFound > 0 ? <p className={s.quiet}>{p.notFound} {p.notFound === 1 ? "detail was" : "details were"} not found in your document.</p> : null}
      <div className={s.row}>
        <Link className="k-btn k-btn--secondary" href="/policies">All policies</Link>
        <Link className="k-btn k-btn--secondary" href="/chat">Ask about your cover</Link>
      </div>
    </div>
  );
}
