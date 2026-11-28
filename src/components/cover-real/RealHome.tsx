"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";
import { HomeGreeting } from "@/components/shell/HomeGreeting";
import { Card } from "@/components/ui";
import type { PolicyView } from "@/adapters/real-policy";
import { CreationIssues, ErrorBox, Loading, nextStepOf } from "./parts";
import { StateSignal } from "./RealPolicies";
import { usePolicies } from "./use-policies";
import rows from "./RealHome.module.css";

const ASK_PROMPTS = ["What are my waiting periods?", "What does my policy not cover?"];

/** The one button text per kind of next step: where the link leads decides the verb, so the button always says what happens on tap. */
const nextButtonText = (href: string) => (href.startsWith("/covers/review") ? "Decide now" : href.startsWith("/covers/add") ? "Choose your plan" : "Ask now");

/** One policy as a card: who issued it, the sum insured as found (or "Not found yet"), the one state signal and an arrow to its page. */
function HomePolicyCard({ policy, more }: { policy: PolicyView; more?: number }) {
  const initial = (policy.insurer ?? policy.title).trim().charAt(0).toUpperCase();
  const sumInsured = policy.headlines.find((h) => h.key === "sum_insured" && (h.tone === "read" || h.tone === "confirmed"));
  return (
    <Card as="a" href={`/policies/${encodeURIComponent(policy.id)}`} aria-label={policy.title} data-testid="home-policy" className={`${rows.tile} ${rows.policy}`}>
      <div className={rows.top}>
        <span className={rows.badge} aria-hidden>{initial}</span>
        <div className={rows.names}>
          {/* Long names end in an ellipsis with the full text in the title; the card never grows or hides them. */}
          <p className={`${rows.name} ${rows.clip}`} data-truncate title={policy.title}>{policy.title}</p>
          {policy.insurer ? <p className={`${rows.insurer} ${rows.clip}`} data-truncate title={policy.insurer}>{policy.insurer}</p> : null}
        </div>
      </div>
      <p className={rows.amount}>{sumInsured ? sumInsured.value : "Not found yet"}</p>
      <div className={rows.foot}>
        <div className={rows.footText}>
          {more && more > 0 ? <p className={rows.more}>and {more} more</p> : null}
          <StateSignal policy={policy} />
        </div>
        <span className={rows.arrow} aria-hidden>→</span>
      </div>
    </Card>
  );
}

/** /home body for a real account: the cover as one sentence and when it renews on top, then the policies (or Ask) and the one next step. */
export function RealHome() {
  const { state, issues, reload } = usePolicies();
  if (state.kind === "loading") return <><HomeGreeting size="line" /><Loading what="your cover" /></>;
  if (state.kind === "error") return <><HomeGreeting size="line" /><ErrorBox code={state.code} onRetry={reload} /></>;
  if (state.kind === "empty" && issues.length > 0) return <div className={rows.page}><HomeGreeting size="line" /><CreationIssues issues={issues} onRetry={reload} /></div>;
  if (state.kind === "empty") return <><HomeGreeting size="line" /><EmptyState title="Add your first policy" body="Knowvia reads it and shows what it found here." cta="Add a policy" href="/covers/add" /></>;

  const policies = state.policies;
  const first = policies[0];
  const second = policies[1];
  const next = nextStepOf(policies);
  const policyHref = `/policies/${encodeURIComponent(first.id)}`;
  const sumInsured = first.headlines.find((h) => h.key === "sum_insured" && (h.tone === "read" || h.tone === "confirmed"));
  const renewal = first.facts.find((f) => f.key === "renewal_date" && f.value && f.value !== "Not found");

  return (
    <div className={rows.page}>
      <CreationIssues issues={issues} onRetry={reload} />
      <div className={rows.halves}>
        <div className={rows.left}>
          <HomeGreeting size="line" />
          <h2 className={rows.sentence}>
            {policies.length > 1 ? (
              <>You have <span style={{ color: "var(--harbour)" }} data-testid="home-cover">{policies.length}</span> policies on Knowvia.</>
            ) : sumInsured ? (
              <>You have <span style={{ color: "var(--harbour)" }} data-testid="home-cover">{sumInsured.value}</span> of health cover.</>
            ) : (
              <>Your policy is on Knowvia.</>
            )}
          </h2>
        </div>
        <Card as="a" tone="inverse" href={policyHref} data-testid="home-renewal" className={`${rows.renewal}`}>
          {renewal ? (
            <>
              <p className={rows.big}>{renewal.value}</p>
              <p className={rows.renewLabel}>Your next renewal.</p>
              <p className={`${rows.renewName} ${rows.clip}`} data-truncate title={first.title}>{first.title}</p>
            </>
          ) : (
            <>
              <p className={`${rows.big} ${rows.bigQuiet}`}>No renewal date yet</p>
              <p className={rows.renewLabel}>Open your policy to check its dates.</p>
            </>
          )}
        </Card>
      </div>
      <div className={rows.cards}>
        <HomePolicyCard policy={first} />
        {second ? (
          <HomePolicyCard policy={second} more={policies.length - 2} />
        ) : (
          <Card className={`${rows.tile} ${rows.ask}`}>
            <p className={rows.label}>Ask about your cover</p>
            <div className={rows.asks}>
              {ASK_PROMPTS.map((q) => <Link key={q} href={`/chat?q=${encodeURIComponent(q)}`} className={rows.prompt}>{q}</Link>)}
            </div>
          </Card>
        )}
        <Card tone="next" className={`${rows.tile} ${rows.nextCard}`}>
          <p className={rows.label}>Your next step</p>
          <p className={rows.step}>{next.label}</p>
          <p className={rows.detail}>{next.detail}</p>
          <Link href={next.href} className={rows.cta} data-testid="home-next">{nextButtonText(next.href)}</Link>
        </Card>
      </div>
    </div>
  );
}
