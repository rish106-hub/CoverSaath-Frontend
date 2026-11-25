"use client";

import { useState } from "react";
import { adapters } from "@/adapters";
import { AdapterError } from "@/adapters/types";
import { PASSAGE_QUERY, type Passages } from "@/adapters/evidence-contract";
import { insurerLine } from "@/adapters/insurer-tier";
import { SectionHeading } from "@/components/type";
import s from "@/components/covers/covers.module.css";

// Search your policy wording. Two lists, kept apart: passages from the person's own documents, and passages from the insurer's wording for
// the linked plan, each labelled "From the insurer's wording, not checked" (FOR LEGAL REVIEW). A passage is a short snippet, not an
// answer. There is no link from an insurer passage to a document of the household: there is none behind it.

export function PassageResults({ result }: { result: Passages }) {
  const none = result.passages.length === 0 && result.insurerPassages.length === 0;
  if (none) return <p className={s.quiet}>Nothing found for that.</p>;
  return (
    <div className={s.stack} data-testid="passage-results">
      {/* FOR LEGAL REVIEW: the backend's own notice that passages are not answers. */}
      {result.notice ? <p className={s.quiet}>{result.notice}</p> : null}
      {result.passages.length > 0 ? (
        <section aria-label="From your documents">
          <p className={s.quiet}>From your documents</p>
          <ul className={s.facts}>
            {result.passages.map((p, i) => <li key={p.clauseId ?? i} className={s.src}>&ldquo;{p.snippet}&rdquo;{p.page ? ` · Page ${p.page}` : ""}</li>)}
          </ul>
        </section>
      ) : null}
      {result.insurerPassages.length > 0 ? (
        <section aria-label="Insurer wording" data-source="insurer_wording">
          <p className={s.quiet}>{insurerLine()}</p>
          <ul className={s.facts}>
            {result.insurerPassages.map((p) => <li key={p.chunkId} className={s.src}>&ldquo;{p.snippet}&rdquo;{p.page ? ` · Page ${p.page}` : ""}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Searches the case behind this holding. When the session's case is not this holding's the backend says NOT_FOUND and the search is hidden. */
export function PassageSearch({ holdingId }: { holdingId: string }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<Passages | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = PASSAGE_QUERY.test(q.trim());
  const run = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try { setResult(await adapters.evidence.holdingPassages(holdingId, q.trim(), 5)); } catch (e) { setResult(null); setError(e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE"); } finally { setBusy(false); }
  };
  if (error === "NOT_FOUND") return null;
  return (
    <SectionHeading title="Search your policy wording">
      <form className={s.row} onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <input className={s.field} aria-label="Search the policy wording" placeholder="For example: waiting period" maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="k-btn k-btn--secondary" disabled={!valid || busy}>Search</button>
      </form>
      {error ? <p className={s.quiet} role="status">{error === "READBACK_DISABLED" ? "Searching the wording is not available right now." : "Could not search. Try again."}</p> : null}
      {result ? <PassageResults result={result} /> : null}
    </SectionHeading>
  );
}
