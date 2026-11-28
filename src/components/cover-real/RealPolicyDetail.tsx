"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/shell/EmptyState";
import { Card, Signal, Tabs } from "@/components/ui";
import { GROUP_ORDER, groupOf } from "@/components/covers/format";
import { labelOf } from "@/lib/fact-labels";
import { MemoryDocument } from "./MemoryDocument";
import { PassageSearch } from "./PassageSearch";
import { isWaitingForWording, ErrorBox, Loading, Pending, StageBox, TermsStatus } from "./parts";
import type { FactLine, PolicyView } from "@/adapters/real-policy";
import { usePolicies } from "./use-policies";
import { useFit } from "./use-fit";
import p from "./policies.module.css";

/** Six rows is the most a group panel shows on one page; a shorter panel shows fewer (useFit, spec R5b.7) and the rest go to the next page. */
const FACT_PAGE = 6;

const tabIdOf = (label: string) => label.toLowerCase().replace(/ /g, "-");

/** One fact as a row of three: what it is, what was read (a yellow dot and the status while it still needs the person), and where it was read. */
function FactRow({ f }: { f: FactLine }) {
  // An insurer-tier citation is the page alone (real-policy.ts), so the tier label goes in front: a reading from the insurer's wording
  // must never look like one from the person's own document (ADR 0036).
  const source = f.citation ? (f.citation.startsWith("Page ") ? `${f.sourceText}, ${f.citation}` : f.citation) : f.sourceText;
  return (
    <li className={p.factRow} data-open={f.open}>
      <span className={p.factLabel}>{f.label}</span>
      <span className={p.factValue}>
        {f.open ? <Signal kind="warn"><span className={p.factValueText}>{f.value}</span></Signal> : f.value}
        {f.open ? <span className={p.factStatus}>{f.statusText}</span> : null}
      </span>
      <span className={p.factSource} data-testid="fact-source">{source}</span>
    </li>
  );
}

/**
 * Facts of one group as rows, as many to a page as the panel is tall enough for. The panel is the tab panel itself so that its height is measured
 * where the rows live; a hidden panel measures 0 and shows the maximum until it is opened. Keyed by group so each group keeps its own page.
 */
function GroupPanel({ id, hidden, facts }: { id: string; hidden: boolean; facts: FactLine[] }) {
  const [page, setPage] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const perPage = useFit(panelRef, 58, 2, FACT_PAGE);
  const pages = Math.ceil(facts.length / perPage);
  // A taller or shorter panel changes the page size under the current page; clamp instead of showing an empty page.
  const at = Math.min(page, pages - 1);
  return (
    <div ref={panelRef} role="tabpanel" data-panel={id} className={`${p.panel} ${p.groupPanel}`} hidden={hidden}>
      <ul className={p.rows}>{facts.slice(at * perPage, at * perPage + perPage).map((f) => <FactRow key={f.key} f={f} />)}</ul>
      {facts.length > perPage ? (
        <div className={p.pager}>
          <button type="button" className={p.outline} disabled={at === 0} onClick={() => setPage(at - 1)}>Back</button>
          <p className={p.pageText} role="status">Page {at + 1} of {pages}</p>
          <button type="button" className={p.outline} disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}

/** The three headline values in one row inside the header card. A reading that conflicts links to the decision; a missing one says so beside its value. */
function HeadlineRow({ policy }: { policy: PolicyView }) {
  return (
    <ul className={p.headlines} data-testid="headlines">
      {policy.headlines.map((h) => (
        <li key={h.key} className={p.headItem} data-testid={`headline-${h.key}`} data-tone={h.tone}>
          <span className={p.headLabel}>{h.label}</span>
          <span className={p.headValue} style={h.tone === "review" ? { color: "var(--warn-ink, var(--ink))" } : undefined}>{h.value}</span>
          {h.tone === "review" ? <Link className={p.inlineLink} href={`/covers/review?holding=${encodeURIComponent(policy.id)}`}>Review and decide</Link> : null}
          {h.tone === "missing" ? <Signal kind="warn">Not found yet</Signal> : null}
        </li>
      ))}
    </ul>
  );
}

/** /policies/[id] for a real account: a header card with the three main numbers, then one group of facts at a time, with where each was read. */
export function RealPolicyDetail({ id }: { id: string }) {
  const { state, reload, refresh } = usePolicies();
  const [selected, setSelected] = useState("");
  const waiting = state.kind === "ready" && state.policies.some((x) => x.id === id && isWaitingForWording(x));
  // While the insurer's wording is awaited, ask again now and then (quietly) so the insurer facts appear when the state turns to fss. Stops after about 3 minutes.
  useEffect(() => {
    if (!waiting) return;
    let n = 0;
    const t = setInterval(() => { n += 1; if (n > 18) clearInterval(t); else refresh(); }, 10_000);
    return () => clearInterval(t);
  }, [waiting, refresh]);
  if (state.kind === "loading") return <Loading what="your policy" />;
  if (state.kind === "error") return <ErrorBox code={state.code} onRetry={reload} />;
  const policy = state.kind === "ready" ? state.policies.find((x) => x.id === id) : undefined;
  if (!policy) return <EmptyState title="Policy not found" body="This policy isn't on your account." cta="Add a policy" href="/covers/add" />;
  const groups = GROUP_ORDER.map((label) => ({ label, facts: policy.facts.filter((f) => groupOf(f.group) === label) })).filter((g) => g.facts.length > 0);
  const hasTerms = policy.stage === "needs_review" || policy.stage === "ready";
  const tabs = [
    ...groups.map((g) => ({ id: tabIdOf(g.label), label: g.label })),
    ...(policy.notFound > 0 ? [{ id: "not-found", label: `Not found (${policy.notFound})` }] : []),
    ...(hasTerms ? [{ id: "terms", label: "Insurer terms" }] : []),
  ];
  // The first tab starts selected. A refresh can drop the tab the person is on (for example a group that no longer has facts); fall back to the first tab.
  const active = tabs.some((t) => t.id === selected) ? selected : (tabs[0]?.id ?? "");
  return (
    <div className={p.detail}>
      <div className={p.leftCol}>
        {policy.error ? <ErrorBox code={policy.error} onRetry={reload} /> : <StageBox p={policy} onRetry={reload} />}
        <Pending p={policy} />
        <Card className={p.headerCard}>
          {policy.insurer ? <Signal kind="ok">{policy.insurer}</Signal> : null}
          <h1 className={p.name}>{policy.title}</h1>
          {policy.headlines.length > 0 ? <HeadlineRow policy={policy} /> : null}
        </Card>
        {tabs.length > 0 ? (
          <>
            <Tabs label="Policy sections" tabs={tabs} value={active} onChange={setSelected} />
            {groups.map((g) => <GroupPanel key={g.label} id={tabIdOf(g.label)} hidden={active !== tabIdOf(g.label)} facts={g.facts} />)}
            {policy.notFound > 0 ? (
              <div role="tabpanel" data-panel="not-found" className={p.panel} hidden={active !== "not-found"}>
                <ul className={p.missing}>{policy.notFoundKeys.map((k) => <li key={k}>{labelOf(k)}</li>)}</ul>
              </div>
            ) : null}
            {hasTerms ? (
              <div role="tabpanel" data-panel="terms" className={`${p.panel} ${p.terms}`} hidden={active !== "terms"}>
                <MemoryDocument holdingId={policy.id} />
              </div>
            ) : null}
          </>
        ) : (
          <p className={p.note}>Nothing has been read from this policy yet.</p>
        )}
      </div>
      <div className={p.rightCol}>
        {hasTerms ? <PassageSearch holdingId={policy.id} /> : null}
        {hasTerms ? <TermsStatus p={policy} onAdded={reload} /> : null}
        <Link className={`${p.cta} ${p.wide}`} href={`/chat?holding=${encodeURIComponent(policy.id)}`}>Ask about this policy</Link>
        <Link className={`${p.outline} ${p.wide}`} href="/policies">All policies</Link>
      </div>
    </div>
  );
}
