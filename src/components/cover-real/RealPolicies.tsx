"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { Card, Signal } from "@/components/ui";
import type { HeadlineLine, PolicyView } from "@/adapters/real-policy";
import p from "./policies.module.css";
import { CreationIssues, ErrorBox, Loading } from "./parts";
import { usePolicies } from "./use-policies";

/** Four cards fill a 2 x 2 grid on a 1440x900 screen without scrolling; more policies go to the next page. */
const PAGE_SIZE = 4;

function HeadlineSignal({ h }: { h: HeadlineLine }) {
  if (h.tone === "review") return <Signal kind="warn">Needs your decision</Signal>;
  if (h.tone === "missing") return <Signal kind="warn">Not found yet</Signal>;
  return <Signal kind="ok">{h.statusText}</Signal>;
}

/** One state signal per card, first match wins: a load error outranks reading, reading outranks plan choice, then open decisions, then ready. */
function StateSignal({ policy }: { policy: PolicyView }) {
  if (policy.error) return <Signal kind="bad">Could not load. Open to try again.</Signal>;
  if (policy.stage === "reading") return <Signal kind="warn">Still being read</Signal>;
  if (policy.stage === "choose_plan") return <Signal kind="warn">Tell us which plan this is</Signal>;
  const n = policy.pending.length;
  if (n > 0) return <Signal kind="warn">{n === 1 ? "One detail needs your decision" : `${n} details need your decision`}</Signal>;
  return <Signal kind="ok">Read and ready</Signal>;
}

function PolicyGridCard({ policy }: { policy: PolicyView }) {
  const initial = (policy.insurer ?? policy.title).trim().charAt(0).toUpperCase();
  return (
    <Card as="a" href={`/policies/${encodeURIComponent(policy.id)}`} aria-label={policy.title} data-testid="policy-card" className={p.card}>
      <div className={p.top}>
        <span className={p.badge} aria-hidden>{initial}</span>
        <div className={p.names}>
          <h3 className={p.title}>{policy.title}</h3>
          {policy.insurer ? <span className={p.insurer}>{policy.insurer}</span> : null}
        </div>
      </div>
      {policy.headlines.length > 0 ? (
        <div className={p.cells}>
          {policy.headlines.slice(0, 3).map((h) => (
            <div key={h.key} className={p.cell}>
              <span className={p.cellLabel}>{h.label}</span>
              <span className={p.cellValue}>{h.value}</span>
              <HeadlineSignal h={h} />
            </div>
          ))}
        </div>
      ) : null}
      <div className={p.state}><StateSignal policy={policy} /></div>
    </Card>
  );
}

/** /policies for a real account: the stored holdings. The page title is the only heading above the cards; the count replaces a repeated "Your policies" subheading. */
export function RealPolicies() {
  const { state, issues, reload } = usePolicies();
  const [page, setPage] = useState(0);
  return (
    <div className={p.page}>
      <div>
        <PageTitle>My policies</PageTitle>
      </div>
      {state.kind === "loading" ? <Loading what="your policies" /> : null}
      {state.kind === "error" ? <ErrorBox code={state.code} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length > 0 ? <CreationIssues issues={issues} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length === 0 ? <EmptyState title="No policies yet" body="Add a policy and what Knowvia finds in it shows here." cta="Add a policy" href="/covers/add" /> : null}
      {state.kind === "ready" ? (() => {
        const all = state.policies;
        const pages = Math.ceil(all.length / PAGE_SIZE);
        // A reload can shrink the list under the current page; clamp instead of showing an empty grid.
        const at = Math.min(page, pages - 1);
        return (
          <>
            <CreationIssues issues={issues} onRetry={reload} />
            <div className={p.bar}>
              <p className={p.count} data-testid="policy-count">{all.length === 1 ? "1 policy" : `${all.length} policies`}</p>
              <Link className={p.cta} href="/covers/add">Add a policy</Link>
            </div>
            <div className={p.grid}>
              {all.slice(at * PAGE_SIZE, at * PAGE_SIZE + PAGE_SIZE).map((x) => <PolicyGridCard key={x.id} policy={x} />)}
            </div>
            {all.length > PAGE_SIZE ? (
              <div className={p.pager}>
                <button type="button" className={p.outline} disabled={at === 0} onClick={() => setPage(at - 1)}>Back</button>
                <p className={p.pageText} role="status">Page {at + 1} of {pages}</p>
                <button type="button" className={p.outline} disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>Next</button>
              </div>
            ) : null}
          </>
        );
      })() : null}
    </div>
  );
}
