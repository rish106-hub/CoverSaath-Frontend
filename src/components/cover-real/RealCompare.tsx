"use client";

import Link from "next/link";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import type { PolicyView } from "@/adapters/real-policy";
import s from "@/components/covers/covers.module.css";
import r from "./real.module.css";
import { CreationIssues, ErrorBox, Loading } from "./parts";
import { usePolicies } from "./use-policies";

type Row = { key: string; label: string; cells: { value: string; open: boolean }[] };

/** Rows for a side-by-side: the headlines, then every fact read from any of the policies. Only what the backend returned. */
export function compareRows(policies: PolicyView[]): Row[] {
  const rows: Row[] = [];
  for (const k of ["sum_insured", "policy_period", "premium_total"] as const) {
    const first = policies.flatMap((p) => p.headlines).find((h) => h.key === k);
    if (!first) continue;
    rows.push({ key: k, label: first.label, cells: policies.map((p) => { const h = p.headlines.find((x) => x.key === k); return { value: h?.value ?? "Not found yet", open: !h || h.tone === "missing" || h.tone === "review" }; }) });
  }
  const headKeys = new Set(["sum_insured", "policy_period", "premium_total"]);
  const keys: { key: string; label: string; limits: boolean }[] = [];
  for (const p of policies) for (const f of p.facts) if (f.status !== "unknown" && !headKeys.has(f.key) && !keys.some((x) => x.key === f.key)) keys.push({ key: f.key, label: f.label, limits: f.group === "limits" });
  keys.sort((a, b) => Number(b.limits) - Number(a.limits));
  for (const k of keys.slice(0, 40)) {
    rows.push({ key: k.key, label: k.label, cells: policies.map((p) => { const f = p.facts.find((x) => x.key === k.key && x.status !== "unknown"); return { value: f?.value ?? "Not found", open: !f || f.open }; }) });
  }
  return rows;
}

/** /compare for a real account: the household's own policies side by side, from what was read from them. */
export function RealCompare() {
  const { state, issues, reload } = usePolicies();
  return (
    <div className={s.stack}>
      <div>
        <Kicker>Compare plans</Kicker>
        <PageTitle>Your policies side by side</PageTitle>
      </div>
      {state.kind === "loading" ? <Loading what="your policies" /> : null}
      {state.kind === "error" ? <ErrorBox code={state.code} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length > 0 ? <CreationIssues issues={issues} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length === 0 ? <EmptyState title="Compare starts from your own policy" body="Upload your policy and Knowvia reads it for you." /> : null}
      {state.kind === "ready" ? <Ready policies={state.policies} /> : null}
    </div>
  );
}

function Ready({ policies }: { policies: PolicyView[] }) {
  const readable = policies.filter((p) => p.stage === "ready" || p.stage === "needs_review");
  const rows = compareRows(readable);
  return (
    <>
      {readable.length < 2 ? <p className={s.quiet}>{readable.length === 0 ? "Your policies are still being read." : "You have one policy to compare. Add another cover to see them side by side."}</p> : null}
      {readable.length > 0 ? (
        <SectionHeading title="Section by section">
          <div className={r.table} role="table" aria-label="Policies side by side" style={{ ["--cols" as string]: readable.length }}>
            <div className={r.trow} role="row">
              <span className={r.rowName} role="columnheader">Policy</span>
              {readable.map((p) => <span key={p.id} className={r.head} role="columnheader">{p.title}{p.insurer ? ` · ${p.insurer}` : ""}</span>)}
            </div>
            {rows.map((row) => (
              <div key={row.key} className={r.trow} role="row">
                <span className={r.rowName} role="rowheader">{row.label}</span>
                {row.cells.map((c, i) => <span key={i} className={`${r.cell} ${c.open ? r.cellOpen : ""}`} role="cell">{c.value}</span>)}
              </div>
            ))}
          </div>
        </SectionHeading>
      ) : null}
      <div className={s.row}>
        <Link className="k-btn k-btn--secondary" href="/covers/add">Add a cover</Link>
        <Link className="k-btn k-btn--secondary" href="/stress-test">Stress test a policy</Link>
      </div>
    </>
  );
}
