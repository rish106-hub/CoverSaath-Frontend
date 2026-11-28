"use client";

import Link from "next/link";
import { useState } from "react";
import { PageTitle } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { Field, Segmented } from "@/components/ui";
import { copayPct, estimate, sumInsuredRs } from "@/lib/real-cover";
import { inr } from "@/lib/stress";
import t from "./tools.module.css";
import { ErrorBox, Loading } from "./parts";
import { useRealCovers, type RealCover } from "./use-real-covers";

/** One label per cover. Two covers with the same product name would be indistinguishable in a picker, so both get their position appended. */
function coverLabels(covers: RealCover[]): string[] {
  const base = covers.map((c) => c.holding.summary?.productName || "Health policy");
  return base.map((label, i) => (base.filter((x) => x === label).length > 1 ? `${label} ${i + 1}` : label));
}

/** /stress-test for a real account: who pays on a bill the person types, from the sum insured and co-pay read from their policy. */
export function RealStress() {
  const { state, reload } = useRealCovers();
  return (
    <div className={t.page}>
      <PageTitle>Who pays if a hospital bill comes?</PageTitle>
      {state.kind === "loading" ? <Loading what="your policies" /> : null}
      {state.kind === "error" ? <ErrorBox code={state.code} onRetry={reload} /> : null}
      {state.kind === "ready" && state.covers.length === 0 ? <EmptyState title="Add a policy to run a stress test" body="Knowvia reads it, then shows who pays what." /> : null}
      {state.kind === "ready" && state.covers.length > 0 ? <Test covers={state.covers} /> : null}
    </div>
  );
}

function Test({ covers }: { covers: RealCover[] }) {
  const [pick, setPick] = useState(covers[0].holding.id);
  // Digits only, at most nine: the shown text is formatted from them, so typing "3,00" or "3 00" keeps working.
  const [digits, setDigits] = useState("");
  const labels = coverLabels(covers);
  const index = Math.max(0, covers.findIndex((c) => c.holding.id === pick));
  const cur = covers[index];
  const si = sumInsuredRs(cur.holding.summary);
  const copay = copayPct(cur.facts);
  const billRs = digits ? Number(digits) : null;
  const est = si !== null && billRs !== null ? estimate(billRs, si, copay) : null;
  const shownLines = si !== null ? (est ?? estimate(0, si, copay)).lines : [];
  const pct = est && est.bill > 0 ? (est.insurerPays / est.bill) * 100 : 0;
  const choose = (label: string) => { const i = labels.indexOf(label); if (i >= 0) setPick(covers[i].holding.id); };
  return (
    <div className={t.two}>
      <div className={t.left}>
        {covers.length === 1 ? <p className={t.coverName}>{labels[0]}</p> : null}
        {covers.length >= 2 && covers.length <= 3 ? <Segmented label="Policy" options={labels} value={labels[index]} onChange={choose} /> : null}
        {covers.length > 3 ? (
          <Field label="Policy">
            <select value={labels[index]} onChange={(e) => choose(e.target.value)}>
              {labels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="Hospital bill, in rupees">
          <input inputMode="numeric" className={t.bigin} placeholder="3,00,000" value={digits ? inr(Number(digits)) : ""} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 9))} />
        </Field>
        <div className={t.quick}>
          {[["Rs 1,00,000", "100000"], ["Rs 5,00,000", "500000"], ["Rs 15,00,000", "1500000"]].map(([label, amount]) => (
            <button key={amount} type="button" className={t.outline} onClick={() => setDigits(amount)}>{label}</button>
          ))}
        </div>
      </div>
      <div className={t.result} role="status" aria-live="polite" data-testid="stress-result">
        {si === null ? (
          <>
            <p className={t.sentence}>The sum insured of this policy has not been read or needs your decision yet, so we cannot work out who pays.</p>
            <div><Link className={t.cta} href={`/covers/review?holding=${encodeURIComponent(cur.holding.id)}`}>Check what we found</Link></div>
          </>
        ) : (
          <>
            <p className={t.youLabel}>You pay</p>
            <p className={t.you} data-testid="you-pay" data-over={est?.limited === true}>Rs {inr(est ? est.youPay : 0)}</p>
            <p className={t.reason}>
              {!est ? `Type a bill to see who pays. Sum insured read from your policy: Rs ${inr(si)}.` : est.limited ? `The bill goes past your sum insured of Rs ${inr(si)}.` : `Within your sum insured of Rs ${inr(si)}.`}
            </p>
            <div className={t.split} aria-hidden="true" data-pay={est !== null && est.youPay > 0}><i style={{ width: `${pct}%` }} /></div>
            <div role="list" className={t.lines}>
              {shownLines.map((l) => (
                <div key={l.title} role="listitem" className={t.lineRow} data-pay={l.kind === "pay"}>
                  <span>{l.title}</span>
                  <span>Rs {inr(l.value)}</span>
                </div>
              ))}
            </div>
            <p className={t.note}>Counts your sum insured{copay ? " and co-pay" : ""}. Room rent and other limits are not counted.</p>
          </>
        )}
      </div>
    </div>
  );
}
