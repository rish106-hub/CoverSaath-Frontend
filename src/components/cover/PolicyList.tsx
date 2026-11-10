"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adapters, type Member, type Policy } from "@/adapters";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { EmptyState } from "@/components/shell/EmptyState";
import { PeopleChips } from "./PeopleChips";
import styles from "./PolicyList.module.css";

const KIND: Record<Policy["kind"], string> = { group: "Group", "top-up": "Top-up", senior: "Senior", individual: "Individual" };
const inr = (n: number) => "Rs " + n.toLocaleString("en-IN");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** 2027-03-31 becomes 31 Mar 2027; anything else is shown as it came. */
const day = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
};

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
  const people = (ids: string[]) => ids.map((id) => members.find((m) => m.id === id) ?? { name: id, relation: id });

  return (
    <>
      <div>
        <Kicker>Your family’s cover</Kicker>
        <PageTitle>My policies</PageTitle>
      </div>
      <SectionHeading title="Your policies">
        {policies === null ? <p className={styles.quiet} role="status">Loading your policies...</p> : null}
        {policies?.length === 0 ? <EmptyState title="No policies yet" body="Upload your policy and Knowvia reads it for you. It shows here with its cover, renewal date and who it covers." /> : null}
        <div className={styles.grid}>
          {policies?.map((p) => (
            <Link key={p.id} href={`/policies/${p.id}`} className={styles.card}>
              <span className={styles.kind}>{KIND[p.kind]}</span>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.ins}>{p.insurer}</span>
              <dl className={styles.facts}>
                <div><dt>Cover</dt><dd>{inr(p.sumInsuredRs)}</dd></div>
                <div><dt>Premium</dt><dd>{p.premiumRs ? inr(p.premiumRs) + " a year" : "Employer pays"}</dd></div>
                <div><dt>Co-pay</dt><dd>{p.coPayPct ? `${p.coPayPct}%` : "None"}</dd></div>
                <div><dt>Renews</dt><dd>{day(p.renewsOn)}</dd></div>
              </dl>
              <span className={styles.who}><PeopleChips people={people(p.memberIds)} /></span>
              <span className={`k-btn k-btn--secondary k-btn--sm ${styles.open}`}>Open policy</span>
            </Link>
          ))}
        </div>
      </SectionHeading>
    </>
  );
}
