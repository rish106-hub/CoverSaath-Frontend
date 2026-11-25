"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle, SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { copayPct, estimate, sumInsuredRs } from "@/lib/real-cover";
import { inr } from "@/lib/stress";
import s from "@/components/covers/covers.module.css";
import r from "./real.module.css";
import { ErrorBox, Loading } from "./parts";
import { useRealCovers, type RealCover } from "./use-real-covers";

const titleOf = (c: RealCover) => [c.holding.summary?.productName || "Health policy", c.holding.summary?.insurerName].filter(Boolean).join(" · ");

/** /stress-test for a real account: who pays on a bill the person types, from the sum insured and co-pay read from their policy. */
export function RealStress() {
  const { state, reload } = useRealCovers();
  return (
    <div className={s.stack}>
      <div>
        <PageTitle>Who pays if a hospital bill comes?</PageTitle>
      </div>
      {state.kind === "loading" ? <Loading what="your policies" /> : null}
      {state.kind === "error" ? <ErrorBox code={state.code} onRetry={reload} /> : null}
      {state.kind === "ready" && state.covers.length === 0 ? <EmptyState title="Add a policy to run a stress test" body="Knowvia reads it, then shows who pays what." /> : null}
      {state.kind === "ready" && state.covers.length > 0 ? <Test covers={state.covers} /> : null}
    </div>
  );
}

function Test({ covers }: { covers: RealCover[] }) {
  const [pick, setPick] = useState(covers[0].holding.id);
  const [bill, setBill] = useState("");
  const cur = covers.find((c) => c.holding.id === pick) ?? covers[0];
  const si = sumInsuredRs(cur.holding.summary);
  const copay = copayPct(cur.facts);
  const billRs = /^\d{1,9}$/.test(bill.replace(/[,\s]/g, "")) ? Number(bill.replace(/[,\s]/g, "")) : null;
  const est = si !== null && billRs !== null ? estimate(billRs, si, copay) : null;
  return (
    <>
      <div className={s.row}>
        {covers.length > 1 ? (
          <label className={r.bill}>Policy
            <select value={cur.holding.id} onChange={(e) => setPick(e.target.value)}>
              {covers.map((c) => <option key={c.holding.id} value={c.holding.id}>{titleOf(c)}</option>)}
            </select>
          </label>
        ) : <p className={s.lead}><b>{titleOf(cur)}</b></p>}
        <label className={r.bill}>Hospital bill, in rupees
          <input inputMode="numeric" value={bill} onChange={(e) => setBill(e.target.value)} placeholder="For example 300000" />
        </label>
      </div>
      {si === null ? <p className={s.quiet} role="status">The sum insured of this policy has not been read or needs your decision yet, so we cannot work out who pays.{" "}<Link href={`/covers/review?holding=${encodeURIComponent(cur.holding.id)}`}>Check what we found</Link></p> : null}
      {si !== null && !est ? <p className={s.quiet}>Type a bill to see who pays. Sum insured read from your policy: Rs {inr(si)}.</p> : null}
      {est && si !== null ? (
        <div className={s.row} style={{ alignItems: "flex-start" }}>
          <SectionHeading title="Bill step by step">
            <div className={s.card} role="list">
              {est.lines.map((l) => <div key={l.title} className={r.step} role="listitem"><span>{l.title}</span><span>{l.kind === "cut" ? "- " : ""}Rs {inr(l.value)}</span></div>)}
            </div>
          </SectionHeading>
          <div className={r.pays} role="status" aria-live="polite">
            <span>You pay</span>
            <div className={r.big}>Rs {inr(est.youPay)}</div>
            <span>{est.limited ? `The bill goes past your sum insured of Rs ${inr(si)}.` : `Within your sum insured of Rs ${inr(si)}.`}</span>
          </div>
        </div>
      ) : null}
      {est ? <p className={s.quiet}>An estimate from the sum insured{copay ? " and co-pay" : ""} read from your policy. Non-payable items, room rent limits and sub-limits are not counted, so check them in your policy terms.</p> : null}
    </>
  );
}
