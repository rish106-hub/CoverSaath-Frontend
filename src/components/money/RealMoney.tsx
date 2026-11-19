"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { backendCovers } from "@/adapters/covers";
import type { DueView, PremiumView } from "@/adapters/covers-contract";
import { codeOf } from "@/adapters/real-policy";
import { SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { ErrorBox, Loading } from "@/components/cover-real/parts";
import styles from "./money.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const rs = (paise: number) => `Rs ${Math.round(paise / 100).toLocaleString("en-IN")}`;
const DUE_LABEL: Record<DueView["state"], string> = { expected: "Expected", paid: "Paid", overdue: "Overdue" };

type Data = { premiums: PremiumView[]; dues: DueView[]; names: Record<string, string> };

/** /money for a real account: the stored premium payments and dues in the demo's layout. The inbox scan has no backend, so it is not shown. */
export function RealMoney() {
  const [data, setData] = useState<Data | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [mon, setMon] = useState(new Date().getMonth());
  useEffect(() => {
    let live = true;
    Promise.all([backendCovers.premiums(), backendCovers.premiumDues(), backendCovers.holdingsView().catch(() => null)]).then(
      ([premiums, dues, hv]) => {
        if (!live) return;
        const names: Record<string, string> = {};
        for (const h of hv?.holdings ?? []) names[h.id] = [h.summary?.productName, h.summary?.insurerName].filter(Boolean).join(" · ") || "Your policy";
        setData({ premiums, dues, names });
        setCode(null);
      },
      (e) => { if (live) setCode(codeOf(e)); },
    );
    return () => { live = false; };
  }, [tick]);

  const year = new Date().getFullYear();
  const byMonth = useMemo(() => {
    const out = new Array<number>(12).fill(0);
    for (const p of data?.premiums ?? []) {
      const [y, m] = p.paidOn.split("-").map(Number);
      if (y === year && m && m >= 1 && m <= 12) out[m - 1] += p.amountPaise;
    }
    return out;
  }, [data, year]);

  if (code) return <ErrorBox code={code} onRetry={() => { setCode(null); setData(null); setTick((t) => t + 1); }} />;
  if (!data) return <Loading what="your premiums" />;
  if (data.premiums.length === 0 && data.dues.length === 0) {
    return <EmptyState title="No money activity yet" body="Premiums you record and dues that are expected show here once your policy is read." />;
  }

  const total = byMonth.reduce((a, b) => a + b, 0);
  const max = Math.max(...byMonth, 1);
  const unpaid = data.dues.filter((d) => d.state !== "paid");
  const nameOf = (id: string) => data.names[id] ?? "Your policy";

  return (
    <>
      <div className={styles.card}>
        <div className={styles.stats}>
          <div><div className={styles.statLabel}>Premiums paid this year</div><div className={styles.stat}>{rs(total)}</div></div>
          <div><div className={styles.statLabel}>Payments recorded</div><div className={styles.stat}>{data.premiums.length}</div></div>
          <div><div className={styles.statLabel}>Dues still open</div><div className={styles.stat}>{unpaid.length}</div></div>
        </div>
      </div>

      <div className={styles.cols}>
        <SectionHeading title="Premiums due">
          <div className={styles.col}>
            {data.dues.length === 0 ? <div className={styles.dash}><b>No dues yet</b><span>Dues you add for a policy show here.</span></div> : null}
            {data.dues.map((d) => (
              <div key={d.id} className={`${styles.exp} ${d.state === "paid" ? styles.expOk : d.state === "overdue" ? styles.expDup : ""}`}>
                <div className={styles.row2}><b>{nameOf(d.holdingId)}</b><span className={styles.mono}>{rs(d.amountPaise)}</span></div>
                <div className={styles.row2}><span>{d.dueOn}</span><span className={`${styles.state} ${d.state === "paid" ? styles.stateOk : d.state === "overdue" ? styles.stateDup : ""}`}>{DUE_LABEL[d.state]}</span></div>
              </div>
            ))}
          </div>
        </SectionHeading>

        <SectionHeading title="Paid so far">
          <div className={styles.col}>
            {data.premiums.length === 0 ? <div className={styles.dash}><b>No payments recorded</b><span>Premiums you record show here.</span></div> : null}
            {[...data.premiums].sort((a, b) => b.paidOn.localeCompare(a.paidOn)).map((p) => (
              <div key={p.id} className={styles.exp}>
                <div className={styles.row2}><b>{nameOf(p.holdingId)}</b><span className={styles.mono}>{rs(p.amountPaise)}</span></div>
                <div className={styles.row2}><span>{p.paidOn}</span><span>{p.paidVia}</span></div>
              </div>
            ))}
          </div>
        </SectionHeading>
      </div>

      <SectionHeading title="Premiums by month">
        <div className={styles.card}>
          <div className={styles.months} role="group" aria-label="Months">
            {MONTHS.map((name, k) => {
              const on = k === mon;
              return (
                <button key={name} type="button" className={styles.month} aria-pressed={on} aria-label={`${name}${byMonth[k] ? ` ${rs(byMonth[k]!)}` : ""}`} onClick={() => setMon(k)}>
                  <span className={`${styles.monthBar} ${on ? styles.monthBarOn : byMonth[k] ? styles.monthBarHas : ""}`} style={{ height: byMonth[k] ? Math.max(10, Math.round((byMonth[k]! / max) * 120)) : 4 }} />
                  <span className={`${styles.monthL} ${on ? styles.monthLOn : ""}`}>{name.slice(0, 1)}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.monthNow}><span><strong style={{ fontWeight: 600 }}>{MONTHS[mon]}</strong> · {byMonth[mon] ? "Paid" : "Nothing paid this month"}</span><span className={styles.mono}>{byMonth[mon] ? rs(byMonth[mon]!) : "—"}</span></div>
        </div>
      </SectionHeading>
      <Link href="/policies" className="k-btn k-btn--sm" style={{ alignSelf: "flex-start" }}>Open your policies</Link>
    </>
  );
}
