"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adapters } from "@/adapters";
import { errorText } from "@/adapters/documents-contract";
import type { ConflictView, FactView, Facts, SourceView } from "@/adapters/covers-contract";
import { PageTitle, SectionHeading } from "@/components/type";
import { codeOf, useHoldings } from "./use-holdings";
import { isInsurerUnchecked } from "@/adapters/insurer-tier";
import { formatValue, groupFacts, isOpen, labelOf, pageText, sideLabel, sourceLabel, sourcePageNumber, sourceQuote, statusText, tierText } from "./format";
import { CoverOptions } from "@/components/covers/holding-label";
import s from "./covers.module.css";

function Source({ src, unit, type }: { src: SourceView; unit?: string | null; type?: string | null }) {
  return (
    <>
      <span className={s.tag}>{sideLabel(src)}</span>
      <b>{formatValue(src.value, unit, type)}</b>
      {sourceQuote(src) ? <p className={s.src}>&ldquo;{sourceQuote(src)}&rdquo;</p> : null}
    </>
  );
}

function ConflictCard({ c, onChoose, busy }: { c: ConflictView; onChoose: (c: ConflictView, factId: string) => void; busy: boolean }) {
  const sides = c.candidates.filter((x) => x.current !== false);
  const isOwn = (x: SourceView) => x.source === "own_document" || (!x.source && x.tier === "own_pdf");
  const own = sides.find(isOwn);
  const other = sides.find((x) => !isOwn(x));
  const title = c.kind === "own_vs_insurer" && own && other
    ? `Your schedule says ${formatValue(own.value, null, c.valueType)}, insurer terms say ${formatValue(other.value, null, c.valueType)}. Which is right?`
    : own && other && !c.kind
      ? `Your document says ${formatValue(own.value, null, c.valueType)}, ${tierText(other.tier).toLowerCase()} says ${formatValue(other.value, null, c.valueType)}. Which is right?`
      : "These readings do not match. Which is right?";
  return (
    <article className={s.conflict} aria-label={labelOf(c.factKey)}>
      <h3>{labelOf(c.factKey)}: {title}</h3>
      <div className={s.sides}>
        {sides.map((x) => (
          <div key={x.id} className={s.side}>
            <Source src={x} type={c.valueType} />
            <div className={s.pick}>
              <button type="button" className="k-btn k-btn--secondary" disabled={busy} onClick={() => onChoose(c, x.id)} aria-label={`Use ${sideLabel(x)} for ${labelOf(c.factKey)}`}>This one is right</button>
            </div>
          </div>
        ))}
      </div>
      {/* FOR LEGAL REVIEW: wording around a choice on a product term. Not final. */}
      {c.checkWithInsurer ? <p className={s.src}>Your choice is recorded as your own statement. The insurer&rsquo;s wording still governs, so check with the insurer.</p> : null}
    </article>
  );
}

/** The printed reading the owner can confirm: a current own-document reading, or an insurer reading that carries a quote. None once they have confirmed it. */
function confirmable(f: FactView): SourceView | null {
  if (f.status === "conflicting" || f.status === "user_confirmed") return null;
  if (f.sources.some((x) => x.tier === "user_declaration" && x.current !== false)) return null;
  const ok = (x: SourceView) => x.current !== false && (x.tier === "own_pdf" || (x.tier === "ida_wording" && x.quote != null));
  return f.sources.find((x) => x.tier === f.sourceTier && ok(x)) ?? f.sources.find(ok) ?? null;
}

function FactCard({ f, onConfirm, busy, confirming }: { f: FactView; onConfirm: (f: FactView, reading: SourceView) => void; busy: boolean; confirming: boolean }) {
  const first = f.sources.find((x) => x.tier === f.sourceTier) ?? f.sources[0];
  const insurer = isInsurerUnchecked(f.sourceTier ?? first?.tier, f.status);
  const n = first ? sourcePageNumber(first) : null;
  const page = insurer ? (n ? `Page ${n}` : null) : first ? pageText(first.page) : null;
  const quote = sourceQuote(first, f.sourceTier);
  const reading = confirmable(f);
  return (
    <li className={s.fact} data-open={isOpen(f.status)}>
      <span className={s.factName}>{labelOf(f.factKey)}</span>
      <span className={s.factValue}>{f.status === "conflicting" ? "Two readings" : formatValue(f.value, f.unit, f.valueType)}</span>
      <span className={s.status}>{f.status === "user_confirmed" ? sourceLabel(f.status, f.sourceTier) : statusText(f.status, f.sourceTier ?? first?.tier)}</span>
      {quote ? <p className={s.src}>&ldquo;{quote}&rdquo;{page ? ` · ${page}` : ""}</p> : insurer && page ? <p className={s.src}>{page}</p> : null}
      {reading ? <button type="button" className="k-btn k-btn--secondary" disabled={busy} onClick={() => onConfirm(f, reading)} aria-label={`Confirm ${labelOf(f.factKey)}`}>{confirming ? "Confirming…" : "Confirm"}</button> : null}
    </li>
  );
}

/** Review: facts grouped, amber where open, and a card for each conflict with both readings and where each came from. */
export function CoverReviewView({ holding }: { holding?: string }) {
  const { holdings, current, select, error: listError } = useHoldings(holding);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [conflicts, setConflicts] = useState<ConflictView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const id = current?.id;

  const load = useCallback(async (hid: string) => {
    try {
      const [f, c] = await Promise.all([adapters.covers.facts(hid), adapters.covers.conflicts(hid)]);
      setFacts(f);
      setConflicts(c.conflicts);
      setError(null);
    } catch (e) {
      setError(codeOf(e));
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    let live = true;
    Promise.all([adapters.covers.facts(id), adapters.covers.conflicts(id)]).then(
      ([f, c]) => { if (live) { setFacts(f); setConflicts(c.conflicts); setError(null); } },
      (e) => { if (live) setError(codeOf(e)); },
    );
    return () => { live = false; };
  }, [id]);

  async function choose(c: ConflictView, chosenFactId: string) {
    if (!id || busy) return;
    setBusy(true);
    setNote(null);
    try {
      await adapters.covers.resolveConflict(id, c.id, { chosenFactId });
      setNote(`${labelOf(c.factKey)} settled.`);
      await load(id);
    } catch (e) {
      setError(codeOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(f: FactView, reading: SourceView) {
    if (!id || busy) return;
    setBusy(true);
    setConfirming(f.factKey);
    setNote(null);
    try {
      await adapters.covers.confirmReading(id, reading.id);
      await load(id);
    } catch (e) {
      const code = codeOf(e);
      setError(code.includes("NOT_FOUND") ? "READING_CHANGED" : code);
    } finally {
      setConfirming(null);
      setBusy(false);
    }
  }

  const pending = conflicts.filter((c) => c.resolution === "pending");
  const groups = facts ? groupFacts(facts.facts) : [];

  return (
    <div className={s.stack}>
      <div>
        <PageTitle>What we found in your policy</PageTitle>
      </div>

      {holdings && holdings.length > 1 ? (
        <label className={s.field}>Cover
          <select value={id} onChange={(e) => { setFacts(null); select(e.target.value); }}>
            <CoverOptions holdings={holdings} />
          </select>
        </label>
      ) : null}

      {listError || error ? <p className={s.alert} role="alert">{error === "READING_CHANGED" ? "That reading has changed. Refresh the page and try again." : errorText(error ?? listError ?? "")}</p> : null}
      {note ? <p className={s.done} role="status">{note}</p> : null}

      {holdings && holdings.length === 0 && !listError ? (
        <SectionHeading title="No policy yet">
          <div className={s.card}>
            <p className={s.lead}>Add your policy and we will read it for you.</p>
            <div className={s.row}><Link className="k-btn" href="/covers/add">Add a policy</Link></div>
          </div>
        </SectionHeading>
      ) : null}

      {pending.length > 0 ? (
        <SectionHeading title="Needs your decision" description="Two readings of the same thing do not match. You choose.">
          <div className={s.stack}>{pending.map((c) => <ConflictCard key={c.id} c={c} onChoose={(cc, fid) => void choose(cc, fid)} busy={busy} />)}</div>
        </SectionHeading>
      ) : null}

      {facts && facts.facts.length === 0 && holdings && holdings.length > 0 ? (
        <SectionHeading title="Details found"><p className={s.quiet}>Nothing read yet. Confirm your plan on Add a policy, then check back.</p></SectionHeading>
      ) : null}

      {groups.length > 0 ? (
        <div className={s.groups}>
          {groups.map((g) => (
            <SectionHeading key={g.label} title={g.label}>
              <ul className={s.facts}>{g.facts.map((f) => <FactCard key={f.factKey} f={f} onConfirm={(ff, r) => void confirm(ff, r)} busy={busy} confirming={confirming === f.factKey} />)}</ul>
            </SectionHeading>
          ))}
        </div>
      ) : null}

      {facts && facts.unknownKeys.length > 0 ? <p className={s.quiet}>{facts.unknownKeys.length} {facts.unknownKeys.length === 1 ? "detail was" : "details were"} not found in your document.</p> : null}

      <div className={s.row}>
        <Link className="k-btn k-btn--secondary" href="/covers/declarations">Declarations and money</Link>
        <Link className="k-btn k-btn--secondary" href={id ? `/hospitals?holding=${encodeURIComponent(id)}` : "/hospitals"}>Network hospitals</Link>
        <Link className="k-btn k-btn--secondary" href="/chat">Ask about your cover</Link>
      </div>
    </div>
  );
}
