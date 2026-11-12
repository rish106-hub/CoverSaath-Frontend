// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import { AdapterError } from "@/adapters/types";
import { realAdapters } from "@/adapters/real";
import { containsUin, type ConflictView, type CreationIssue, type FactView, type HoldingView } from "@/adapters/covers-contract";
import { factLine, keyFacts, loadPolicies, realPolicy, stageOf, stateOf, toPolicyView } from "@/adapters/real-policy";
import { RealHome } from "@/components/cover-real/RealHome";
import { RealPolicies } from "@/components/cover-real/RealPolicies";
import { RealPolicyDetail } from "@/components/cover-real/RealPolicyDetail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const holding = (status: HoldingView["status"] = "ready", id = "h1"): HoldingView => ({ id, documentId: "d1", kind: "policy_wording", status });
const fact = (o: Partial<FactView> & { factKey: string }): FactView => ({ status: "extracted_unverified", alternatives: [], checkWithInsurer: false, sources: [], ...o });
const own = (pageId = "page-2", quote = "Room rent up to 5000") => ({ id: "s1", tier: "own_pdf" as const, page: { pageId }, quote });
const FACTS: FactView[] = [
  fact({ factKey: "room_rent_limit", group: "limits", unit: "paise", valueType: "number", value: 500000, sourceTier: "own_pdf", sources: [own()] }),
  fact({ factKey: "initial_waiting", group: "waiting", unit: "days", value: 30, status: "user_confirmed", sourceTier: "own_pdf", sources: [{ id: "s2", tier: "own_pdf" }] }),
  fact({ factKey: "co_pay", group: "limits", status: "conflicting", openConflictId: "c1" }),
  fact({ factKey: "bonus", group: "money", status: "unknown" }),
];
const CONFLICT: ConflictView = { id: "c1", factKey: "co_pay", reason: "tier_mismatch", resolution: "pending", checkWithInsurer: false, candidates: [] };

describe("toPolicyView", () => {
  it("maps a holding with facts: value, honest status, citation", () => {
    const v = toPolicyView(holding(), { facts: FACTS, unknownKeys: ["x"], conflicts: [CONFLICT] });
    const room = v.facts.find((f) => f.key === "room_rent_limit");
    expect(room).toMatchObject({ value: "Rs 5,000", status: "extracted_unverified", statusText: "Read from your document", citation: "Your document, Page 2" });
    expect(room?.statusText).not.toMatch(/verified|confirmed/i);
    expect(v.notFound).toBe(1);
    expect(v.pending).toEqual([{ id: "c1", label: "Co pay" }]);
    expect(containsUin(v)).toBe(false);
  });
  it("maps a holding with no facts to an empty list, not an error", () => {
    const v = toPolicyView(holding("uploaded"), null);
    expect(v).toMatchObject({ facts: [], pending: [], stage: "reading", error: null, title: "Health policy", insurer: null });
  });
  it("shows a conflicting fact as two readings and an unknown one as not found", () => {
    const v = toPolicyView(holding("conflicts"), { facts: FACTS, unknownKeys: [], conflicts: [CONFLICT] });
    expect(v.facts.find((f) => f.key === "co_pay")).toMatchObject({ value: "Two readings", open: true, conflictId: "c1" });
    expect(v.facts.find((f) => f.key === "bonus")).toMatchObject({ value: "Not found", open: true });
  });
  it("leaves the citation null when the backend returned none", () => {
    const v = toPolicyView(holding(), { facts: [fact({ factKey: "co_pay", value: 10, unit: "percent" })], unknownKeys: [], conflicts: [] });
    expect(v.facts[0]).toMatchObject({ citation: null, quote: null, value: "10%" });
  });
  it("ignores guessed product and insurer facts; names come only from the summary", () => {
    const guessed = [fact({ factKey: "product_name", status: "user_confirmed", value: "Care Plan" }), fact({ factKey: "insurer_name", status: "user_confirmed", value: "Guess Ltd" })];
    const v = toPolicyView(holding(), { facts: guessed, unknownKeys: [], conflicts: [] });
    expect(v).toMatchObject({ title: "Health policy", insurer: null, productName: null });
  });
  it("takes insurer and product from the summary", () => {
    const v = toPolicyView({ ...holding(), summary: { insurerName: "Example Insurer", productName: "Example Health Plan 01" } }, { facts: [], unknownKeys: [], conflicts: [] });
    expect(v).toMatchObject({ title: "Example Health Plan 01", insurer: "Example Insurer", productName: "Example Health Plan 01" });
  });
  it("insurer and product stay null before confirmation", () => {
    const v = toPolicyView({ ...holding("insurer_pending"), summary: { insurerName: null, productName: null, sumInsured: null, policyPeriod: null, premium: null } }, null);
    expect(v).toMatchObject({ title: "Health policy", insurer: null, productName: null, stage: "choose_plan", headlines: [] });
  });
  it("tolerates a missing summary (older backend)", () => {
    const v = toPolicyView(holding(), { facts: [], unknownKeys: [], conflicts: [] });
    expect(v.headlines).toEqual([]);
    expect(v.insurer).toBeNull();
  });
  it("shows a partial summary: present headlines and not-found for the rest", () => {
    const v = toPolicyView({ ...holding(), summary: { sumInsured: { factKey: "sum_insured", value: { amountMinor: 50000000, currency: "INR" }, status: "extracted_unverified" } } }, { facts: [], unknownKeys: [], conflicts: [] });
    expect(v.headlines.map((h) => [h.key, h.tone, h.value])).toEqual([["sum_insured", "read", "Rs 5,00,000"], ["policy_period", "missing", "Not found yet"], ["premium_total", "missing", "Not found yet"]]);
  });
  it("shows each headline status honestly and formats money from minor units", () => {
    const summary = {
      sumInsured: { factKey: "sum_insured" as const, value: { amountMinor: 50000000, currency: "INR" }, status: "extracted_unverified" as const },
      policyPeriod: { factKey: "policy_period" as const, value: { startIso: "2026-04-01", endIso: "2027-03-31", days: 365 }, status: "user_confirmed" as const },
      premium: { factKey: "premium_total" as const, value: null, status: "conflicting" as const },
    };
    const [si, pp, pr] = toPolicyView({ ...holding(), summary }, { facts: [], unknownKeys: [], conflicts: [] }).headlines;
    expect(si).toMatchObject({ value: "Rs 5,00,000", tone: "read", statusText: "Read from your document" });
    expect(pp).toMatchObject({ value: "1 Apr 2026 to 31 Mar 2027", tone: "confirmed" });
    expect(pr).toMatchObject({ value: "Two readings", tone: "review", status: "conflicting" });
    const rr = toPolicyView({ ...holding(), summary: { premium: { factKey: "premium_total", value: { amountMinor: 1850000, currency: "INR" }, status: "reviewed_reference" } } }, null).headlines[2];
    expect(rr).toMatchObject({ value: "Rs 18,500", tone: "confirmed" });
    const un = toPolicyView({ ...holding(), summary: { premium: { factKey: "premium_total", value: null, status: "unknown" } } }, null).headlines[2];
    expect(un).toMatchObject({ value: "Not found yet", tone: "missing", status: "unknown" });
    expect(containsUin(si)).toBe(false);
  });
  it("labels a citation with its document kind and page", () => {
    const src = (documentKind: string | null) => ({ id: "s", tier: "own_pdf" as const, page: { pageId: "page-4", documentKind }, quote: "q" });
    expect(factLine(fact({ factKey: "a", sourceTier: "own_pdf", sources: [src("policy_schedule")] })).citation).toBe("Your document, Policy schedule, Page 4");
    expect(factLine(fact({ factKey: "a", sourceTier: "own_pdf", sources: [src("policy_wording")] })).citation).toBe("Your document, Policy terms and conditions, Page 4");
    expect(factLine(fact({ factKey: "a", sourceTier: "own_pdf", sources: [src(null)] })).citation).toBe("Your document, Page 4");
  });
  it("fills the Policy typed fields only from confirmed headlines", async () => {
    const summary = {
      insurerName: "Example Insurer", productName: "Example Health Plan 01",
      sumInsured: { factKey: "sum_insured" as const, value: { amountMinor: 50000000, currency: "INR" }, status: "user_confirmed" as const },
      policyPeriod: { factKey: "policy_period" as const, value: { startIso: "2026-04-01", endIso: "2027-03-31", days: 365 }, status: "reviewed_reference" as const },
      premium: { factKey: "premium_total" as const, value: { amountMinor: 1850000, currency: "INR" }, status: "extracted_unverified" as const },
    };
    vi.spyOn(backendCovers, "holdings").mockResolvedValue([{ ...holding(), summary }]);
    vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "h1", status: "ready", facts: [], unknownKeys: [] });
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
    const p = await realPolicy.get("h1");
    expect(p).toMatchObject({ name: "Example Health Plan 01", insurer: "Example Insurer", sumInsuredRs: 500000, premiumRs: 0, renewsOn: "2027-03-31" });
  });
  it("orders key facts with limits first and skips unknown ones", () => {
    const v = toPolicyView(holding(), { facts: FACTS, unknownKeys: [], conflicts: [] });
    expect(keyFacts(v).map((f) => f.key)).toEqual(["room_rent_limit", "co_pay", "initial_waiting"]);
  });
});

describe("state selection", () => {
  it("picks loading, error, empty and ready", () => {
    expect(stateOf(null, null)).toEqual({ kind: "loading" });
    expect(stateOf(null, "HOLDINGS_DISABLED")).toEqual({ kind: "error", code: "HOLDINGS_DISABLED" });
    expect(stateOf([], null)).toEqual({ kind: "empty" });
    expect(stateOf([toPolicyView(holding(), null)], null).kind).toBe("ready");
  });
  it("maps holding status to a stage", () => {
    expect(["uploaded", "product_reported", "insurer_pending", "parsed", "conflicts", "ready"].map((s) => stageOf(s as HoldingView["status"]))).toEqual(["reading", "reading", "choose_plan", "ready", "needs_review", "ready"]);
  });
});

describe("loading from the backend routes", () => {
  it("does not ask for facts of a holding still being read", async () => {
    vi.spyOn(backendCovers, "holdings").mockResolvedValue([holding("uploaded")]);
    const facts = vi.spyOn(backendCovers, "facts");
    const [p] = await loadPolicies();
    expect(p?.stage).toBe("reading");
    expect(facts).not.toHaveBeenCalled();
  });
  it("keeps the holding and sets a code when its facts fail", async () => {
    vi.spyOn(backendCovers, "holdings").mockResolvedValue([holding()]);
    vi.spyOn(backendCovers, "facts").mockRejectedValue(new AdapterError("BACKEND_TIMEOUT", true));
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
    expect((await loadPolicies())[0]?.error).toBe("BACKEND_TIMEOUT");
  });
  it("real adapters serve the same holdings and findings", async () => {
    vi.spyOn(backendCovers, "holdings").mockResolvedValue([holding()]);
    vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "h1", status: "ready", facts: FACTS, unknownKeys: [] });
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [CONFLICT] });
    expect((await realAdapters.policy.list()).map((p) => p.id)).toEqual(["h1"]);
    expect(await realAdapters.policy.get("nope")).toBeNull();
    const f = await realAdapters.reading.findings("h1");
    expect(f.find((x) => x.label === "Co pay")?.disagrees).toBe(true);
    vi.spyOn(backendCovers, "facts").mockRejectedValue(new AdapterError("BACKEND_UNREACHABLE"));
    expect(await realAdapters.reading.findings("h1")).toEqual([]);
  });
});

function stub(list: HoldingView[] | AdapterError, creationIssues: CreationIssue[] = []) {
  if (list instanceof AdapterError) vi.spyOn(backendCovers, "holdingsView").mockRejectedValue(list);
  else vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings: list, creationIssues });
  vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "h1", status: "conflicts", facts: FACTS, unknownKeys: ["a", "b"] });
  vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "conflicts", conflicts: [CONFLICT] });
}

const SUMMARY: HoldingView["summary"] = {
  insurerName: "Example Insurer", productName: "Example Health Plan 01",
  sumInsured: { factKey: "sum_insured", value: { amountMinor: 50000000, currency: "INR" }, status: "extracted_unverified" },
  policyPeriod: { factKey: "policy_period", value: null, status: "conflicting" },
  premium: { factKey: "premium_total", value: null, status: "unknown" },
};

describe("screens", () => {
  it("home and detail show insurer, product and honest headlines", async () => {
    stub([{ ...holding("ready"), summary: SUMMARY }]);
    const home = render(<RealHome />);
    expect(await screen.findByText("Example Health Plan 01")).toBeInTheDocument();
    expect(screen.getByText(/Example Insurer/)).toBeInTheDocument();
    expect(screen.getByTestId("headline-sum_insured")).toHaveTextContent("Rs 5,00,000");
    expect(screen.getByTestId("headline-sum_insured")).toHaveTextContent("Read from your document");
    expect(screen.getByTestId("headline-policy_period")).toHaveTextContent("Two readings");
    expect(screen.getByTestId("headline-premium_total")).toHaveTextContent("Not found yet");
    home.unmount();
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByTestId("headline-sum_insured")).toHaveTextContent("Rs 5,00,000");
    expect(screen.getAllByRole("link", { name: "Review and decide" }).some((a) => a.getAttribute("href") === "/covers/review?holding=h1")).toBe(true);
  });
  it("before confirmation the choose-plan note shows and no headlines", async () => {
    stub([{ ...holding("insurer_pending"), summary: { insurerName: null, productName: null, sumInsured: null, policyPeriod: null, premium: null } }]);
    render(<RealPolicies />);
    expect(await screen.findByTestId("stage-note")).toHaveTextContent(/Tell us which plan this is/);
    expect(screen.queryByTestId("headlines")).toBeNull();
  });
  it("home shows facts, status, citation and a link to the review screen", async () => {
    stub([holding("conflicts")]);
    render(<RealHome />);
    expect(await screen.findByText("Room rent limit")).toBeInTheDocument();
    expect(screen.getByText(/Page 2/)).toBeInTheDocument();
    expect(screen.getAllByText("Read from your document").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Review and decide" })).toHaveAttribute("href", "/covers/review?holding=h1");
  });
  it("home shows a document that is still retrying as still being read, next to the ready policy", async () => {
    stub([holding("ready")], [{ documentId: "d2", state: "retrying", code: null }]);
    render(<RealHome />);
    expect(await screen.findByTestId("creation-retrying")).toHaveTextContent(/still being read/i);
    expect(screen.queryByTestId("creation-failed")).toBeNull();
    expect(await screen.findByText("Room rent limit")).toBeInTheDocument();
  });
  it("home shows a failed document with an add-again action, and no empty state", async () => {
    stub([], [{ documentId: "d2", state: "failed", code: "HOLDING_CREATE_FAILED" }]);
    render(<RealHome />);
    expect(await screen.findByTestId("creation-failed")).toHaveTextContent(/could not read a document/i);
    expect(screen.getByRole("link", { name: "Add the document again" })).toHaveAttribute("href", "/covers/add");
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });
  it("policies list shows a failed document too", async () => {
    stub([holding("ready")], [{ documentId: "d2", state: "failed", code: "HOLDING_CREATE_FAILED" }]);
    render(<RealPolicies />);
    expect(await screen.findByTestId("creation-failed")).toBeInTheDocument();
  });
  it("policy page offers chat about this policy", async () => {
    stub([holding("ready", "h1")]);
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByRole("link", { name: "Ask about this policy" })).toHaveAttribute("href", "/chat?holding=h1");
  });
  it("home with no holdings shows the empty state with a link to /covers/add", async () => {
    stub([]);
    render(<RealHome />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a cover" })).toHaveAttribute("href", "/covers/add");
  });
  it("policies list shows the coded error in plain words, never raw text", async () => {
    stub(new AdapterError("HOLDINGS_DISABLED"));
    const { container } = render(<RealPolicies />);
    expect(await screen.findByTestId("real-error")).toHaveTextContent("Cover details are not switched on yet.");
    expect(container.textContent).not.toMatch(/HOLDINGS_DISABLED/);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
  it("policy list offers retry on a backend error and says what to do for a document still being read", async () => {
    stub(new AdapterError("BACKEND_UNREACHABLE", true));
    render(<RealPolicies />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    cleanup();
    stub([holding("uploaded")]);
    render(<RealPolicies />);
    expect(await screen.findByText(/Still being read/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add the document again" })).toHaveAttribute("href", "/covers/add");
  });
  it("detail shows grouped facts, not-found count and unknown id as not found", async () => {
    stub([holding("conflicts")]);
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByRole("heading", { name: "Waiting" })).toBeInTheDocument();
    expect(screen.getByText("You confirmed this")).toBeInTheDocument();
    expect(screen.getByText("2 details were not found in your document.")).toBeInTheDocument();
    cleanup();
    stub([holding("ready", "other")]);
    render(<RealPolicyDetail id="h1" />);
    expect(await screen.findByText("Policy not found")).toBeInTheDocument();
  });
});
