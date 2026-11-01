"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adapters, type Member, type Policy } from "@/adapters";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import styles from "./PolicyList.module.css";

const KIND: Record<Policy["kind"], string> = { group: "Group", "top-up": "Top-up", senior: "Senior", individual: "Individual" };
const inr = (n: number) => "Rs " + n.toLocaleString("en-IN");

export function PolicyList() {
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all([adapters.policy.list(), adapters.household.household()]).then(([p, h]) => {
      if (!live) return;
      setPolicies(p);
      setMembers(h.members);
    }).catch(() => live && setPolicies([]));
    return () => {
      live = false;
    };
  }, []);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  return (
    <>
      <div>
        <Kicker>Answers for your family</Kicker>
        <PageTitle>My policies</PageTitle>
      </div>
      <SectionHeading title="Your policies" description="Open one to read the answer next to the clause it came from.">
        {policies === null ? <p className={styles.quiet} role="status">Loading your policies…</p> : null}
        {policies?.length === 0 ? <p className={styles.quiet}>No policies yet. Add one from Documents.</p> : null}
        <div className={styles.grid}>
          {policies?.map((p) => (
            <Link key={p.id} href={`/policies/${p.id}`} className={styles.card}>
              <span className={styles.top}><span className={styles.kind}>{KIND[p.kind]}</span><span className={styles.arrow} aria-hidden>→</span></span>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.ins}>{p.insurer}</span>
              <dl className={styles.facts}>
                <div><dt>Cover</dt><dd>{inr(p.sumInsuredRs)}</dd></div>
                <div><dt>Premium</dt><dd>{p.premiumRs ? inr(p.premiumRs) + " a year" : "Paid by employer"}</dd></div>
                <div><dt>Co-pay</dt><dd>{p.coPayPct ? `${p.coPayPct}%` : "None"}</dd></div>
                <div><dt>Renews</dt><dd>{p.renewsOn}</dd></div>
              </dl>
              <span className={styles.who}>Covers {p.memberIds.map(name).join(", ")}</span>
            </Link>
          ))}
        </div>
      </SectionHeading>
    </>
  );
}
