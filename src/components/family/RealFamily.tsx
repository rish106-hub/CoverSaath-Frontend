"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { adapters } from "@/adapters";
import type { MemberRecord } from "@/adapters/scenarios";
import { SectionHeading } from "@/components/type";
import { FamilyOwner } from "@/components/shell";
import { ErrorBox, Loading } from "@/components/cover-real/parts";
import { codeOf } from "@/adapters/real-policy";
import { AddMemberSheet } from "./AddMemberSheet";
import { EditMemberSheet, type MemberDetails } from "./EditMemberSheet";
import styles from "./family.module.css";

/**
 * /family for a real account: the owner and the people stored in the household, in the demo's layout. Invites, mobile, e-mail and
 * sharing have no backend yet, so none of them is shown (the sheets hide the contact fields while features.memberContact is off).
 */
export function RealFamily() {
  const [members, setMembers] = useState<MemberRecord[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [tick, setTick] = useState(0);
  const lastCard = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let live = true;
    adapters.members.list().then(
      (m) => { if (live) { setMembers(m); setCode(null); } },
      (e) => { if (live) setCode(codeOf(e)); },
    );
    return () => { live = false; };
  }, [tick]);
  const reload = useCallback(() => { setCode(null); setMembers(null); setTick((t) => t + 1); }, []);
  const closeEdit = () => { setEditing(null); lastCard.current?.focus(); };

  const others = (members ?? []).filter((m) => !m.isOwner && !m.isYou);
  const details = (m: MemberRecord): MemberDetails => ({ id: m.id, backendId: m.id, name: m.name, relation: m.relation ?? "Other", mobile: "", email: "", channel: "whatsapp" });

  return (
    <>
      <div className={styles.toolbar}>
        <button type="button" className="k-btn k-btn--primary" onClick={() => setAdding(true)}>Add family member</button>
        <Link className="k-btn" href="/covers/add">Add a document</Link>
      </div>
      <SectionHeading title="People">
        <FamilyOwner />
        {code ? <ErrorBox code={code} onRetry={reload} /> : null}
        {!code && members === null ? <Loading what="your family" /> : null}
        {others.length > 0 ? (
          <div className={styles.people} role="group" aria-label="People in your household">
            {others.map((m) => (
              <button key={m.id} type="button" className={styles.person} aria-haspopup="dialog" aria-label={`${m.name}${m.relation ? `, ${m.relation}` : ""}. Edit details`} onClick={(e) => { lastCard.current = e.currentTarget; setEditing(m); }}>
                <span className={styles.personTop}><span className={styles.avatar}>{m.name.slice(0, 2)}</span></span>
                <span><span className={styles.pname}>{m.name}</span><span className={styles.prel}>{[m.relation, m.ageYears !== null ? String(m.ageYears) : null].filter(Boolean).join(", ")}</span></span>
              </button>
            ))}
          </div>
        ) : null}
      </SectionHeading>
      {editing ? <EditMemberSheet key={editing.id} member={details(editing)} onClose={closeEdit} onSaved={() => { closeEdit(); reload(); }} /> : null}
      {adding ? <AddMemberSheet onClose={() => setAdding(false)} onSent={() => setAdding(false)} onAdded={() => { setAdding(false); reload(); }} /> : null}
    </>
  );
}
