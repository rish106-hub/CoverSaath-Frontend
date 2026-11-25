"use client";

import { useEffect, useState } from "react";
import { adapters } from "@/adapters";
import { AdapterError } from "@/adapters/types";
import { SectionHeading } from "@/components/type";
import s from "@/components/covers/covers.module.css";

// The owner's memory document (policy.md) for one cover, rendered from the markdown the backend sends (ADR 0039). Sections show in the
// order the backend writes them. Each fact line is split into its statement, a tier label (whose reading it is: the person's own
// document, the insurer's wording, or the person), its quote, and its citation (document, page, clause). The text is shown as text:
// nothing in it is run or linked. Not shown when the backend has it off (MEMORY_DISABLED / HOLDINGS_DISABLED).

export type MdBlock = { kind: "title" | "heading" | "note" | "text"; text: string } | { kind: "list"; items: string[] };

/** A small, safe reader for the shapes the backend writes: `# title`, `## section`, `> notice`, `- line`, plain text. Everything else is plain text. */
export function parseMemoryMarkdown(markdown: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("## ")) blocks.push({ kind: "heading", text: line.slice(3).trim() });
    else if (line.startsWith("# ")) blocks.push({ kind: "title", text: line.slice(2).trim() });
    else if (line.startsWith("> ")) blocks.push({ kind: "note", text: line.slice(2).trim() });
    else if (/^\s*-\s+/.test(line)) {
      const item = line.replace(/^\s*-\s+/, "");
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "list") last.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
    } else blocks.push({ kind: "text", text: line.trim() });
  }
  return blocks;
}

const TAG_KIND: Record<string, string> = { insurer_wording: "insurer's wording", own_pdf: "your document", policy_schedule: "policy schedule", policy_wording: "policy terms and conditions", endorsement: "endorsement", document: "your document" };

/** The backend's machine tags in plain words: "[unknown]" (not found), "[owner statement]" (you told us), "[insurer_wording, p.9]" (insurer's wording, page 9). */
export function plainTags(line: string): string {
  return line.replace(/\s*\[([a-z_ ]+)(?:,\s*p\.(\d+))?(?:,\s*[^\]]*)?\]/g, (_m, kind: string, page?: string) => {
    const k = kind.trim();
    const name = k === "unknown" ? "not found" : k === "owner statement" ? "you told us" : k === "policy record" ? "policy record" : TAG_KIND[k] ?? "another source";
    return ` (${name}${page ? `, page ${page}` : ""})`;
  });
}

export type Tier = "insurer_unchecked" | "insurer" | "own_unverified" | "owner" | "none";
const TIER_LABEL: Record<Tier, string> = { insurer_unchecked: "Insurer's wording, not checked", insurer: "Insurer's wording", own_unverified: "Your document, not verified", owner: "You stated this", none: "" };
// The backend's status phrases (services/memory-document.js and fact-source-label.js), matched case-insensitively. Older mock wording is kept so stored markdown still reads.
const TIER_PHRASES: [RegExp, Tier][] = [
  [/\s*\((?:from the )?insurer(?:'s)? wording,? not checked\)/i, "insurer_unchecked"],
  [/\s*\(insurer wording\)/i, "insurer"],
  [/\s*\(read from your (?:document|policy schedule)[^)]*\)/i, "own_unverified"],
  [/\s*\(you stated this\)/i, "owner"],
];

export type Citation = { kind: "unknown" | "owner" | "record" | "source"; source?: string; page?: string; clause?: string };
export type MemoryLine = { statement: string; tier: Tier; quote: string | null; citation: Citation | null; checkWithInsurer: boolean; none: boolean };

/** One backend list line -> its parts. Line shape: `Label value (status) Check with the insurer. Quote: "..." [kind, p.N, clause X]`. */
export function parseMemoryLine(item: string): MemoryLine {
  let rest = item.trim();
  let citation: Citation | null = null;
  const tag = /\s*\[([^\]]*)\]\s*$/.exec(rest);
  if (tag) {
    rest = rest.slice(0, tag.index);
    const parts = (tag[1] ?? "").split(",").map((x) => x.trim());
    const head = parts[0] ?? "";
    if (head === "unknown") citation = { kind: "unknown" };
    else if (head === "owner statement") citation = { kind: "owner" };
    else if (head === "policy record") citation = { kind: "record" };
    else citation = {
      kind: "source", source: TAG_KIND[head] ?? "another source",
      page: parts.map((x) => /^p\.(\d+)$/.exec(x)?.[1]).find(Boolean),
      clause: parts.map((x) => /^clause\s+(.+)$/.exec(x)?.[1]).find(Boolean),
    };
  }
  let quote: string | null = null;
  const q = /\s*Quote: "([\s\S]*)"\s*$/.exec(rest);
  if (q) { quote = q[1] ?? null; rest = rest.slice(0, q.index); }
  let tier: Tier = citation?.kind === "owner" ? "owner" : "none";
  for (const [re, kind] of TIER_PHRASES) if (re.test(rest)) { tier = kind; rest = rest.replace(re, ""); break; }
  const check = /\s*Check with the insurer\.?/i.test(rest);
  rest = rest.replace(/\s*Check with the insurer\.?/i, "").trim();
  return { statement: rest, tier, quote, citation, checkWithInsurer: check, none: /^none recorded\.?$/i.test(rest) };
}

const citationText = (c: Citation): string => {
  if (c.kind === "unknown") return "Not found in your documents";
  if (c.kind === "owner") return "You told us";
  if (c.kind === "record") return "Policy record";
  return [c.source, c.page ? `page ${c.page}` : null, c.clause ? `clause ${c.clause}` : null].filter(Boolean).join(", ").replace(/^./, (x) => x.toUpperCase());
};

// Every text node wraps (overflow-wrap anywhere, min-width 0): a long quote must never push the page wider than a 375px screen.
const wrap = { overflowWrap: "anywhere", minWidth: 0 } as const;
const lineBox = { display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--sheet)", font: "400 14px/1.45 var(--font-sans)", color: "var(--ink)", ...wrap } as const;
const badge = { alignSelf: "flex-start", maxWidth: "100%", padding: "2px 8px", borderRadius: "var(--r-md)", background: "var(--mist)", font: "600 12px var(--font-sans)", color: "var(--graphite)", ...wrap } as const;
const quoteBox = { margin: 0, paddingLeft: 10, borderLeft: "2px solid var(--line)", font: "italic 400 13px/1.4 var(--font-sans)", color: "var(--graphite)", ...wrap } as const;
const citeText = { margin: 0, font: "400 12px/1.4 var(--font-sans)", color: "var(--graphite)", ...wrap } as const;

/** One fact line: the statement, its tier label, the quote the reading rests on, and where it came from. */
export function MemoryLineView({ item }: { item: string }) {
  const line = parseMemoryLine(item);
  if (line.none) return <li data-testid="memory-line-none" style={{ listStyle: "none", ...citeText }}>Nothing recorded here yet.</li>;
  return (
    <li data-testid="memory-line" data-tier={line.tier} style={{ listStyle: "none", ...lineBox }}>
      <span style={wrap}>{line.statement}</span>
      {line.tier !== "none" ? <span data-testid="memory-tier" style={badge}>{TIER_LABEL[line.tier]}</span> : null}
      {line.checkWithInsurer ? <span style={citeText}>Check with the insurer.</span> : null}
      {line.quote ? <blockquote data-testid="memory-quote" style={quoteBox}>&ldquo;{line.quote}&rdquo;</blockquote> : null}
      {line.citation ? <p data-testid="memory-citation" style={citeText}>{citationText(line.citation)}</p> : null}
    </li>
  );
}

/** The sections as headed blocks, in the order written. The document's own `# title` line is not shown twice: the page has its own heading. */
export function MemoryDocumentBody({ markdown }: { markdown: string }) {
  const blocks = parseMemoryMarkdown(markdown).filter((b) => b.kind !== "title");
  const out: { title: string | null; blocks: MdBlock[] }[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") out.push({ title: b.text, blocks: [] });
    else {
      if (out.length === 0) out.push({ title: null, blocks: [] });
      (out[out.length - 1] as (typeof out)[number]).blocks.push(b);
    }
  }
  return (
    <div className={s.stack} style={{ minWidth: 0, paddingBottom: 0 }} data-testid="memory-document">
      {out.map((sec, i) => {
        const body = sec.blocks.map((b, j) => b.kind === "list"
          ? <ul key={j} style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>{b.items.map((it, k) => <MemoryLineView key={k} item={it} />)}</ul>
          : <p key={j} className={b.kind === "note" ? s.quiet : s.src} style={wrap}>{b.text}</p>);
        return sec.title ? <SectionHeading key={i} title={sec.title}>{body}</SectionHeading> : <div key={i}>{body}</div>;
      })}
    </div>
  );
}

type Load = { phase: "ready"; markdown: string } | { phase: "error"; code: string };
/** Backend switches that are simply off: the section is left out rather than shown as a failure. */
const OFF_CODES = ["MEMORY_DISABLED", "HOLDINGS_DISABLED"];
const ERROR_TEXT: Record<string, string> = {
  CONSENT_REQUIRED: "This summary is hidden because your go-ahead to read this document is no longer active.",
  NOT_FOUND: "We could not find this policy.",
  HOLDING_NOT_FOUND: "We could not find this policy.",
};
const hasContent = (markdown: string): boolean => parseMemoryMarkdown(markdown).some((b) => b.kind === "list" && b.items.some((i) => !parseMemoryLine(i).none));

/** Loads and shows the memory document of one holding: loading, error (with retry), empty and ready states. Hidden when the backend has it off. */
export function MemoryDocument({ holdingId }: { holdingId: string }) {
  const [attempt, setAttempt] = useState(0);
  // The result is tagged with the request it answers, so a new holding or a retry reads as loading until its own answer arrives.
  const request = `${holdingId}#${attempt}`;
  const [answer, setAnswer] = useState<{ request: string; load: Load } | null>(null);
  useEffect(() => {
    let live = true;
    adapters.covers.memoryDocument(holdingId).then(
      (markdown) => { if (live) setAnswer({ request, load: { phase: "ready", markdown } }); },
      (e: unknown) => { if (live) setAnswer({ request, load: { phase: "error", code: e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE" } }); },
    );
    return () => { live = false; };
  }, [holdingId, request]);
  const load = answer?.request === request ? answer.load : null;
  if (load?.phase === "error" && OFF_CODES.includes(load.code)) return null;
  const title = "Policy summary";
  if (!load) return <SectionHeading title={title}><p className={s.quiet} role="status">Loading your policy summary...</p></SectionHeading>;
  if (load.phase === "error") {
    return (
      <SectionHeading title={title}>
        <p className={s.quiet} role="alert">{ERROR_TEXT[load.code] ?? "We could not load your policy summary."}</p>
        {ERROR_TEXT[load.code] ? null : <button type="button" className="k-btn k-btn--secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
      </SectionHeading>
    );
  }
  if (!hasContent(load.markdown)) return <SectionHeading title={title}><p className={s.quiet}>Nothing has been recorded for this policy yet.</p></SectionHeading>;
  return <SectionHeading title={title}><MemoryDocumentBody markdown={load.markdown} /></SectionHeading>;
}
