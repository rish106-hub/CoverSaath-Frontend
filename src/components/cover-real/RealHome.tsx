"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { Card, Signal } from "@/components/ui";
import s from "@/components/covers/covers.module.css";
import { CreationIssues, ErrorBox, Loading, nextStepOf } from "./parts";
import { usePolicies } from "./use-policies";
import rows from "./RealHome.module.css";

const ASK_PROMPTS = ["What are my waiting periods?", "What does my policy not cover?"];

/** /home body for a real account: the cover as one sentence and one next step on the left, three equal cards on the right; policy details live one tap away. */
export function RealHome() {
  const { state, issues, reload } = usePolicies();
  if (state.kind === "loading") return <Loading what="your cover" />;
  if (state.kind === "error") return <ErrorBox code={state.code} onRetry={reload} />;
  if (state.kind === "empty" && issues.length > 0) return <div className={s.stack}><CreationIssues issues={issues} onRetry={reload} /></div>;
  if (state.kind === "empty") return <EmptyState title="Add your first policy" body="Knowvia reads it and shows what it found here." cta="Add a policy" href="/covers/add" />;

  const policies = state.policies;
  const first = policies[0];
  const next = nextStepOf(policies);
  const policyHref = `/policies/${encodeURIComponent(first.id)}`;
  const sumInsured = first.headlines.find((h) => h.key === "sum_insured" && (h.tone === "read" || h.tone === "confirmed"));
  const renewal = first.facts.find((f) => f.key === "renewal_date" && f.value && f.value !== "Not found");

  const extra = policies.length - 2;

  return (
    <div className={s.stack}>
      <CreationIssues issues={issues} onRetry={reload} />
      <div className={rows.home}>
        <Card className={rows.left}>
          <h2 className={rows.sentence}>
            {policies.length > 1 ? (
              <>You have <span style={{ color: "var(--harbour)" }} data-testid="home-cover">{policies.length}</span> policies on Knowvia.</>
            ) : sumInsured ? (
              <>You have <span style={{ color: "var(--harbour)" }} data-testid="home-cover">{sumInsured.value}</span> of health cover.</>
            ) : (
              <>Your policy is on Knowvia.</>
            )}
          </h2>
          <div className={rows.next}>
            <p className={rows.label}>{next.label}</p>
            <p className={rows.detail}>{next.detail}</p>
            <Link href={next.href} className={rows.cta} data-testid="home-next">{next.label} →</Link>
          </div>
        </Card>
        <div className={rows.right}>
          <Card as="a" href="/policies">
            <p className={rows.label}>Policies</p>
            <p className={rows.value}>{policies.length}</p>
            <div className={rows.titles}>
              {policies.slice(0, 2).map((p) => <span key={p.id}>{p.title}</span>)}
              {extra > 0 ? <span>and {extra} more</span> : null}
            </div>
          </Card>
          <Card as="a" href={policyHref}>
            <p className={rows.label}>Next renewal</p>
            {renewal ? (
              <>
                <p className={rows.value}>{renewal.value}</p>
                <Signal kind="ok">On your policy</Signal>
              </>
            ) : (
              <>
                <p className={rows.value}>Not in your policy</p>
                <Signal kind="warn">Add it from your policy page</Signal>
              </>
            )}
          </Card>
          <Card>
            <p className={rows.label}>Ask about your cover</p>
            <div className={rows.asks}>
              {ASK_PROMPTS.map((q) => <Link key={q} href={`/chat?q=${encodeURIComponent(q)}`} className={rows.prompt}>{q}</Link>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
