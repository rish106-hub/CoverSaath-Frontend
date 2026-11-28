"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { Tabs } from "@/components/ui";
import { GROUP_ORDER, groupOf } from "@/components/covers/format";
import { labelOf } from "@/lib/fact-labels";
import { MemoryDocument } from "./MemoryDocument";
import { PassageSearch } from "./PassageSearch";
import { isWaitingForWording, ErrorBox, FactItem, Headlines, Loading, Pending, StageBox, TermsStatus } from "./parts";
import { usePolicies } from "./use-policies";
import p from "./policies.module.css";

/** Eight facts in two columns fit the panel on a 1440x900 screen without scrolling; a longer group is paged. */
const FACT_PAGE = 8;

const tabIdOf = (label: string) => label.toLowerCase().replace(/ /g, "-");

/** Facts of one group, two columns, eight to a page. Keyed by group so each group keeps its own page. */
function GroupPanel({ facts }: { facts: Parameters<typeof FactItem>[0]["f"][] }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(facts.length / FACT_PAGE);
  return (
    <>
      <ul className={p.facts}>{facts.slice(page * FACT_PAGE, page * FACT_PAGE + FACT_PAGE).map((f) => <FactItem key={f.key} f={f} />)}</ul>
      {facts.length > FACT_PAGE ? (
        <div className={p.pager}>
          <button type="button" className={p.outline} disabled={page === 0} onClick={() => setPage(page - 1)}>Back</button>
          <p className={p.pageText} role="status">Page {page + 1} of {pages}</p>
          <button type="button" className={p.outline} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      ) : null}
    </>
  );
}

/** /policies/[id] for a real account: the holding's facts, each with its status and where it was read, one group per tab. */
export function RealPolicyDetail({ id }: { id: string }) {
  const { state, reload, refresh } = usePolicies();
  const [selected, setSelected] = useState("glance");
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
    { id: "glance", label: "At a glance" },
    ...groups.map((g) => ({ id: tabIdOf(g.label), label: g.label })),
    ...(policy.notFound > 0 ? [{ id: "not-found", label: `Not found (${policy.notFound})` }] : []),
    ...(hasTerms ? [{ id: "terms", label: "Insurer terms" }] : []),
  ];
  // A refresh can drop the tab the person is on (for example a group that no longer has facts); fall back to the first tab.
  const active = tabs.some((t) => t.id === selected) ? selected : "glance";
  return (
    <div className={p.detail}>
      <div className={p.head}>
        <div className={p.headText}>
          <PageTitle>{policy.title}</PageTitle>
          {policy.insurer ? <p className={p.sub}>{policy.insurer}</p> : null}
        </div>
        <div className={p.headLinks}>
          <Link className={p.outline} href="/policies">All policies</Link>
          <Link className={p.cta} href={`/chat?holding=${encodeURIComponent(policy.id)}`}>Ask about this policy</Link>
        </div>
      </div>
      <Tabs label="Policy sections" tabs={tabs} value={active} onChange={setSelected} />
      <div role="tabpanel" data-panel="glance" className={p.panel} hidden={active !== "glance"}>
        {policy.error ? <ErrorBox code={policy.error} onRetry={reload} /> : <StageBox p={policy} onRetry={reload} />}
        <Pending p={policy} />
        {policy.headlines.length > 0 ? <Headlines p={policy} /> : null}
        {policy.stage !== "reading" && policy.stage !== "choose_plan" && !policy.error && policy.facts.length === 0 ? <p className={p.note}>Nothing has been read from this policy yet.</p> : null}
      </div>
      {groups.map((g) => (
        <div key={g.label} role="tabpanel" data-panel={tabIdOf(g.label)} className={p.panel} hidden={active !== tabIdOf(g.label)}>
          <GroupPanel facts={g.facts} />
        </div>
      ))}
      {policy.notFound > 0 ? (
        <div role="tabpanel" data-panel="not-found" className={p.panel} hidden={active !== "not-found"}>
          <ul className={p.missing}>{policy.notFoundKeys.map((k) => <li key={k}>{labelOf(k)}</li>)}</ul>
        </div>
      ) : null}
      {hasTerms ? (
        <div role="tabpanel" data-panel="terms" className={`${p.panel} ${p.terms}`} hidden={active !== "terms"}>
          <TermsStatus p={policy} onAdded={reload} />
          <MemoryDocument holdingId={policy.id} />
          <PassageSearch holdingId={policy.id} />
        </div>
      ) : null}
    </div>
  );
}
