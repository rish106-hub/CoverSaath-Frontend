"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adapters } from "@/adapters";
import { errorText } from "@/adapters/documents-contract";
import type { ConflictView, FactView, Facts, SourceView } from "@/adapters/covers-contract";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { codeOf, useHoldings } from "./use-holdings";
import { STATUS_TEXT, formatValue, groupFacts, isOpen, labelOf, pageText, sideLabel, sourceLabel, tierText } from "./format";
import s from "./covers.module.css";

function Source({ src, unit, type }: { src: SourceView; unit?: string | null; type?: string | null }) {
  return (
    <>
      <span className={s.tag}>{sideLabel(src)}</span>
      <b>{formatValue(src.value, unit, type)}</b>
      {src.quote ? <p className={s.src}>&ldquo;{src.quote}&rdquo;</p> : null}
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

function FactCard({ f }: { f: FactView }) {
  const first = f.sources.find((x) => x.tier === f.sourceTier) ?? f.sources[0];
  const page = first ? pageText(first.page) : null;
  return (
    <li className={s.fact} data-open={isOpen(f.status)}>
      <span className={s.factName}>{labelOf(f.factKey)}</span>
      <span className={s.factValue}>{f.status === "conflicting" ? "Two readings" : formatValue(f.value, f.unit, f.valueType)}</span>
      <span className={s.status}>{f.status === "user_confirmed" ? sourceLabel(f.status, f.sourceTier) : STATUS_TEXT[f.status]}</span>
      {first?.quote ? <p className={s.src}>&ldquo;{first.quote}&rdquo;{page ? ` · ${page}` : ""}</p> : null}
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

  const pending = conflicts.filter((c) => c.resolution === "pending");
  const groups = facts ? groupFacts(facts.facts) : [];

  return (
    <div className={s.stack}>
      <div>
        <Kicker>Your family&rsquo;s cover</Kicker>
        <PageTitle>What we found in your policy</PageTitle>
      </div>

      {holdings && holdings.length > 1 ? (
        <label className={s.field}>Cover
          <select value={id} onChange={(e) => { setFacts(null); select(e.target.value); }}>
            {holdings.map((h, i) => <option key={h.id} value={h.id}>{`Cover ${i + 1}`}</option>)}
          </select>
        </label>
      ) : null}

      {listError || error ? <p className={s.alert} role="alert">{errorText(error ?? listError ?? "")}</p> : null}
      {note ? <p className={s.done} role="status">{note}</p> : null}

      {holdings && holdings.length === 0 && !listError ? (
        <SectionHeading title="No cover yet">
          <div className={s.card}>
            <p className={s.lead}>Add your policy and we will read it for you.</p>
            <div className={s.row}><Link className="k-btn" href="/covers/add">Add a cover</Link></div>
          </div>
        </SectionHeading>
      ) : null}

      {pending.length > 0 ? (
        <SectionHeading title="Needs your decision" description="Two readings of the same thing do not match. You choose.">
          <div className={s.stack}>{pending.map((c) => <ConflictCard key={c.id} c={c} onChoose={(cc, fid) => void choose(cc, fid)} busy={busy} />)}</div>
        </SectionHeading>
      ) : null}

      {facts && facts.facts.length === 0 && holdings && holdings.length > 0 ? (
        <SectionHeading title="Facts"><p className={s.quiet}>Nothing has been read yet. Confirm your plan on Add a cover, then check back.</p></SectionHeading>
      ) : null}

      {groups.length > 0 ? (
        <div className={s.groups}>
          {groups.map((g) => (
            <SectionHeading key={g.label} title={g.label}>
              <ul className={s.facts}>{g.facts.map((f) => <FactCard key={f.factKey} f={f} />)}</ul>
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
