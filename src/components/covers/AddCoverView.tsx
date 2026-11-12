"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { adapters } from "@/adapters";
import { MAX_UPLOAD_BYTES, POLICY_TYPES, POLICY_TYPE_LABEL, errorText, type PolicyType } from "@/adapters/documents-contract";
import { makeRequestKey, uploads } from "@/adapters/uploads";
import type { CandidateView, Candidates } from "@/adapters/covers-contract";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { codeOf } from "./use-holdings";
import { canRetry, checkSchedule, emptySlot, pickFile, runSchedule, type Slot } from "./add-cover-flow";
import s from "./covers.module.css";

const MB = MAX_UPLOAD_BYTES / 1024 / 1024;
type Pick = { candidateId: string; label: string } | null;

/** One slot's progress line: what it is doing, or why it stopped. */
function SlotStatus({ slot, name }: { slot: Slot; name: string }) {
  if (slot.status === "empty") return <p className={s.quiet}>Drop the PDF here, or choose it from your device.</p>;
  const file = slot.file?.name ?? name;
  if (slot.status === "working") return <p className={s.quiet} role="status" data-state="working">Reading your schedule&hellip;</p>;
  if (slot.status === "waiting") return <p className={s.quiet} role="status" data-state="waiting">Reading your schedule&hellip;</p>;
  if (slot.status === "done") return <p className={s.lead} role="status" data-state="done">{file}: added.</p>;
  return <p className={s.alert} role="alert" data-state="failed">{file}: {errorText(slot.code ?? "")}</p>;
}

/** Add cover: pick the cover type, add the policy schedule (the one upload; the insurer's terms are attached by the system), say which plan it is (up to three guesses, or search), confirm. Insurer and plan names only; never a UIN. */
export function AddCoverView() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [policyType, setPolicyType] = useState<PolicyType | "">("");
  const [typeLocked, setTypeLocked] = useState(false);
  const [schedule, setSchedule] = useState<Slot>(emptySlot);
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [cands, setCands] = useState<Candidates | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [else_, setElse] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ productId: string; productName: string }[] | null>(null);
  const [done, setDone] = useState(false);
  const [over, setOver] = useState(false);
  const [checking, setChecking] = useState(false);
  const scheduleInput = useRef<HTMLInputElement>(null);
  const consentKey = useRef(makeRequestKey());
  const confirmKey = useRef(makeRequestKey());

  const fail = (e: unknown) => setError(codeOf(e));

  useEffect(() => {
    let live = true;
    uploads.list().then((r) => {
      if (!live) return;
      setConsent(r.consent);
      if (r.policyType) { setPolicyType(r.policyType); setTypeLocked(true); }
    }).catch((e) => {
      if (!live) return;
      setError(codeOf(e));
      setConsent(false);
    });
    return () => { live = false; };
  }, []);

  async function accept() {
    setBusy(true);
    try {
      await uploads.grantConsent(consentKey.current);
      setConsent(true);
      setError(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function loadCandidates(id: string) {
    try {
      setCands(await adapters.covers.candidates(id));
      setError(null);
    } catch (e) {
      fail(e);
    }
  }

  async function afterSchedule(r: { slot: Slot; holdingId: string | null }) {
    setSchedule(r.slot);
    if (r.slot.code === "CONSENT_REQUIRED") setConsent(false);
    if (r.holdingId) {
      setHoldingId(r.holdingId);
      await loadCandidates(r.holdingId);
    }
  }

  async function takeSchedule(file: File | undefined) {
    if (!file || busy || policyType === "") return;
    setBusy(true);
    setError(null);
    try {
      const picked = pickFile(file);
      setSchedule(picked);
      await afterSchedule(await runSchedule(adapters.covers, picked, policyType));
    } finally {
      setBusy(false);
      if (scheduleInput.current) scheduleInput.current.value = "";
    }
  }

  async function retrySchedule() {
    if (busy || policyType === "") return;
    setBusy(true);
    try {
      setSchedule({ ...schedule, status: "working", code: null });
      await afterSchedule(await runSchedule(adapters.covers, schedule, policyType));
    } finally {
      setBusy(false);
    }
  }

  async function checkAgain() {
    setBusy(true);
    try {
      await afterSchedule(await checkSchedule(adapters.covers, schedule));
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    try {
      const r = await adapters.reference.products({ q: term });
      // Plan names only. The reference row also carries a registry number; it is never shown or kept.
      setFound(r.products.slice(0, 8).map((p) => ({ productId: p.productId, productName: p.productName })));
      setError(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pick || !holdingId || !cands) return;
    setBusy(true);
    setChecking(true);
    try {
      await adapters.covers.confirmProduct(holdingId, { candidateId: pick.candidateId, expectedVersion: cands.profileVersion }, confirmKey.current);
      setDone(true);
      setError(null);
    } catch (e) {
      // A new key only after a refusal the person can change; a network failure keeps the key so a retry is the same statement.
      if (["INVALID_INPUT", "HOLDING_PRODUCT_UNSUPPORTED", "POLICY_PROFILE_VERSION_CONFLICT"].includes(codeOf(e))) confirmKey.current = makeRequestKey();
      fail(e);
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }

  const top = cands?.candidates[0];
  const label = (c: CandidateView) => `${c.insurerName} – ${c.productName}`;

  return (
    <div className={s.stack}>
      <div>
        <Kicker>Your family&rsquo;s cover</Kicker>
        <PageTitle>Add a cover</PageTitle>
      </div>

      {consent === null ? <p className={s.quiet} role="status">Loading...</p> : null}

      {error ? (
        <p className={s.alert} role="alert">
          {errorText(error)} {error === "UNAUTHENTICATED" ? <Link href="/signin">Sign in</Link> : null}
        </p>
      ) : null}

      {consent === false ? (
        // FOR LEGAL REVIEW: the wording below is not final.
        <SectionHeading title="Before we start">
          <div className={s.card}>
            <p className={s.lead}>To read your policy we need to do three things with the files you add.</p>
            <ul className={s.choices}>
              <li>Keep them in your account, in encrypted storage.</li>
              <li>Check them for harmful content.</li>
              <li>Read their text with our reading service and pull out the cover details, such as sum insured and waiting periods.</li>
            </ul>
            <p className={s.lead}>Nothing is read until you say yes. You can delete a document or withdraw this at any time, and what we read from it is erased.</p>
            <label className={s.choice}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>Yes, you can do this with the documents I add.</span>
            </label>
            <div className={s.row}><button type="button" className="k-btn" disabled={!agreed || busy} onClick={() => void accept()}>{busy ? "Saving..." : "Continue"}</button></div>
          </div>
        </SectionHeading>
      ) : null}

      {consent ? (
        <SectionHeading title="Type of cover">
          <div className={s.card}>
            <label className={s.field}>
              Type of policy
              <select value={policyType} disabled={typeLocked || schedule.status !== "empty"} onChange={(e) => { setPolicyType(e.target.value as PolicyType | ""); setError(null); }} data-testid="policy-type">
                <option value="" disabled>Choose one</option>
                {POLICY_TYPES.map((t) => <option key={t} value={t}>{POLICY_TYPE_LABEL[t]}</option>)}
              </select>
            </label>
          </div>
        </SectionHeading>
      ) : null}

      {consent ? (
        <SectionHeading title="Your policy schedule" description={`PDF only, up to ${MB} MB. The schedule lists who is covered, the sum insured and the dates.`}>
          <div className={s.drop} data-over={over} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void takeSchedule(e.dataTransfer.files[0]); }}>
            <SlotStatus slot={schedule} name="Your policy schedule" />
            <input ref={scheduleInput} aria-label="Policy schedule PDF" data-testid="schedule-input" type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void takeSchedule(e.target.files?.[0])} />
            <div className={s.row}>
              {schedule.status === "empty" || schedule.status === "failed" ? (
                <button type="button" className="k-btn" disabled={busy || policyType === ""} data-slot="policy_schedule" onClick={() => scheduleInput.current?.click()}>
                  {policyType === "" ? "Choose the type of cover first" : schedule.status === "failed" ? "Choose another PDF" : "Choose the schedule PDF"}
                </button>
              ) : null}
              {canRetry(schedule) ? <button type="button" className="k-btn k-btn--secondary" disabled={busy} onClick={() => void retrySchedule()}>Try again</button> : null}
              {schedule.status === "waiting" ? <button type="button" className="k-btn k-btn--secondary" disabled={busy} onClick={() => void checkAgain()}>Check again</button> : null}
            </div>
          </div>
        </SectionHeading>
      ) : null}

      {cands && !done ? (
        <SectionHeading title="Which plan is this?">
          <div className={s.card}>
            {top && !else_ ? <p className={s.lead}>We think this is <b>{label(top)}</b>. Is that right?</p> : <p className={s.lead}>Tell us which plan this is.</p>}
            {cands.candidates.length > 0 && !else_ ? (
              <ul className={s.choices} role="radiogroup" aria-label="Plan choices">
                {cands.candidates.map((c) => (
                  <li key={c.candidateId}>
                    <label className={s.choice} data-on={pick?.candidateId === c.candidateId}>
                      <input type="radio" name="plan" checked={pick?.candidateId === c.candidateId} onChange={() => setPick({ candidateId: c.candidateId, label: label(c) })} />
                      <div><b>{c.productName}</b><span>{c.insurerName}</span></div>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
            {cands.candidates.length === 0 && !else_ ? <p className={s.quiet}>We could not tell from the first pages. Search for it below.</p> : null}
            <div className={s.row}>
              <button type="button" className="k-btn k-btn--secondary" onClick={() => { setElse((v) => !v || cands.candidates.length === 0); setPick(null); }} aria-expanded={else_ || cands.candidates.length === 0}>
                {else_ ? "Back to our guesses" : "Something else"}
              </button>
            </div>
            {else_ || cands.candidates.length === 0 ? (
              <div className={s.stack}>
                <label className={s.field}>
                  Insurer or plan name
                  <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} maxLength={100} autoComplete="off" />
                </label>
                <div className={s.row}><button type="button" className="k-btn k-btn--secondary" onClick={() => void search()} disabled={busy || !q.trim()}>Search</button></div>
                {found?.length === 0 ? <p className={s.quiet}>Nothing matched. Try fewer words.</p> : null}
                {found && found.length > 0 ? (
                  <ul className={s.choices} role="radiogroup" aria-label="Search results">
                    {found.map((p) => (
                      <li key={p.productId}>
                        <label className={s.choice} data-on={pick?.candidateId === p.productId}>
                          <input type="radio" name="plan" checked={pick?.candidateId === p.productId} onChange={() => setPick({ candidateId: p.productId, label: p.productName })} />
                          <div><b>{p.productName}</b></div>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className={s.row}>
              <button type="button" className="k-btn" onClick={() => void confirm()} disabled={busy || !pick}>{pick ? `Yes, it is ${pick.label}` : "Choose a plan"}</button>
            </div>
          </div>
        </SectionHeading>
      ) : null}

      {checking ? <p className={s.quiet} role="status" data-state="checking">Checking your insurer&rsquo;s terms&hellip;</p> : null}

      {done && holdingId ? (
        <SectionHeading title="Next">
          <div className={s.done} role="status">
            <span>Your cover is saved.</span>
            <div className={s.row}>
              <Link className="k-btn" href={`/policies/${encodeURIComponent(holdingId)}`}>Open my policy</Link>
              <Link className="k-btn k-btn--secondary" href={`/covers/review?holding=${encodeURIComponent(holdingId)}`}>See what we found</Link>
              <Link className="k-btn k-btn--secondary" href={`/covers/declarations?holding=${encodeURIComponent(holdingId)}`}>Add declarations and premium</Link>
            </div>
          </div>
        </SectionHeading>
      ) : null}
    </div>
  );
}
