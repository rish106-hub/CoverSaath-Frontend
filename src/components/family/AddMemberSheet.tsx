"use client";

import { useEffect, useRef, useState } from "react";
import { adapters } from "@/adapters";
import { addMemberFlow, addMemberRelations } from "@/data/mock/family";
import { normaliseIndianMobile, validateAddMember } from "./logic";
import styles from "./family.module.css";

export type SentInvite = { name: string; mobile: string; via: "whatsapp" | "sms" };

export function AddMemberSheet({ onClose, onSent }: { onClose: () => void; onSent: (i: SentInvite) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [relation, setRelation] = useState(addMemberRelations[3]);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [via, setVia] = useState<"whatsapp" | "sms">("whatsapp");
  const [errors, setErrors] = useState<{ name?: string; mobile?: string }>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const next = async () => {
    if (busy) return;
    if (step === 1) {
      const e = validateAddMember(name, mobile);
      setErrors(e);
      if (!e.name && !e.mobile) setStep(2);
      return;
    }
    const normalised = normaliseIndianMobile(mobile);
    if (!normalised) return;
    setBusy(true);
    setFailed(false);
    try {
      await adapters.invite.invite({ relation, name: name.trim(), mobile: normalised, via });
      onSent({ name: name.trim(), mobile: normalised, via });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const first = name.trim().split(/\s+/)[0] || "them";
  return (
    <div
      className={styles.scrim}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); void next(); }
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Add family member">
        <div className={styles.sheetHead}>
          <h2 className={styles.sheetTitle}>Add family member · step {step} of 2</h2>
          <button type="button" className={styles.btn} onClick={onClose}>Close</button>
        </div>
        {step === 1 ? (
          <div className={styles.stack}>
            <div className={styles.sheetQ}>Who are you adding?</div>
            <div className={styles.chips} role="group" aria-label="Relation">
              {addMemberRelations.map((r) => (
                <button key={r} type="button" className={styles.chip} data-on={r === relation} aria-pressed={r === relation} onClick={() => setRelation(r)}>{r}</button>
              ))}
            </div>
            <div className={styles.twoCol}>
              <label className={styles.field}>
                Name
                <input ref={nameRef} className={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={!!errors.name} aria-describedby={errors.name ? "am-name-err" : undefined} />
                {errors.name ? <span id="am-name-err" className={styles.err} role="alert">{errors.name}</span> : null}
              </label>
              <label className={styles.field}>
                Mobile number
                <span className={styles.phone}>
                  <span className={styles.cc}>+91</span>
                  <input className={styles.bare} inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} autoComplete="off" aria-invalid={!!errors.mobile} aria-describedby={errors.mobile ? "am-mob-err" : undefined} />
                </span>
                {errors.mobile ? <span id="am-mob-err" className={styles.err} role="alert">{errors.mobile}</span> : null}
              </label>
            </div>
          </div>
        ) : (
          <div className={styles.stack}>
            <div className={styles.sheetQ}>What happens next for {first}</div>
            {addMemberFlow.map((f, i) => (
              <div key={f.title} className={styles.flow}>
                <span className={styles.flowIc} aria-hidden>{f.icon}</span>
                <span><span className={styles.flowT}>{f.title}</span><span className={styles.flowD}>{f.detail}</span></span>
                <span className={styles.srOnly}>Step {i + 1}</span>
              </div>
            ))}
            <div className={styles.via}>
              <span>Send the invite on</span>
              {(["whatsapp", "sms"] as const).map((v) => (
                <button key={v} type="button" className={styles.chip} data-on={via === v} aria-pressed={via === v} onClick={() => setVia(v)}>{v === "whatsapp" ? "WhatsApp" : "SMS"}</button>
              ))}
            </div>
            {failed ? <span className={styles.err} role="alert">The invite did not go. Try again.</span> : null}
          </div>
        )}
        <div>
          <button type="button" className={styles.cta} onClick={() => void next()} disabled={busy}>{step === 1 ? "Continue" : busy ? "Sending…" : "Send invite"}</button>
        </div>
      </div>
    </div>
  );
}
