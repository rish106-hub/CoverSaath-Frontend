"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { adapters } from "@/adapters";
import { MAX_UPLOAD_BYTES, errorText } from "@/adapters/documents-contract";
import { makeRequestKey } from "@/adapters/uploads";
import type { CandidateView, Candidates } from "@/adapters/covers-contract";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { codeOf } from "./use-holdings";
import s from "./covers.module.css";

const MB = MAX_UPLOAD_BYTES / 1024 / 1024;
type Pick = { candidateId: string; label: string } | null;

/** Add cover: drop a PDF, say which plan it is (up to three guesses, or search), confirm. Insurer and plan names only; never a UIN. */
export function AddCoverView() {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [cands, setCands] = useState<Candidates | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [else_, setElse] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ productId: string; productName: string }[] | null>(null);
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uploadKey = useRef(makeRequestKey());
  const confirmKey = useRef(makeRequestKey());

  const fail = (e: unknown) => setError(codeOf(e));

  async function loadCandidates(id: string) {
    try {
      setCands(await adapters.covers.candidates(id));
      setError(null);
    } catch (e) {
      fail(e);
    }
  }

  async function take(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await adapters.covers.upload(file, uploadKey.current);
      uploadKey.current = makeRequestKey();
      setDocId(r.documentId);
      if (r.holdingId) {
        setHoldingId(r.holdingId);
        await loadCandidates(r.holdingId);
      } else {
        setWaiting(true);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function checkAgain() {
    setBusy(true);
    try {
      const mine = (await adapters.covers.holdings()).find((h) => h.documentId === docId);
      if (mine) {
        setHoldingId(mine.id);
        setWaiting(false);
        await loadCandidates(mine.id);
      }
    } catch (e) {
      fail(e);
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

      <SectionHeading title="Your policy PDF" description={`One PDF at a time, up to ${MB} MB.`}>
        <div className={s.drop} data-over={over} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}>
          <p className={s.quiet}>Drop your policy here, or choose it from your device.</p>
          <input ref={input} aria-label="Policy PDF" type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void take(e.target.files?.[0])} />
          <button type="button" className="k-btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Working on it" : "Choose a PDF"}</button>
        </div>
        {error ? (
          <p className={s.alert} role="alert">
            {errorText(error)}
            {error === "CONSENT_REQUIRED" ? <> <Link href="/upload">Give your go-ahead on Add a policy</Link>, then come back.</> : null}
          </p>
        ) : null}
      </SectionHeading>

      {waiting ? (
        <SectionHeading title="Getting your policy ready">
          <div className={s.card}>
            <p className={s.lead}>Your PDF is in. We are still setting it up.</p>
            <div className={s.row}><button type="button" className="k-btn k-btn--secondary" onClick={() => void checkAgain()} disabled={busy}>Check again</button></div>
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

      {done && holdingId ? (
        <SectionHeading title="Next">
          <div className={s.done} role="status">
            <span>Saved. We are reading the plan against your document.</span>
            <div className={s.row}>
              <Link className="k-btn" href={`/covers/review?holding=${encodeURIComponent(holdingId)}`}>See what we found</Link>
              <Link className="k-btn k-btn--secondary" href={`/covers/declarations?holding=${encodeURIComponent(holdingId)}`}>Add declarations and premium</Link>
            </div>
          </div>
        </SectionHeading>
      ) : null}
    </div>
  );
}
