"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PageTitle } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { Signal, Switch } from "@/components/ui";
import type { PolicyView } from "@/adapters/real-policy";
import t from "./tools.module.css";
import { CreationIssues, ErrorBox, Loading } from "./parts";
import { usePolicies } from "./use-policies";
import { useFit } from "./use-fit";

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
    <div className={t.page}>
      {/* A ready screen carries its own title (it differs with the number of readable policies and sits beside the switch). */}
      {state.kind !== "ready" ? <PageTitle>Your policies side by side</PageTitle> : null}
      {state.kind === "loading" ? <Loading what="your policies" /> : null}
      {state.kind === "error" ? <ErrorBox code={state.code} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length > 0 ? <CreationIssues issues={issues} onRetry={reload} /> : null}
      {state.kind === "empty" && issues.length === 0 ? <EmptyState title="Add a policy to compare" body="Knowvia reads it, then compares section by section." /> : null}
      {state.kind === "ready" ? <Ready policies={state.policies} /> : null}
    </div>
  );
}

function Ready({ policies }: { policies: PolicyView[] }) {
  const readable = policies.filter((p) => p.stage === "ready" || p.stage === "needs_review");
  if (readable.length === 0) {
    return (
      <>
        <PageTitle>Your policies side by side</PageTitle>
        <p className={t.line}>Your policies are still being read.</p>
      </>
    );
  }
  if (readable.length === 1) {
    return (
      <>
        <PageTitle>You have one policy. Add another to see them side by side.</PageTitle>
        <div><Link className={t.cta} href="/covers/add">Add a policy</Link></div>
      </>
    );
  }
  return <SideBySide readable={readable} />;
}

/** Two or three policies as columns. Only the first three are shown: a fourth column would be too narrow to read on a laptop. */
function SideBySide({ readable }: { readable: PolicyView[] }) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [page, setPage] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Rows are 50px; as many as the body is tall enough for, between three and ten, so no row is ever cut by the box.
  const perPage = useFit(bodyRef, 50, 3, 10);
  const shown = readable.slice(0, 3);
  const rows = compareRows(shown).map((row) => ({ row, same: row.cells.every((c) => c.value === row.cells[0].value) }));
  const visible = onlyDiff ? rows.filter((x) => !x.same) : rows;
  const pages = Math.max(1, Math.ceil(visible.length / perPage));
  // A resize can make pages fewer than the current one; clamp instead of showing an empty body.
  const at = Math.min(page, pages - 1);
  return (
    <>
      <div className={t.head}>
        <PageTitle>Your policies side by side</PageTitle>
        <Switch label="Only what differs" checked={onlyDiff} onChange={(v) => { setOnlyDiff(v); setPage(0); }} />
      </div>
      {readable.length > 3 ? <p className={t.line}>Showing your first three policies.</p> : null}
      <div className={t.table} role="table" aria-label="Policies side by side" data-testid="compare-table" style={{ ["--cols" as string]: shown.length }}>
        <div className={`${t.trow} ${t.thead}`} role="row">
          <span role="columnheader" />
          {shown.map((p) => (
            <span key={p.id} role="columnheader" className={t.policyHead}>
              <span className={t.policyName} data-truncate title={p.title}>{p.title}</span>
              {p.insurer ? <span className={t.policyInsurer} data-truncate title={p.insurer}>{p.insurer}</span> : null}
            </span>
          ))}
        </div>
        <div ref={bodyRef} className={t.body}>
          {visible.length === 0 ? <p className={t.line}>These policies match on everything Knowvia read.</p> : null}
          {visible.slice(at * perPage, at * perPage + perPage).map(({ row, same }) => (
            <div key={row.key} className={`${t.trow} ${t.brow}`} role="row" data-same={same}>
              <span className={t.rowLabel} role="rowheader">{row.label}</span>
              {row.cells.map((c, i) => (
                <span key={i} className={t.cell} role="cell" data-open={c.open}>{c.open ? <Signal kind="warn">{c.value}</Signal> : c.value}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={t.foot}>
        <Link className={t.textLink} href="/stress-test">Run a hospital bill through them</Link>
        {visible.length > perPage ? (
          <div className={t.pager}>
            <button type="button" className={t.outline} disabled={at === 0} onClick={() => setPage(at - 1)}>Back</button>
            <p className={t.pageText} role="status">Page {at + 1} of {pages}</p>
            <button type="button" className={t.outline} disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>Next</button>
          </div>
        ) : null}
      </div>
    </>
  );
}
