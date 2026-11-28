// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/covers/add" }));

const h = vi.hoisted(() => ({
  documents: [] as unknown[],
  holdings: [] as { id: string; documentId: string | null; status: string }[],
  resume: vi.fn(),
}));

vi.mock("@/adapters/uploads", async (orig) => {
  const real = await orig<typeof import("@/adapters/uploads")>();
  return { ...real, uploads: { list: async () => ({ consent: true, documents: h.documents, largeUpload: false, policyType: "personal_health" }), grantConsent: vi.fn() } };
});
vi.mock("@/adapters/payments", () => ({ payments: { slots: async () => ({ enabled: true, used: 1, allowed: 1, canAdd: false, pricePaise: 19900, currency: "INR" }) } }));
vi.mock("@/adapters", () => ({
  adapters: {
    covers: {
      holdingsView: async () => ({ holdings: h.holdings, creationIssues: [] }),
      resumeDocument: h.resume,
      holdingFor: async () => null,
      candidates: async () => ({ candidates: [], profileVersion: 0 }),
    },
    reference: { products: async () => ({ products: []  }) },
    members: { list: async () => [], add: async (input: { name: string; relation: string }) => ({ id: "member-1", name: input.name, relation: input.relation, ageYears: null, isOwner: false, isYou: false }) },
  },
}));

import { AddCoverView } from "@/components/covers/AddCoverView";

afterEach(() => { cleanup(); h.documents = []; h.holdings = []; h.resume.mockReset(); });

const doc = (extra: Record<string, unknown> = {}) => ({
  id: "d1", kind: "policy_schedule", sizeBytes: 10, uploadedAt: null, note: null, busy: true,
  steps: { uploaded: "done", scanned: "done", reading: "active", structured: "pending" }, ...extra,
});

describe("add a cover after a reload", () => {
  it("lists the document still being read ahead of the payment card, and follows it again", async () => {
    h.documents = [doc()];
    h.resume.mockResolvedValue({ documentId: "d1", busy: true });
    render(<AddCoverView />);
    await screen.findByText(/Still working on it/);
    expect(h.resume).toHaveBeenCalledWith("d1", expect.any(Function));
    expect(screen.queryByTestId("pay-card")).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Check again" })).toBeEnabled());
  });

  it("shows the payment card when nothing is in progress", async () => {
    render(<AddCoverView />);
    await screen.findByTestId("pay-card");
    expect(h.resume).not.toHaveBeenCalled();
  });

  it("does not take over the page for a document that already has its holding", async () => {
    h.documents = [doc({ steps: { uploaded: "done", scanned: "done", reading: "done", structured: "active" } })];
    h.holdings = [{ id: "h1", documentId: "d1", status: "ready" }];
    render(<AddCoverView />);
    await screen.findByTestId("pay-card");
    expect(h.resume).not.toHaveBeenCalled();
  });

  it("does not resume a quarantined or deleting document", async () => {
    h.documents = [doc({ note: "QUARANTINED" }), doc({ id: "d2", note: "DELETING" })];
    render(<AddCoverView />);
    await screen.findByTestId("pay-card");
    expect(h.resume).not.toHaveBeenCalled();
  });
});
