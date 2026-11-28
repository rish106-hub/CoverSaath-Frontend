// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/covers/add" }));
vi.mock("@/adapters", async () => {
  const { mockCovers } = await import("@/adapters/mock/covers");
  return { adapters: { covers: mockCovers, reference: { products: async () => ({ products: [] }) }, members: { list: async () => [], add: async (input: { name: string; relation: string }) => ({ id: "member-1", name: input.name, relation: input.relation, ageYears: null, isOwner: false, isYou: false }) } } };
});
vi.hoisted(() => { process.env.NEXT_PUBLIC_ADAPTERS = "mock"; });

import { AddCoverView } from "@/components/covers/AddCoverView";
import { mockCovers, setMockCreationIssue } from "@/adapters/mock/covers";

const pdf = (name: string) => new File([new Uint8Array(8)], name, { type: "application/pdf" });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function pastConsent() {
  fireEvent.click(await screen.findByRole("button", { name: "Yes, read my policy" }));
  await screen.findByTestId("policy-type");
}

describe("add a cover page", () => {
  it("takes the cover type, then one schedule, and has no terms slot", async () => {
    const link = vi.spyOn(mockCovers, "linkDocument");
    const up = vi.spyOn(mockCovers, "uploadDocument");
    render(<AddCoverView />);
    await pastConsent();
    expect(screen.getByRole("heading", { name: "Drop your policy PDF here." })).toBeInTheDocument();
    expect((screen.getByTestId("policy-type") as HTMLSelectElement).value).toBe("personal_health");
    expect(screen.getByRole("button", { name: "Choose PDF" })).toBeEnabled();
    expect(screen.queryByTestId("terms-input")).toBeNull();
    expect(screen.queryByText(/Add this after your schedule is in/)).toBeNull();
    expect(screen.queryByText(/terms and conditions/i)).toBeNull();
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf("schedule.pdf")] } });
    await screen.findByRole("heading", { name: "Which plan is this?" });
    expect(up).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledWith(expect.anything(), expect.any(String), "policy_schedule", "personal_health", expect.any(Function));
    expect(link).not.toHaveBeenCalled();
  });
  it("says it is reading the schedule while it works", async () => {
    let release: (v: { documentId: string }) => void = () => {};
    vi.spyOn(mockCovers, "uploadDocument").mockImplementation(() => new Promise((r) => { release = r; }));
    render(<AddCoverView />);
    await screen.findByTestId("policy-type");
    fireEvent.change(screen.getByTestId("policy-type"), { target: { value: "personal_health" } });
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf("schedule.pdf")] } });
    expect(await screen.findByText(/Reading the pages/)).toBeInTheDocument();
    release({ documentId: "doc-never" });
  });
  it("a failed holding shows a clear failed state with no retry of the same file", async () => {
    vi.spyOn(mockCovers, "uploadDocument").mockResolvedValue({ documentId: "doc-failed" });
    setMockCreationIssue("doc-failed", "failed");
    render(<AddCoverView />);
    await screen.findByTestId("policy-type");
    fireEvent.change(screen.getByTestId("policy-type"), { target: { value: "personal_health" } });
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf("schedule.pdf")] } });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We could not read this one.");
    expect(screen.getByRole("button", { name: "Choose another PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    setMockCreationIssue("doc-failed", null);
  });
  it("checks the insurer's terms on confirm, then offers the policy page for the holding", async () => {
    render(<AddCoverView />);
    await screen.findByTestId("policy-type");
    fireEvent.change(screen.getByTestId("policy-type"), { target: { value: "personal_health" } });
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf("schedule.pdf")] } });
    await screen.findByRole("heading", { name: "Which plan is this?" });
    fireEvent.click(screen.getByRole("radio", { name: /Example Health Plan 01/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Yes, it is/ }));
    expect(screen.getByText(/Checking your insurer.s terms/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Skip for now" }));
    const open = await screen.findByRole("link", { name: "Open my policy" });
    expect(open.getAttribute("href")).toMatch(/^\/policies\/holding-mock-/);
    expect(screen.queryByText(/Checking your insurer.s terms/)).toBeNull();
  });
});
