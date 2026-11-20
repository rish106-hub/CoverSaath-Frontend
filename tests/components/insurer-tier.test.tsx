// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { INSURER_UNCHECKED_LABEL, clipQuote, isInsurerUnchecked } from "@/adapters/insurer-tier";
import { factsIn, type FactView } from "@/adapters/covers-contract";
import { factLine } from "@/adapters/real-policy";
import { citationLines, insurerQuotes } from "@/components/chat/ChatView";
import { SourceLine } from "@/components/agent/SourceLine";
import { MemoryDocumentBody, parseMemoryMarkdown } from "@/components/cover-real/MemoryDocument";
import { PassageResults } from "@/components/cover-real/PassageSearch";
import { passagesOut } from "@/adapters/evidence-contract";
import { mockCovers } from "@/adapters/mock/covers";
import { mockEvidence } from "@/adapters/mock/evidence";
import { mockChat } from "@/adapters/mock/chat";
import { answerSourceSchema } from "@/adapters/schemas";
import type { TurnAnswer, TurnEvent } from "@/adapters/chat-contract";

afterEach(cleanup);

// FOR LEGAL REVIEW: the label wording is not final; it must equal the backend's INSURER_UNCHECKED_LABEL.
const LABEL = "From the insurer's wording, not checked";
const LONG = "Medical expenses incurred before admission are covered. ".repeat(8);

const insurerFact = (over: Partial<FactView> = {}): FactView => factsIn.parse({
  holdingId: "h1", status: "ready", unknownKeys: [],
  facts: [{ factKey: "pre_hospitalisation_days", status: "extracted_unverified", value: 60, unit: "days", valueType: "number", group: "cover", sourceTier: "ida_wording", checkWithInsurer: true,
    sources: [{ id: "s1", tier: "ida_wording", status: "extracted_unverified", value: 60, page: null, quote: LONG, reference: { source: "fss", pageNumber: 9, verificationStatus: "unverified" } }], ...over }],
}).facts[0] as FactView;

describe("insurer tier labels", () => {
  it("uses the exact label and clips quotes to 160 characters", () => {
    expect(INSURER_UNCHECKED_LABEL).toBe(LABEL);
    expect(isInsurerUnchecked("ida_wording", "extracted_unverified")).toBe(true);
    expect(isInsurerUnchecked("ida_wording", "reviewed_reference")).toBe(false);
    expect(isInsurerUnchecked("own_pdf", "extracted_unverified")).toBe(false);
    expect(clipQuote(LONG)?.length).toBeLessThanOrEqual(160);
    expect(clipQuote("   ")).toBeNull();
  });
  it("shows an insurer fact with the label, the insurer page and a quote of at most 160 characters, never as read from your document", () => {
    const line = factLine(insurerFact());
    expect(line.sourceText).toBe(LABEL);
    expect(line.statusText).toBe(LABEL);
    expect(line.citation).toBe("Page 9");
    expect(line.quote?.length).toBeLessThanOrEqual(160);
    expect(JSON.stringify(line)).not.toMatch(/Read from your document|Your schedule/);
  });
  it("keeps own-document and reviewed facts as before", () => {
    const own = factLine(insurerFact({ sourceTier: "own_pdf", sources: [{ id: "s", tier: "own_pdf", status: "extracted_unverified", page: { pageId: "page-2", pageNumber: 2 }, quote: "Q" }] }));
    expect(own.statusText).toBe("Read from your document");
    const reviewed = factLine(insurerFact({ status: "reviewed_reference" }));
    expect(reviewed.sourceText).toBe("Insurer terms (verified)");
  });
  it("reads an unknown tier or status from a newer backend as missing, not an error", () => {
    const r = factsIn.safeParse({ holdingId: "h1", status: "ready", facts: [{ factKey: "k", status: "unknown", sources: [{ id: "s", tier: "brand_new_tier", status: "brand_new" }] }] });
    expect(r.success).toBe(true);
  });
});

describe("chat insurer sources", () => {
  const base = { turnId: "t", status: "evidence_found", intent: "x", answer: "a", answerSource: "deterministic", factsUsed: [], openConflicts: [] } as unknown as TurnAnswer;
  it("labels insurer sources and the card's ida_wording source, with no document link and no 'Your document'", () => {
    const a = { ...base, sources: [{ kind: "insurer_wording", tier: "insurer_wording", page: 9, quote: LONG, ref: "insurer:abc" }], card: { status: "evidence_found", sources: [{ tier: "ida_wording", status: "extracted_unverified", page: 9, quote: LONG }] } } as TurnAnswer;
    expect(citationLines(a)).toEqual([`${LABEL}, page 9`]);
    const quotes = insurerQuotes(a);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.length).toBeLessThanOrEqual(160);
  });
  it("does not label an own-document card source as insurer wording", () => {
    const a = { ...base, card: { status: "evidence_found", sources: [{ tier: "own_pdf", status: "extracted_unverified", page: 2, quote: "Q" }] } } as TurnAnswer;
    expect(citationLines(a)).toEqual([]);
  });
  it("the mock chat answers an insurer question with an insurer_wording source and the card tier", async () => {
    await mockChat.grantConsent("req-1");
    const t = await mockChat.startThread();
    const events: TurnEvent[] = [];
    await mockChat.turn(t.id, { message: "What is covered for pre-hospitalisation?", inputKind: "text" }, (e) => events.push(e));
    const answer = events.find((e) => e.type === "answer");
    const data = answer && answer.type === "answer" ? answer.data : null;
    expect(data?.sources?.[0]).toMatchObject({ kind: "insurer_wording", tier: "insurer_wording" });
    expect(data?.sources?.[0]?.document_id).toBeUndefined();
    expect(data?.card?.sources[0]).toMatchObject({ tier: "ida_wording", status: "extracted_unverified" });
    await mockChat.revokeConsent();
  });
  it("assistant (chat v0) sources accept tier insurer_wording and show the label apart from the household's", () => {
    expect(answerSourceSchema.safeParse({ tier: "insurer_wording", label: LABEL, page: 9, quote: "Up to 60 days." }).success).toBe(true);
    render(<SourceLine status="evidence_found" sources={[{ tier: "household_evidence", label: "Plan", page: 2, quote: "Own." }, { tier: "insurer_wording", label: LABEL, page: 9, quote: LONG }]} />);
    expect(screen.getByText(/From your document, page 2/)).toBeTruthy();
    const ins = document.querySelector("[data-source='insurer_wording']");
    expect(ins?.textContent).toContain(`${LABEL}, page 9`);
    expect(ins?.querySelector("q")?.textContent?.length).toBeLessThanOrEqual(160);
  });
});

describe("passages and policy.md", () => {
  it("renders own and insurer passages as separate labelled lists", () => {
    const result = passagesOut.parse({ passages: [{ clauseId: "c", page: 2, snippet: "Own words." }], insurerPassages: [{ chunkId: "k", page: 9, source: "insurer_wording", snippet: "Insurer words." }] });
    render(<PassageResults result={result} />);
    expect(screen.getByLabelText("From your documents").textContent).toContain("Own words.");
    const ins = screen.getByLabelText("Insurer wording");
    expect(ins.textContent).toContain(LABEL);
    expect(ins.textContent).toContain("Insurer words.");
    expect(ins.textContent).not.toContain("Own words.");
  });
  it("the mock evidence adapter returns both lists, insurer rows tagged insurer_wording", async () => {
    const r = await mockEvidence.passages("current", "before admission 60 days");
    expect(r.insurerPassages[0]).toMatchObject({ source: "insurer_wording", page: 9 });
    expect(r.insurerPassages[0]?.snippet.length).toBeLessThanOrEqual(280);
  });
  it("renders the new section, the insurer-tier line and Open questions from the markdown", async () => {
    const md = ["# Memory", "", "## Insurer terms your document doesn't state", "", "- Pre-hospital days? 60 days (insurer wording, not checked) [insurer_wording, p.9]", "", "## Open questions", "", "- Co-payment? [unknown]", ""].join("\n");
    expect(parseMemoryMarkdown(md).filter((b) => b.kind === "heading").map((b) => b.kind === "heading" && b.text)).toEqual(["Insurer terms your document doesn't state", "Open questions"]);
    render(<MemoryDocumentBody markdown={md} />);
    expect(screen.getByText("Insurer terms your document doesn't state")).toBeTruthy();
    expect(screen.getByText(/\(insurer wording, not checked\) \[insurer_wording, p\.9\]/)).toBeTruthy();
    expect(screen.getByText("Open questions")).toBeTruthy();
  });
  it("shows markdown as text: markup and html in it are not run", () => {
    const { container } = render(<MemoryDocumentBody markdown={"## A\n\n- <img src=x onerror=alert(1)> [x](javascript:alert(1))\n"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
  it("the mock covers adapter gives policy.md with the insurer block for a plan with insurer wording, and any insurer looks the same", async () => {
    const id = (await mockCovers.upload(new File([new Uint8Array(64)], "p.pdf", { type: "application/pdf" }), "k-md-insurer-1", { kind: "policy_schedule", policyType: "personal_health" })).holdingId as string;
    await mockCovers.candidates(id);
    await mockCovers.confirmProduct(id, { candidateId: "product-example-01", expectedVersion: 0 }, "k-confirm-md-1");
    const md = await mockCovers.memoryDocument(id);
    expect(md).toContain("## Insurer terms your document doesn't state");
    expect(md).toMatch(/\(insurer wording, not checked\).*\[insurer_wording, p\.9\]/);
    expect(md).toContain("## Open questions");
    expect(md).not.toMatch(/HDFC|Star Health|ICICI|Niva/i);
    const facts = await mockCovers.facts(id);
    const f = facts.facts.find((x) => x.factKey === "pre_hospitalisation_days");
    expect(f).toMatchObject({ status: "extracted_unverified", sourceTier: "ida_wording" });
  });
});
