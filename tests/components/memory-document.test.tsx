// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdapterError } from "@/adapters/types";

// MemoryDocument against policy.md as the backend renders it (services/memory-document.js, ADR 0039): ten sections in a fixed order,
// a tier label per fact line, a quote and a citation (document, page, clause), and loading / empty / error states. Synthetic text only.

const memoryDocument = vi.fn();
vi.mock("@/adapters", () => ({ adapters: { covers: { memoryDocument: (id: string) => memoryDocument(id) } } }));

import { MemoryDocument, MemoryDocumentBody, parseMemoryLine } from "@/components/cover-real/MemoryDocument";
import { mockCovers } from "@/adapters/mock/covers";

const BACKEND_ORDER = ["Policy", "People covered", "Cover and limits", "Waiting periods", "Exclusions", "Insurer terms your document doesn't state", "Declared conditions", "Premiums and dues", "Conflicts to resolve", "Open questions"];
const LONG = "Medical expenses incurred before admission ".repeat(1) + "x".repeat(300);
const FULL = [
  "# Memory", "", "> Built from your own documents and answers, shown only to you.", "", "Generated 2026-11-25. Policy number shown by its last 4 characters only.",
  ...BACKEND_ORDER.flatMap((name) => ["", `## ${name}`, ""].concat(
    name === "Cover and limits" ? [`- Sum insured INR 5,00,000 (read from your document, not verified) Quote: "Sum insured Rs 5,00,000" [policy_schedule, p.1]`]
      : name === "Insurer terms your document doesn't state" ? [`- Pre-hospital days 60 days (From the insurer's wording, not checked) Check with the insurer. Quote: "${LONG}" [insurer_wording, p.9, clause 4.2]`]
        : name === "Declared conditions" ? ["- Example Member: Mild asthma (condition) [owner statement]"]
          : name === "Policy" ? ["- Product: Example Health Plan [owner statement]"]
            : ["- None recorded. [unknown]"])),
  "",
].join("\n");

beforeEach(() => memoryDocument.mockReset());
afterEach(cleanup);

describe("MemoryDocument view of policy.md", () => {
  it("shows every section in the backend's order", () => {
    render(<MemoryDocumentBody markdown={FULL} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(BACKEND_ORDER);
  });
  it("labels each line by tier, shows the quote and a citation with page and clause", () => {
    render(<MemoryDocumentBody markdown={FULL} />);
    expect(screen.getAllByTestId("memory-tier").map((n) => n.textContent)).toEqual(["You stated this", "Your document, not verified", "Insurer's wording, not checked", "You stated this"]);
    expect(screen.getByText("Policy schedule, page 1")).toBeTruthy();
    expect(screen.getByText("Insurer's wording, page 9, clause 4.2")).toBeTruthy();
    expect(screen.getAllByTestId("memory-quote")[0]?.textContent).toContain("Sum insured Rs 5,00,000");
    expect(screen.getByText("Check with the insurer.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\[[a-z_ ]+(,[^\]]*)?\]/);
  });
  it("empty sections read as nothing recorded, without a citation", () => {
    render(<MemoryDocumentBody markdown={FULL} />);
    expect(screen.getAllByTestId("memory-line-none").length).toBe(6);
  });
  it("splits a backend line into statement, tier, quote and citation", () => {
    expect(parseMemoryLine(`Room rent Not settled: two readings disagree, see Conflicts to resolve. [unknown]`)).toMatchObject({ tier: "none", quote: null, citation: { kind: "unknown" } });
    expect(parseMemoryLine(`Cover 5 (insurer wording) Quote: "A \\"b\\"" [insurer_wording, p.2]`)).toMatchObject({ tier: "insurer", citation: { kind: "source", page: "2" } });
  });
  it("wraps long quotes: every text node can break and nothing has a fixed width (no sideways scroll at 375px)", () => {
    render(<MemoryDocumentBody markdown={FULL} />);
    const quote = screen.getAllByTestId("memory-quote").find((n) => n.textContent?.includes("xxxx")) as HTMLElement;
    expect(quote.style.overflowWrap).toBe("anywhere");
    expect(quote.style.minWidth).toBe("0px");
    for (const el of document.querySelectorAll<HTMLElement>("[data-testid='memory-document'] *")) {
      expect(el.style.width).toBe("");
      expect(el.style.whiteSpace).not.toBe("nowrap");
    }
  });
  it("shows loading, then the document", async () => {
    memoryDocument.mockResolvedValue(FULL);
    render(<MemoryDocument holdingId="h1" />);
    expect(screen.getByRole("status").textContent).toMatch(/Loading/);
    await waitFor(() => expect(screen.getByTestId("memory-document")).toBeTruthy());
    expect(memoryDocument).toHaveBeenCalledWith("h1");
  });
  it("shows an empty state when nothing is recorded", async () => {
    memoryDocument.mockResolvedValue(BACKEND_ORDER.map((n) => `## ${n}\n\n- None recorded. [unknown]\n`).join("\n"));
    render(<MemoryDocument holdingId="h1" />);
    await waitFor(() => expect(screen.getByText(/Nothing has been recorded/)).toBeTruthy());
  });
  it("shows a retryable error, and retries", async () => {
    memoryDocument.mockRejectedValueOnce(new AdapterError("BACKEND_UNREACHABLE", true)).mockResolvedValueOnce(FULL);
    render(<MemoryDocument holdingId="h1" />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/could not load/));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByTestId("memory-document")).toBeTruthy());
  });
  it("explains a withdrawn go-ahead, and hides the section when the backend has memory off", async () => {
    memoryDocument.mockRejectedValueOnce(new AdapterError("CONSENT_REQUIRED"));
    const { unmount } = render(<MemoryDocument holdingId="h1" />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/go-ahead/));
    unmount();
    memoryDocument.mockRejectedValueOnce(new AdapterError("MEMORY_DISABLED"));
    const { container } = render(<MemoryDocument holdingId="h2" />);
    await waitFor(() => expect(container.textContent).toBe(""));
  });
  it("the mock adapter returns policy.md shaped like the backend: all sections in order, tier labels, quote, page and clause", async () => {
    const id = (await mockCovers.upload(new File([new Uint8Array(64)], "p.pdf", { type: "application/pdf" }), "k-md-82", { kind: "policy_schedule", policyType: "personal_health" })).holdingId as string;
    await mockCovers.candidates(id);
    await mockCovers.confirmProduct(id, { candidateId: "product-example-01", expectedVersion: 0 }, "k-md-82-confirm");
    const md = await mockCovers.memoryDocument(id);
    const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual(BACKEND_ORDER);
    expect(md).toMatch(/\(From the insurer's wording, not checked\).*Quote: ".+" \[insurer_wording, p\.9, clause 4\.2\]/);
    expect(md).toMatch(/\(read from your document, not verified\)/);
    render(<MemoryDocumentBody markdown={md} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(BACKEND_ORDER);
    expect(document.body.textContent).not.toMatch(/\bUIN\b/);
  });
});
