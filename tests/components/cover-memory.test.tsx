// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdapterError } from "@/adapters/types";

// CoverMemory against the household cover memory as the backend renders it: 14 sections in a fixed order, and calm states when the
// backend answers 404 or 503. Synthetic text only.

const coverMemory = vi.fn();
vi.mock("@/adapters", () => ({ adapters: { covers: { coverMemory: () => coverMemory() } } }));

import { CoverMemory } from "@/components/cover-real/CoverMemory";
import { mockCovers } from "@/adapters/mock/covers";

const SECTIONS = ["At a glance", "Policies", "People covered", "Premiums and renewals", "Cover and limits", "Waiting periods", "Exclusions, terms and key clauses", "OPD, vaccination and wellness", "Claims, TPA and network hospitals", "Contacts and helplines", "Declarations and consistency", "Differences between policies", "Open questions and conflicts", "Where this comes from"];
const SAMPLE = ["# Household Cover Memory", ...SECTIONS.flatMap((name) => ["", `## ${name}`, "", "- [Policy A] Example entry [owner statement]"]), ""].join("\n");

beforeEach(() => coverMemory.mockReset());
afterEach(cleanup);

describe("CoverMemory", () => {
  it("shows loading, then all 14 sections as headings in order, without the title twice or any sample chrome", async () => {
    coverMemory.mockResolvedValue(SAMPLE);
    render(<CoverMemory />);
    expect(screen.getByRole("status").textContent).toMatch(/Loading/);
    await waitFor(() => expect(screen.getByTestId("memory-document")).toBeTruthy());
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(SECTIONS);
    expect(document.body.textContent).not.toMatch(/sample|disclaimer|draft/i);
  });
  it("the mock adapter returns 14 sections in order and only synthetic helpline numbers", async () => {
    const md = await mockCovers.coverMemory();
    expect([...md.matchAll(/^## (.+)$/gm)].map((m) => m[1])).toEqual(SECTIONS);
    expect(md.startsWith("# Household Cover Memory")).toBe(true);
    expect(md).not.toMatch(/\bUIN\b/);
  });
  it.each(["MEMORY_DISABLED", "HOLDINGS_DISABLED"])("shows a calm not-switched-on state for %s", async (code) => {
    coverMemory.mockRejectedValueOnce(new AdapterError(code));
    render(<CoverMemory />);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Your cover memory is not switched on yet."));
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it.each(["NOT_FOUND", "HOUSEHOLD_NOT_FOUND"])("shows a calm not-ready state for %s, with no stack or raw text", async (code) => {
    coverMemory.mockRejectedValueOnce(new AdapterError(code));
    render(<CoverMemory />);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Your cover memory is not ready yet."));
    expect(document.body.textContent).not.toMatch(new RegExp(`${code}|Error|\\bat \\w+ \\(`));
  });
  it("shows a retryable alert for any other failure, and retries", async () => {
    coverMemory.mockRejectedValueOnce(new Error("raw backend words with a stack")).mockResolvedValueOnce(SAMPLE);
    render(<CoverMemory />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/raw backend words|stack/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByTestId("memory-document")).toBeTruthy());
  });
});
