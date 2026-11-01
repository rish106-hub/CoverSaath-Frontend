"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SectionHeading, SubHeading } from "@/components/type";
import { FamilyOwner } from "@/components/shell";
import {
  familyDates, familyInvites, familyPeople, familyPolicies, policyRefs, sharingRows, type Invite,
} from "@/data/mock/family";
import { AddMemberSheet, type SentInvite } from "./AddMemberSheet";
import { RemindRowSlot } from "./slots";
import styles from "./family.module.css";

const STATE_LABEL: Record<Invite["state"], string> = { joined: "Joined", sent: "Invite sent", none: "Not invited" };
const DOTS: Record<Invite["state"], number> = { joined: 3, sent: 1, none: 0 };
const POLICY_TONE = ["harbour", "sea", "ochre"] as const;

export function FamilyView() {
  const [sel, setSel] = useState(4);
  const [adding, setAdding] = useState(false);
  const [invites, setInvites] = useState<Invite[]>(familyInvites);
  const [sharing, setSharing] = useState(sharingRows.map((r) => r.on));
  const person = familyPeople[sel];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (adding || (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const n = Number(e.key);
      if (n >= 1 && n <= familyPeople.length) setSel(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding]);

  const onSent = (s: SentInvite) => {
    setInvites((cur) => {
      const via = s.via === "whatsapp" ? "WhatsApp" : "SMS";
      const entry: Invite = { id: s.name.toLowerCase(), name: s.name, initials: s.name.slice(0, 1).toUpperCase(), mobile: s.mobile, state: "sent", detail: `Sent just now on ${via}` };
      const i = cur.findIndex((c) => c.name.toLowerCase() === s.name.toLowerCase());
      return i >= 0 ? cur.map((c, k) => (k === i ? entry : c)) : [...cur, entry];
    });
    setAdding(false);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <button type="button" className={styles.cta} onClick={() => setAdding(true)}>+ Add family member</button>
        <Link className={styles.btn} href="/welcome/add">+ Add a document</Link>
      </div>

      <SectionHeading title="People">
        <FamilyOwner />
        <div className={styles.people} role="group" aria-label="Pick a person">
          {familyPeople.map((p, k) => (
            <button key={p.id} type="button" className={styles.person} data-on={k === sel} aria-pressed={k === sel} onClick={() => setSel(k)}>
              <span className={styles.personTop}>
                <span className={styles.avatar} data-on={k === sel}>{p.initials}</span>
                <span className={styles.badge} data-tone={p.tone}>{p.status}</span>
              </span>
              <span><span className={styles.pname}>{p.name}</span><span className={styles.prel}>{p.relation}, {p.age}</span></span>
              <span className={styles.cover}>{p.cover}</span>
              <span className={styles.bar} aria-hidden>
                <span style={{ width: `${p.segments.group}%`, background: "var(--harbour)" }} />
                <span style={{ width: `${p.segments.topUp}%`, background: "var(--sea-glass)" }} />
                <span style={{ width: `${p.segments.senior}%`, background: "var(--ochre)" }} />
              </span>
              <span className={styles.note}>{p.note}</span>
            </button>
          ))}
        </div>
      </SectionHeading>

      <SectionHeading title="Family on Knowvia" description="Add a phone number. They get their own login, and their policies join this file.">
        <div className={styles.invites}>
          {invites.map((v) => (
            <div key={v.id} className={styles.invite}>
              <span className={styles.personTop}>
                <span className={styles.avatarSm}>{v.initials}</span>
                <span className={styles.badge} data-tone={v.state === "joined" ? "ok" : v.state === "sent" ? "marker" : "none"}>{STATE_LABEL[v.state]}</span>
              </span>
              <span className={styles.pname}>{v.name}</span>
              <span className={styles.mono}>{v.mobile}</span>
              <span className={styles.dots} aria-label={`${DOTS[v.state]} of 3 steps done`}>
                {[0, 1, 2].map((d) => <i key={d} data-on={d < DOTS[v.state]} />)}
              </span>
              <span className={styles.note}>{v.detail}</span>
            </div>
          ))}
        </div>
      </SectionHeading>

      <SectionHeading title="Policy by person" actions={<span className={styles.legend}><span className={styles.swatch} data-on />Covered <span className={styles.swatch} />Not on this policy</span>}>
        <div className={styles.matrix}>
          <span />
          {familyPolicies.map((c, i) => (
            <div key={c.name} className={styles.colHead} data-tone={POLICY_TONE[i]}>
              <span className={styles.colName}>{c.name}</span><span className={styles.note}>{c.meta}</span>
            </div>
          ))}
          {familyPeople.map((p, k) => (
            <div key={p.id} className={styles.matrixRow} data-on={k === sel}>
              <span className={styles.rowHead} data-on={k === sel}><span className={styles.avatarSm}>{p.initials}</span>{p.name}</span>
              {p.has.map((h, i) => (
                <div key={i} className={h ? styles.cell : styles.cellOff} data-tone={POLICY_TONE[i]}>
                  <span><span className={styles.cellT}>{h ? "Covered" : "Not on this policy"}</span>{h ? <span className={styles.mono}>{policyRefs[i]}</span> : null}</span>
                  {h && k === sel ? <Link href="/policies" className={styles.cellAct}>Open →</Link> : null}
                  {!h && i === 1 && (k === 1 || k === 2) ? <Link href="/tools" className={styles.cellAct}>Add?</Link> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </SectionHeading>

      <SectionHeading title={`${person.name} at a glance`} actions={<Link className={styles.btn} href="/cards">E-card</Link>}>
        <div className={styles.glance}>
          <div className={styles.facts}>
            {["Cover left this year", "Claimed this year", "Claims"].map((k, i) => (
              <div key={k} className={styles.fact}><span className={styles.note}>{k}</span><span className={styles.factV}>{person.facts[i]}</span></div>
            ))}
          </div>
          <SubHeading>Waiting periods</SubHeading>
          {person.waits.map((w) => (
            <div key={w.label} className={styles.wait}>
              <span>{w.label}</span>
              <span className={styles.track}><span style={{ width: `${w.pct}%` }} data-tone={w.pct >= 100 ? "ok" : w.pct === 0 ? "bad" : "mid"} /></span>
              <span className={styles.waitV} data-tone={w.pct >= 100 ? "ok" : w.pct === 0 ? "bad" : "mid"}>{w.value}</span>
            </div>
          ))}
        </div>
      </SectionHeading>

      <SectionHeading title="Gaps" description={`Gaps Knowvia found for ${person.name}`} actions={<span className={styles.mono}>{person.gaps.length ? `${person.gaps.length} to fix` : "all clear"}</span>}>
        <div className={styles.gaps}>
          {person.gaps.map((g) => (
            <div key={g.title} className={styles.gap}>
              <span className={styles.gapIc} aria-hidden>{g.icon}</span>
              <span className={styles.gapBody}><span className={styles.gapT}>{g.title}</span><span className={styles.gapD}>{g.detail}</span></span>
              <Link href={g.href} className={styles.gapCta}>{g.cta}</Link>
            </div>
          ))}
          {person.gaps.length === 0 ? <div className={styles.gap}>Nothing to fix for {person.name} right now.</div> : null}
        </div>
      </SectionHeading>

      <SectionHeading title="Dates the documents give">
        <RemindRowSlot subject="Family insurance dates" />
        <div className={styles.dates}>
          {familyDates.map((d) => (
            <div key={d.id} className={styles.date}>
              <span className={styles.cal}><span className={styles.calM} data-tone={d.tone}>{d.month}</span><span className={styles.calD}>{d.day}</span></span>
              <span className={styles.gapT}>{d.title}</span>
              <span className={styles.note}>{d.who} · in {d.inDays} days</span>
            </div>
          ))}
        </div>
      </SectionHeading>

      <SectionHeading title="Who sees what" description="Each adult decides for their own record">
        <div className={styles.share}>
          <div className={styles.shareRow}><span />{["Cover", "E-card", "Claims"].map((h) => <span key={h} className={styles.shareH}>{h}</span>)}</div>
          {sharingRows.map((r, k) => (
            <div key={r.id} className={styles.shareRow}>
              <span className={styles.shareWho}><span className={styles.avatarSm}>{r.initials}</span><span><span className={styles.pname}>{r.who}</span><span className={styles.note}>{r.state}</span></span></span>
              {["Cover", "E-card", "Claims"].map((label, j) => (
                <span key={label} className={styles.shareCell}>
                  <button type="button" role="switch" aria-checked={sharing[k][j]} aria-label={`${label} visible to ${r.who}`} className={styles.sw} data-on={sharing[k][j]}
                    onClick={() => setSharing((cur) => cur.map((row, a) => (a === k ? row.map((v, b) => (b === j ? !v : v)) : row)))}><span /></button>
                </span>
              ))}
            </div>
          ))}
        </div>
      </SectionHeading>

      {adding ? <AddMemberSheet onClose={() => setAdding(false)} onSent={onSent} /> : null}
    </>
  );
}
