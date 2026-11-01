"use client";

import { useEffect, useRef, useState } from "react";
import { adapters } from "@/adapters";
import { SaveState, useSave } from "@/components/ui/SaveState";
import { memberRelations, type MemberChannel } from "@/data/mock/family";
import { normaliseIndianMobile, validateEditMember, type EditErrors } from "./logic";
import styles from "./family.module.css";

/** `backendId` is the stored member this person maps to; absent until their details are first saved. */
export type MemberDetails = { id: string; name: string; relation: string; mobile: string; email: string; channel: MemberChannel; backendId?: string };

const CHANNELS: { id: MemberChannel; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
];

export function EditMemberSheet({ member, onClose, onSaved }: { member: MemberDetails; onClose: () => void; onSaved: (m: MemberDetails) => void }) {
  const [name, setName] = useState(member.name);
  const [relation, setRelation] = useState(member.relation);
  const [mobile, setMobile] = useState(member.mobile.replace(/^\+91\s*/, ""));
  const [email, setEmail] = useState(member.email);
  const [channel, setChannel] = useState<MemberChannel>(member.channel);
  const [errors, setErrors] = useState<EditErrors>({});
  const { status, save, busy } = useSave();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const submit = async () => {
    if (busy) return;
    const e = validateEditMember(name, mobile, email);
    setErrors(e);
    if (e.name || e.mobile || e.email) return;
    const next: MemberDetails = {
      id: member.id, name: name.trim(), relation, channel, email: email.trim(), backendId: member.backendId,
      mobile: mobile.trim() ? (normaliseIndianMobile(mobile) ?? "") : "",
    };
    const ok = await save(async () => {
      // Name and relation are stored in the backend. backend gap: mobile, e-mail and channel have no field yet and stay on the mock adapter.
      const stored = next.backendId
        ? await adapters.members.update(next.backendId, { name: next.name, relation: next.relation })
        : await adapters.members.add({ name: next.name, relation: next.relation });
      next.backendId = stored.id;
      await adapters.invite.updateMember(next);
    });
    if (ok) onSaved(next);
  };

  return (
    <div
      className={styles.scrim}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); void submit(); }
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={`Edit ${member.name}`}>
        <div className={styles.sheetHead}>
          <h2 className={styles.sheetTitle}>Edit {member.name}</h2>
          <button type="button" className="k-btn k-btn--sm" onClick={onClose}>Close</button>
        </div>
        <div className={styles.stack}>
          <div className={styles.chips} role="group" aria-label="Relation">
            {memberRelations.map((r) => (
              <button key={r} type="button" className={styles.chip} data-on={r === relation} aria-pressed={r === relation} onClick={() => setRelation(r)}>{r}</button>
            ))}
          </div>
          <div className={styles.twoCol}>
            <label className={styles.field}>
              Name
              <input ref={nameRef} className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={!!errors.name} />
              {errors.name ? <span className={styles.err} role="alert">{errors.name}</span> : null}
            </label>
            <label className={styles.field}>
              Mobile number
              <span className={styles.phone}>
                <span className={styles.cc}>+91</span>
                <input className={styles.bare} inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} autoComplete="off" aria-invalid={!!errors.mobile} />
              </span>
              {errors.mobile ? <span className={styles.err} role="alert">{errors.mobile}</span> : null}
            </label>
          </div>
          <label className={styles.field}>
            Email
            <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-invalid={!!errors.email} />
            {errors.email ? <span className={styles.err} role="alert">{errors.email}</span> : null}
          </label>
          <div className={styles.via}>
            <span>Send invites on</span>
            {CHANNELS.map((c) => (
              <button key={c.id} type="button" className={styles.chip} data-on={channel === c.id} aria-pressed={channel === c.id} onClick={() => setChannel(c.id)}>{c.label}</button>
            ))}
          </div>
        </div>
        <div className={styles.sheetFoot}>
          <button type="button" className="k-btn k-btn--primary" onClick={() => void submit()} disabled={busy}>Save</button>
          <SaveState status={status} onRetry={() => void submit()} />
        </div>
      </div>
    </div>
  );
}
