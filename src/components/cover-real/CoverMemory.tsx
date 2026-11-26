"use client";

// Household Cover Memory: the one page that shows a family's whole cover, built by the backend from every policy and shown as markdown.
// It exists beside MemoryDocument (one policy) and reuses its markdown reader and section blocks, so both read the same way.

import { useEffect, useState } from "react";
import { adapters } from "@/adapters";
import { AdapterError } from "@/adapters/types";
import s from "@/components/covers/covers.module.css";
import { MemoryDocumentBody } from "./MemoryDocument";

type Load = { phase: "ready"; markdown: string } | { phase: "error"; code: string };
const OFF_CODES = ["MEMORY_DISABLED", "HOLDINGS_DISABLED"];
const MISSING_CODES = ["NOT_FOUND"];

/** Loads and shows the household cover memory: loading, calm not-on / not-ready states, retryable error, and the document. Raw error text is never shown. */
export function CoverMemory() {
  const [attempt, setAttempt] = useState(0);
  // The answer is tagged with the request it belongs to, so a retry reads as loading until its own answer arrives.
  const [answer, setAnswer] = useState<{ attempt: number; load: Load } | null>(null);
  useEffect(() => {
    let live = true;
    adapters.covers.coverMemory().then(
      (markdown) => { if (live) setAnswer({ attempt, load: { phase: "ready", markdown } }); },
      (e: unknown) => { if (live) setAnswer({ attempt, load: { phase: "error", code: e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE" } }); },
    );
    return () => { live = false; };
  }, [attempt]);
  const load = answer?.attempt === attempt ? answer.load : null;
  if (!load) return <p className={s.quiet} role="status" data-testid="cover-memory">Loading your cover memory...</p>;
  if (load.phase === "error") {
    if (OFF_CODES.includes(load.code)) return <p className={s.quiet} role="status" data-testid="cover-memory">Your cover memory is not switched on yet.</p>;
    if (MISSING_CODES.includes(load.code)) return <p className={s.quiet} role="status" data-testid="cover-memory">Your cover memory is not ready yet.</p>;
    return (
      <div data-testid="cover-memory">
        <p className={s.quiet} role="alert">We could not load your cover memory.</p>
        <button type="button" className="k-btn k-btn--secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
      </div>
    );
  }
  return <div data-testid="cover-memory"><MemoryDocumentBody markdown={load.markdown} /></div>;
}
