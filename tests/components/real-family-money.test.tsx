// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import { backendUploads } from "@/adapters/uploads";
import { realDocuments } from "@/adapters/real-documents";
import { adapters } from "@/adapters";

vi.mock("@/components/shell", () => ({ FamilyOwner: () => <div data-testid="owner-card" /> }));
import { RealFamily } from "@/components/family/RealFamily";
import { RealMoney } from "@/components/money/RealMoney";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("real family, money, documents", () => {
  it("family shows stored members, no invites", async () => {
    vi.spyOn(adapters.members, "list").mockResolvedValue([
      { id: "o", name: "Owner One", relation: null, ageYears: null, isOwner: true, isYou: true },
      { id: "m1", name: "Asha Test", relation: "Spouse", ageYears: 34, isOwner: false, isYou: false },
    ]);
    render(<RealFamily />);
    expect(await screen.findByText("Asha Test")).toBeInTheDocument();
    expect(screen.queryByText("Family on Knowvia")).toBeNull();
  });
  it("money shows real dues and premiums, no mock receipts", async () => {
    vi.spyOn(backendCovers, "premiums").mockResolvedValue([{ id: "p1", holdingId: "h1", amountPaise: 1250000, paidOn: `${new Date().getFullYear()}-02-10`, channel: "x", paidVia: "upi" }]);
    vi.spyOn(backendCovers, "premiumDues").mockResolvedValue([{ id: "d1", holdingId: "h1", dueOn: "2027-02-10", amountPaise: 1250000, state: "expected" }]);
    vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: [], creationIssues: [] });
    render(<RealMoney />);
    expect(await screen.findByText("Premiums due")).toBeInTheDocument();
    expect(screen.getAllByText("Rs 12,500").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Gmail/)).toBeNull();
  });
  it("documents list maps stored documents", async () => {
    vi.spyOn(backendUploads, "list").mockResolvedValue({ consent: true, largeUpload: false, policyType: null, documents: [
      { id: "d1", kind: "policy_schedule", sizeBytes: 1, uploadedAt: "2026-11-01T00:00:00Z", steps: { uploaded: "done", scanned: "done", reading: "done", structured: "done" }, note: null, busy: false },
    ] });
    expect(await realDocuments.list()).toEqual([{ id: "d1", name: "Policy schedule · 2026-11-01", status: "read" }]);
  });
});
