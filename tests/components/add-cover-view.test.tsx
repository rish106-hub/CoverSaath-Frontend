// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/covers/add" }));
vi.mock("@/adapters", async () => {
  const { mockCovers } = await import("@/adapters/mock/covers");
  return { adapters: { covers: mockCovers, reference: { products: async () => ({ products: [] }) } } };
});
vi.hoisted(() => { process.env.NEXT_PUBLIC_ADAPTERS = "mock"; });

import { AddCoverView } from "@/components/covers/AddCoverView";
import { mockCovers, setMockCreationIssue } from "@/adapters/mock/covers";
import { AdapterError } from "@/adapters/types";

const pdf = (name: string) => new File([new Uint8Array(8)], name, { type: "application/pdf" });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function pastConsent() {
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByTestId("policy-type");
}

describe("add a cover page", () => {
  it("takes the cover type, then the schedule, then links the terms to the same holding", async () => {
    const link = vi.spyOn(mockCovers, "linkDocument");
    const up = vi.spyOn(mockCovers, "uploadDocument");
    render(<AddCoverView />);
    await pastConsent();
    expect(screen.getByRole("button", { name: "Choose the type of cover first" })).toBeDisabled();
    fireEvent.change(screen.getByTestId("policy-type"), { target: { value: "personal_health" } });
    expect(screen.getByRole("button", { name: "Choose the terms and conditions PDF" })).toBeDisabled();
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf("schedule.pdf")] } });
    await screen.findByText("schedule.pdf: added.");
    await screen.findByRole("heading", { name: "Which plan is this?" });
    expect(up).toHaveBeenCalledWith(expect.anything(), expect.any(String), "policy_schedule", "personal_health");
    fireEvent.change(screen.getByTestId("terms-input"), { target: { files: [pdf("terms.pdf")] } });
    await screen.findByText("terms.pdf: added.");
    expect(up.mock.calls[1]![2]).toBe("policy_wording");
    const holdingId = link.mock.calls[0]![0];
    expect(holdingId).toMatch(/^holding-mock-/);
    expect((await mockCovers.holdingDocuments(holdingId)).documents).toHaveLength(2);
  });
  it("shows a failed terms slot with a retry that links without uploading again", async () => {
    const link = vi.spyOn(mockCovers, "linkDocument");
    link.mockRejectedValueOnce(new AdapterError("BACKEND_UNREACHABLE", true));
    const up = vi.spyOn(mockCovers, "uploadDocument");
    render(<AddCoverView />);
    await screen.findByTestId("policy-type");
    fireEvent.change(screen.getByTestId("policy-type"), { target: { value: "personal_health" } });
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf("schedule.pdf")] } });
    await screen.findByText("schedule.pdf: added.");
    fireEvent.change(screen.getByTestId("terms-input"), { target: { files: [pdf("terms.pdf")] } });
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toMatch(/terms\.pdf/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("terms.pdf: added.")).toBeInTheDocument());
    expect(up.mock.calls.filter((c) => c[2] === "policy_wording")).toHaveLength(1);
    expect(link).toHaveBeenCalledTimes(2);
  });
  it("a failed holding shows a clear failed state with no retry of the same file", async () => {
    vi.spyOn(mockCovers, "uploadDocument").mockResolvedValue({ documentId: "doc-failed" });
    setMockCreationIssue("doc-failed", "failed");
    render(<AddCoverView />);
    await screen.findByTestId("policy-type");
    fireEvent.change(screen.getByTestId("policy-type"), { target: { value: "personal_health" } });
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf("schedule.pdf")] } });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/schedule\.pdf: We could not read this document\. Add it again/);
    expect(screen.getByRole("button", { name: "Choose another PDF" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    setMockCreationIssue("doc-failed", null);
  });
  it("ends on the policy page for the holding both documents are linked to", async () => {
    const link = vi.spyOn(mockCovers, "linkDocument");
    render(<AddCoverView />);
    await screen.findByTestId("policy-type");
    fireEvent.change(screen.getByTestId("policy-type"), { target: { value: "personal_health" } });
    fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf("schedule.pdf")] } });
    await screen.findByRole("heading", { name: "Which plan is this?" });
    fireEvent.change(screen.getByTestId("terms-input"), { target: { files: [pdf("terms.pdf")] } });
    await screen.findByText("terms.pdf: added.");
    fireEvent.click(screen.getByRole("radio", { name: /Example Health Plan 01/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Yes, it is/ }));
    const open = await screen.findByRole("link", { name: "Open my policy" });
    expect(open).toHaveAttribute("href", `/policies/${link.mock.calls[0]![0]}`);
  });
});
