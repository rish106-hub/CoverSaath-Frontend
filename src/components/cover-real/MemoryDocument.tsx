"use client";

import { useEffect, useState } from "react";
import { adapters } from "@/adapters";
import { SectionHeading } from "@/components/type";
import s from "@/components/covers/covers.module.css";

// The owner's memory document (policy.md) for one cover, rendered from the markdown the backend sends (ADR 0039). Lines about the
// insurer's wording carry "(insurer wording, not checked)" and a "[insurer_wording, p.N]" tag, so they read apart from the lines read
// from the person's own document. The text is shown as text: nothing in it is run or linked. Not shown when the backend has it off.

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

/** The sections as headed blocks. The document's own `# title` line is not shown twice: the page has its own heading. */
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
    <div className={s.stack} data-testid="memory-document">
      {out.map((sec, i) => {
        const body = sec.blocks.map((b, j) => b.kind === "list"
          ? <ul key={j} className={s.facts}>{b.items.map((it, k) => <li key={k} className={s.src}>{it}</li>)}</ul>
          : <p key={j} className={b.kind === "note" ? s.quiet : s.src}>{b.kind === "title" || b.kind === "heading" ? "" : b.text}</p>);
        return sec.title ? <SectionHeading key={i} title={sec.title}>{body}</SectionHeading> : <div key={i}>{body}</div>;
      })}
    </div>
  );
}

/** Loads and shows the memory document of one holding. Any failure (off on the backend, reading consent withdrawn, not found) shows nothing. */
export function MemoryDocument({ holdingId }: { holdingId: string }) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    adapters.covers.memoryDocument(holdingId).then((m) => { if (live) setMarkdown(m); }, () => { if (live) setMarkdown(null); });
    return () => { live = false; };
  }, [holdingId]);
  if (!markdown) return null;
  return <SectionHeading title="What we hold about this policy"><MemoryDocumentBody markdown={markdown} /></SectionHeading>;
}
