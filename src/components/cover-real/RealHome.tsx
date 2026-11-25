"use client";

import { SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { AskCard, BentoGrid, MissingTile, SoonTile, Tile } from "@/components/ui";
import s from "@/components/covers/covers.module.css";
import { CreationIssues, ErrorBox, Loading, nextStepOf } from "./parts";
import { usePolicies } from "./use-policies";
import rows from "./RealHome.module.css";

const ASK_PROMPTS = ["What are my waiting periods?", "What does my policy not cover?"];

/** /home body for a real account: six equal tiles in two rows that answer "covered, how much, what next"; policy details live one tap away. */
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

  return (
    <div className={s.stack}>
      <CreationIssues issues={issues} onRetry={reload} />
      <SectionHeading title="Your cover at a glance">
        <div className={rows.rows}>
          <BentoGrid cols={3}>
            <Tile tone="ink" label="Policies" value={policies.length} caption="on your account" href="/policies" />
            {sumInsured ? <Tile label="Sum insured" value={sumInsured.value} caption={sumInsured.statusText} href={policyHref} /> : <MissingTile label="Sum insured" />}
            {renewal ? <Tile label="Next renewal" value={renewal.value} href={policyHref} /> : <MissingTile label="Next renewal" />}
          </BentoGrid>
          <BentoGrid cols={3}>
            <Tile tone="marker" label="Next step" value={next.label} caption={next.detail} href={next.href} />
            <SoonTile label="Cover per person" caption="See who is covered for how much" />
            <AskCard prompts={ASK_PROMPTS} />
          </BentoGrid>
        </div>
      </SectionHeading>
    </div>
  );
}
