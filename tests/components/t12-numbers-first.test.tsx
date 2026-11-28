// @vitest-environment jsdom
// T12 numbers-first: the removed filler stays removed. Covers FactItem (citation only, status hidden for unverified readings).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { FactLine } from "@/adapters/real-policy";
import { FactItem } from "@/components/cover-real/parts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const factLine = (over: Partial<FactLine> = {}): FactLine => ({
  key: "room_rent_limit", label: "Room rent", value: "Rs 5,000", status: "user_confirmed", statusText: "STATUS_TEXT", sourceText: "Your schedule",
  open: false, citation: "Your document, Page 3", quote: "QUOTE_SENTINEL_XYZ", group: "limits", conflictId: null, ...over,
});
const statusEls = (c: HTMLElement) => [...c.querySelectorAll("*")].filter((e) => /status/i.test(e.className.toString()));

describe("FactItem", () => {
  it("FactItem shows citation, not quote", () => {
    const { container } = render(<ul><FactItem f={factLine()} /></ul>);
    expect(screen.getByText("Your document, Page 3")).toBeInTheDocument();
    expect(screen.queryByText("QUOTE_SENTINEL_XYZ")).toBeNull();
    expect(container.textContent).not.toContain("QUOTE_SENTINEL_XYZ");
  });
  it("FactItem status text", () => {
    const unverified = render(<ul><FactItem f={factLine({ status: "extracted_unverified", statusText: "Read from your document", sourceText: "Your schedule" })} /></ul>);
    expect(statusEls(unverified.container)).toHaveLength(0);
    expect(unverified.container.textContent).not.toContain("Read from your document");
    unverified.unmount();
    // A reading taken from the insurer's wording and not checked keeps its line: it is a trust signal, not filler.
    const insurer = render(<ul><FactItem f={factLine({ status: "extracted_unverified", statusText: "From the insurer's wording, not checked", sourceText: "From the insurer's wording, not checked" })} /></ul>);
    expect(insurer.container.textContent).toContain("From the insurer's wording, not checked");
    insurer.unmount();
    for (const status of ["conflicting", "unknown", "user_confirmed", "reviewed_reference"] as const) {
      const r = render(<ul><FactItem f={factLine({ status, statusText: `Text for ${status}` })} /></ul>);
      const els = statusEls(r.container);
      expect(els.length).toBeGreaterThan(0);
      expect(els[0].textContent).toBe(`Text for ${status}`);
      r.unmount();
    }
  });
});
