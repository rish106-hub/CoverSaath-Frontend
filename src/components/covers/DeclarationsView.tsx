"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adapters } from "@/adapters";
import { errorText } from "@/adapters/documents-contract";
import type { MemberRecord } from "@/adapters/scenarios";
import { DECLARATION_KINDS, PAID_VIA, PAYMENT_CHANNELS, type DeclarationKind, type DeclarationView, type PaidVia, type PaymentChannel, type PremiumView } from "@/adapters/covers-contract";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { codeOf, useHoldings } from "./use-holdings";
import { formatValue, todayIso } from "./format";
import s from "./covers.module.css";

const KIND_TEXT: Record<DeclarationKind, string> = {
  pre_existing_disease: "Pre-existing condition", prior_condition: "Past condition", habit: "Habit", occupation: "Occupation", nominee: "Nominee", other: "Something else",
};
const CHANNEL_TEXT: Record<PaymentChannel, string> = { upi: "UPI", card: "Card", netbanking: "Net banking", cheque: "Cheque", cash: "Cash", salary_deduction: "Salary deduction", unknown: "Not sure" };
const VIA_TEXT: Record<PaidVia, string> = { self: "I paid directly", agent: "Through an agent", employer: "My employer", bank: "My bank" };

/** Rupees typed by a person to whole paise, or null when it is not a positive amount with at most two decimals. */
export function paiseFrom(text: string): number | null {
  const t = text.replace(/[,\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100);
  return n > 0 ? n : null;
}

/** Declarations and money. Skippable: the review works without it, but answers about waiting periods and claims are firmer with it. */
export function DeclarationsView({ holding }: { holding?: string }) {
  const { current } = useHoldings(holding);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [decls, setDecls] = useState<DeclarationView[]>([]);
  const [pays, setPays] = useState<PremiumView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Declaration form
  const [memberId, setMemberId] = useState("");
  const [kind, setKind] = useState<DeclarationKind>("pre_existing_disease");
  const [label, setLabel] = useState("");
  const [declaredOn, setDeclaredOn] = useState("");
  const [toInsurer, setToInsurer] = useState<"" | "yes" | "no">("");
  // Premium form
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [channel, setChannel] = useState<PaymentChannel>("upi");
  const [via, setVia] = useState<PaidVia>("self");
  const [agentName, setAgentName] = useState("");
  const [agentCode, setAgentCode] = useState("");

  useEffect(() => {
    let live = true;
    adapters.members.list().then((m) => { if (live) { setMembers(m); setMemberId((cur) => cur || m[0]?.id || ""); } }, () => undefined);
    adapters.covers.declarations().then((d) => { if (live) setDecls(d); }, (e) => { if (live) setError(codeOf(e)); });
    adapters.covers.premiums().then((p) => { if (live) setPays(p); }, (e) => { if (live) setError(codeOf(e)); });
    return () => { live = false; };
  }, []);

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "A family member";
  const reviewHref = current ? `/covers/review?holding=${encodeURIComponent(current.id)}` : "/covers/review";

  async function addDeclaration(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !memberId || !label.trim()) return;
    setBusy(true);
    setSaved(null);
    try {
      const row = await adapters.covers.addDeclaration({
        memberId, kind, label: label.trim(), declaredOn: declaredOn || null, declaredToInsurer: toInsurer === "" ? null : toInsurer === "yes", holdingId: current?.id ?? null,
      });
      setDecls((d) => [...d, row]);
      setLabel("");
      setDeclaredOn("");
      setToInsurer("");
      setError(null);
      setSaved("Declaration saved.");
    } catch (err) {
      setError(codeOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function addPremium(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !current) return;
    const paise = paiseFrom(amount);
    if (paise === null) { setError("INVALID_INPUT"); return; }
    setBusy(true);
    setSaved(null);
    try {
      const row = await adapters.covers.addPremium({
        holdingId: current.id, amountPaise: paise, paidOn, channel, paidVia: via,
        agentName: via === "agent" && agentName.trim() ? agentName.trim() : null, agentCode: via === "agent" && agentCode.trim() ? agentCode.trim() : null,
      });
      setPays((p) => [...p, row]);
      setAmount("");
      setAgentName("");
      setAgentCode("");
      setError(null);
      setSaved("Premium saved.");
    } catch (err) {
      setError(codeOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.stack}>
      <div>
        <Kicker>Your family&rsquo;s cover</Kicker>
        <PageTitle>Declarations and money</PageTitle>
        <p className={s.quiet}>You can skip this and come back. With it, answers about waiting periods and claims fit you better.</p>
      </div>
      {error ? <p className={s.alert} role="alert">{errorText(error)}</p> : null}
      {saved ? <p className={s.done} role="status">{saved}</p> : null}

      <SectionHeading title="What you told the insurer" description="Health conditions, habits and your nominee, for each person on the policy.">
        {/* FOR LEGAL REVIEW: wording about health details. Not final. */}
        <form className={s.card} onSubmit={(e) => void addDeclaration(e)}>
          <p className={s.quiet}>These are about health, so we keep them sealed and use them only to answer your questions.</p>
          {members.length === 0 ? <p className={s.quiet}>Add the people on this policy first. <Link href="/family">Open My family</Link></p> : null}
          <div className={s.grid2}>
            <label className={s.field}>Person
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} required>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </label>
            <label className={s.field}>Kind
              <select value={kind} onChange={(e) => setKind(e.target.value as DeclarationKind)}>{DECLARATION_KINDS.map((k) => <option key={k} value={k}>{KIND_TEXT[k]}</option>)}</select>
            </label>
          </div>
          <label className={s.field}>Details
            <textarea value={label} onChange={(e) => setLabel(e.target.value)} maxLength={500} required />
          </label>
          <div className={s.grid2}>
            <label className={s.field}>Declared on
              <input type="date" value={declaredOn} onChange={(e) => setDeclaredOn(e.target.value)} />
            </label>
            <label className={s.field}>Told the insurer?
              <select value={toInsurer} onChange={(e) => setToInsurer(e.target.value as "" | "yes" | "no")}>
                <option value="">Not sure</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </label>
          </div>
          <div className={s.row}><button type="submit" className="k-btn" disabled={busy || !memberId || !label.trim()}>Save declaration</button></div>
        </form>
        {decls.length > 0 ? (
          <ul className={s.list} aria-label="Saved declarations">
            {decls.map((d) => <li key={d.id} className={s.entry}><b>{nameOf(d.memberId)}: {KIND_TEXT[d.kind]}</b><span>{d.label}</span></li>)}
          </ul>
        ) : null}
      </SectionHeading>

      <SectionHeading title="Premium you paid" description="When, how much and how, so renewals and claims line up.">
        <form className={s.card} onSubmit={(e) => void addPremium(e)}>
          {!current ? <p className={s.quiet}>Add a cover first. <Link href="/covers/add">Add a cover</Link></p> : null}
          <div className={s.grid2}>
            <label className={s.field}>Amount in rupees
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" required />
            </label>
            <label className={s.field}>Paid on
              <input type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} required />
            </label>
            <label className={s.field}>How
              <select value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel)}>{PAYMENT_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_TEXT[c]}</option>)}</select>
            </label>
            <label className={s.field}>Via
              <select value={via} onChange={(e) => setVia(e.target.value as PaidVia)}>{PAID_VIA.map((v) => <option key={v} value={v}>{VIA_TEXT[v]}</option>)}</select>
            </label>
          </div>
          {via === "agent" ? (
            <div className={s.grid2}>
              <label className={s.field}>Agent name<input value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={120} autoComplete="off" /></label>
              <label className={s.field}>Agent code<input value={agentCode} onChange={(e) => setAgentCode(e.target.value)} maxLength={120} autoComplete="off" /></label>
            </div>
          ) : null}
          <div className={s.row}><button type="submit" className="k-btn" disabled={busy || !current || paiseFrom(amount) === null}>Save premium</button></div>
        </form>
        {pays.length > 0 ? (
          <ul className={s.list} aria-label="Saved premiums">
            {pays.map((p) => <li key={p.id} className={s.entry}><b>{formatValue(p.amountPaise, "paise")}</b><span>{p.paidOn} &middot; {CHANNEL_TEXT[p.channel as PaymentChannel] ?? "Not sure"}</span></li>)}
          </ul>
        ) : null}
      </SectionHeading>

      <div className={s.row}>
        <Link className="k-btn" href={reviewHref}>Continue to review</Link>
        <Link className="k-btn k-btn--secondary" href={reviewHref}>Skip for now</Link>
      </div>
    </div>
  );
}
