// @vitest-environment jsdom
// R5d Compare, stress test and hospitals for a real account. Stubbed backend reads, synthetic data only.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import { factsIn, type HoldingView } from "@/adapters/covers-contract";
import { RealCompare } from "@/components/cover-real/RealCompare";
import { RealStress } from "@/components/cover-real/RealStress";

const adapterCalls = vi.hoisted(() => ({ holdings: vi.fn(), hospitals: vi.fn() }));
vi.mock("@/adapters", () => ({ adapters: { covers: { holdings: adapterCalls.holdings, hospitals: adapterCalls.hospitals } } }));
import { HospitalsView } from "@/components/chat/HospitalsView";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  adapterCalls.holdings.mockReset();
  adapterCalls.hospitals.mockReset();
});

const summary = (product: string, sumInsuredRupees: number | null, premiumRupees: number | null = null): HoldingView["summary"] => ({
  insurerName: "Example Insurer", productName: product, wordingState: "fss", wordingReason: null,
  sumInsured: sumInsuredRupees === null ? { factKey: "sum_insured", value: null, status: "unknown" } : { factKey: "sum_insured", value: { amountMinor: sumInsuredRupees * 100, currency: "INR" }, status: "extracted_unverified" },
  policyPeriod: { factKey: "policy_period", value: null, status: "unknown" },
  premium: premiumRupees === null ? { factKey: "premium_total", value: null, status: "unknown" } : { factKey: "premium_total", value: { amountMinor: premiumRupees * 100, currency: "INR" }, status: "extracted_unverified" },
}) as HoldingView["summary"];
const holding = (id: string, product: string, sumInsuredRupees: number | null = 500000, status: HoldingView["status"] = "ready", premiumRupees: number | null = 20000): HoldingView =>
  ({ id, documentId: `d-${id}`, kind: "policy_schedule", status, summary: summary(product, sumInsuredRupees, premiumRupees) });
const textFact = (factKey: string, text: string, group = "limits") => ({
  factKey, status: "extracted_unverified", value: { text }, unit: null, valueType: "text", group, sourceTier: "own_pdf",
  sources: [{ id: `s-${factKey}`, tier: "own_pdf", status: "extracted_unverified", page: { pageId: "p4", pageNumber: 4, documentKind: "policy_schedule" } }],
});
const numberFact = (factKey: string, value: number, unit: string) => ({ ...textFact(factKey, ""), value, unit, valueType: "number" });

/** Stubs the backend reads: `facts` maps a holding id to its facts. */
function stub(holdings: HoldingView[], facts: Record<string, unknown[]> = {}) {
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings, creationIssues: [] });
  vi.spyOn(backendCovers, "holdings").mockResolvedValue(holdings);
  vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
  vi.spyOn(backendCovers, "facts").mockImplementation(async (id: string) => factsIn.parse({ holdingId: id, status: "ready", unknownKeys: [], facts: facts[id] ?? [] }));
}

const TWO_DIFFERENT = () => stub(
  [holding("h1", "Example Health Plan 01", 500000), holding("h2", "Example Family Floater 02", 1000000)],
  { h1: [textFact("room_rent_limit", "Single private room"), textFact("ambulance_limit", "Rs 3,000")], h2: [textFact("room_rent_limit", "Rs 5,000 a day"), textFact("ambulance_limit", "Rs 3,000")] },
);
const sameRows = (table: HTMLElement, same: boolean) => table.querySelectorAll(`[role="row"][data-same="${same}"]`);

describe("compare (R5d.2)", () => {
  it("compare with two policies shows a column per policy and a row per fact", async () => {
    TWO_DIFFERENT();
    render(<RealCompare />);
    const table = await screen.findByTestId("compare-table");
    // The first column header is empty; one more per policy.
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(table).getByRole("columnheader", { name: /Example Health Plan 01/ })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /Example Family Floater 02/ })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Sum insured" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Room rent limit" })).toBeInTheDocument();
    expect(within(table).getByText("Single private room")).toBeInTheDocument();
    expect(within(table).getByText("Rs 5,000 a day")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run a hospital bill through them" })).toHaveAttribute("href", "/stress-test");
  });

  it("Only what differs hides rows whose values are equal", async () => {
    TWO_DIFFERENT();
    render(<RealCompare />);
    const table = await screen.findByTestId("compare-table");
    expect(sameRows(table, true).length).toBeGreaterThan(0);
    expect(within(table).getByRole("rowheader", { name: "Ambulance limit" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Only what differs" }));
    expect(sameRows(table, true)).toHaveLength(0);
    expect(sameRows(table, false).length).toBeGreaterThan(0);
    expect(within(table).queryByRole("rowheader", { name: "Ambulance limit" })).toBeNull();
  });

  it("when nothing differs compare says the policies match", async () => {
    stub([holding("h1", "Example Health Plan 01"), holding("h2", "Example Health Plan 01")]);
    render(<RealCompare />);
    await screen.findByTestId("compare-table");
    fireEvent.click(screen.getByRole("switch", { name: "Only what differs" }));
    expect(screen.getByText("These policies match on everything Knowvia read.")).toBeInTheDocument();
  });

  it("an open value in compare carries the yellow signal", async () => {
    stub([holding("h1", "Example Health Plan 01", 500000, "ready", 20000), holding("h2", "Example Family Floater 02", 500000, "ready", null)]);
    render(<RealCompare />);
    const table = await screen.findByTestId("compare-table");
    const open = table.querySelectorAll('[role="cell"][data-open="true"]');
    expect(open.length).toBeGreaterThan(0);
    expect(open[0].querySelector('[data-kind="warn"]')).not.toBeNull();
    expect(open[0]).toHaveTextContent("Not found yet");
    expect(table.querySelector('[role="cell"][data-open="false"] [data-kind]')).toBeNull();
  });

  it("compare with one readable policy asks for another and shows no table", async () => {
    stub([holding("h1", "Example Health Plan 01"), holding("h2", "Example Family Floater 02", 500000, "uploaded")]);
    render(<RealCompare />);
    expect(await screen.findByRole("heading", { name: "You have one policy. Add another to see them side by side." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a policy" })).toHaveAttribute("href", "/covers/add");
    expect(screen.queryByTestId("compare-table")).toBeNull();
  });

  it("compare shows at most three policies and says so", async () => {
    stub([1, 2, 3, 4].map((n) => holding(`h${n}`, `Example Plan 0${n}`, n * 100000)));
    render(<RealCompare />);
    const table = await screen.findByTestId("compare-table");
    expect(screen.getByText("Showing your first three policies.")).toBeInTheDocument();
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(table).queryByRole("columnheader", { name: /Example Plan 04/ })).toBeNull();
  });
});

const bill = () => screen.findByLabelText("Hospital bill, in rupees") as Promise<HTMLInputElement>;

describe("stress test (R5d.3)", () => {
  it("stress test formats the typed bill and shows what you pay", async () => {
    stub([holding("h1", "Example Health Plan 01", 500000)], { h1: [numberFact("co_pay", 20, "percent")] });
    render(<RealStress />);
    const input = await bill();
    expect(screen.getByTestId("you-pay")).toHaveTextContent("Rs 0");
    expect(screen.getByTestId("stress-result")).toHaveTextContent("Type a bill to see who pays. Sum insured read from your policy: Rs 5,00,000.");
    fireEvent.change(input, { target: { value: "3,00000" } });
    expect(input.value).toBe("3,00,000");
    // 20% co-pay on a Rs 3,00,000 bill is Rs 60,000.
    expect(screen.getByTestId("you-pay")).toHaveTextContent("Rs 60,000");
    expect(screen.getByTestId("stress-result")).toHaveTextContent("Counts your sum insured and co-pay.");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("past the sum insured the amount is marked over and the reason says so", async () => {
    stub([holding("h1", "Example Health Plan 01", 500000)]);
    render(<RealStress />);
    fireEvent.change(await bill(), { target: { value: "700000" } });
    expect(screen.getByTestId("you-pay")).toHaveAttribute("data-over", "true");
    expect(screen.getByTestId("you-pay")).toHaveTextContent("Rs 2,00,000");
    expect(screen.getByTestId("stress-result")).toHaveTextContent("The bill goes past your sum insured of Rs 5,00,000.");
    fireEvent.change(await bill(), { target: { value: "200000" } });
    expect(screen.getByTestId("you-pay")).toHaveAttribute("data-over", "false");
    expect(screen.getByTestId("stress-result")).toHaveTextContent("Within your sum insured of Rs 5,00,000.");
  });

  it("a quick-fill button sets the bill", async () => {
    stub([holding("h1", "Example Health Plan 01", 500000)]);
    render(<RealStress />);
    const input = await bill();
    fireEvent.click(screen.getByRole("button", { name: "Rs 15,00,000" }));
    expect(input.value).toBe("15,00,000");
    fireEvent.click(screen.getByRole("button", { name: "Rs 1,00,000" }));
    expect(input.value).toBe("1,00,000");
    expect(screen.getByTestId("you-pay")).toHaveTextContent("Rs 0");
  });

  it("two policies get a segmented picker and three get one too", async () => {
    stub([holding("h1", "Example Health Plan 01", 500000), holding("h2", "Example Family Floater 02", 300000)]);
    const two = render(<RealStress />);
    await bill();
    const group = screen.getByRole("group", { name: "Policy" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Example Health Plan 01", "Example Family Floater 02"]);
    fireEvent.click(within(group).getByRole("button", { name: "Example Family Floater 02" }));
    expect(screen.getByTestId("stress-result")).toHaveTextContent("Rs 3,00,000");
    two.unmount();
    vi.restoreAllMocks();
    stub([holding("h1", "Example Health Plan 01"), holding("h2", "Example Family Floater 02"), holding("h3", "Example Senior Care 03")]);
    render(<RealStress />);
    await bill();
    expect(within(screen.getByRole("group", { name: "Policy" })).getAllByRole("button")).toHaveLength(3);
  });

  it("without a readable sum insured stress test links to what we found", async () => {
    stub([holding("h1", "Example Health Plan 01", null)]);
    render(<RealStress />);
    const link = await screen.findByRole("link", { name: "Check what we found" });
    expect(link).toHaveAttribute("href", "/covers/review?holding=h1");
    expect(screen.getByTestId("stress-result")).toHaveTextContent("The sum insured of this policy has not been read or needs your decision yet, so we cannot work out who pays.");
    expect(screen.queryByTestId("you-pay")).toBeNull();
  });
});

const hospital = (n: number, cashless: boolean, address: string | null = `${n} Example Road`) => ({ id: `x${n}`, name: `Example Hospital ${n}`, address, city: "Bengaluru", pincode: "560038", cashless });

async function search(pincode = "560038") {
  const go = await screen.findByRole("button", { name: "Find hospitals" });
  fireEvent.change(screen.getByLabelText("Pincode"), { target: { value: pincode } });
  await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(go);
}

describe("hospitals (R5d.4)", () => {
  it("hospitals shows the lead line before a search", async () => {
    adapterCalls.holdings.mockResolvedValue([holding("h1", "Example Health Plan 01")]);
    render(<HospitalsView />);
    expect(await screen.findByText("Type a pincode to see which hospitals take your policy without cash.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Network hospitals" })).toBeInTheDocument();
    expect(screen.queryByTestId("hospital-count")).toBeNull();
  });

  it("hospital rows show name, address and the cashless signal", async () => {
    adapterCalls.holdings.mockResolvedValue([holding("h1", "Example Health Plan 01")]);
    adapterCalls.hospitals.mockResolvedValue([hospital(1, true), hospital(2, false, null)]);
    render(<HospitalsView />);
    await search();
    const list = await screen.findByRole("list", { name: "Hospitals" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Example Hospital 1");
    expect(rows[0]).toHaveTextContent("1 Example Road, Bengaluru, 560038");
    expect(rows[0].querySelector('[data-cashless="true"] [data-kind="ok"]')).toHaveTextContent("Cashless");
    // A missing address is skipped, not printed as "null".
    expect(rows[1]).toHaveTextContent("Bengaluru, 560038");
    expect(rows[1].querySelector('[data-cashless="false"] [data-kind="warn"]')).toHaveTextContent("Cashless not listed");
    expect(screen.getByTestId("hospital-count")).toHaveTextContent("2 hospitals near 560038 · 1 cashless");
    expect(adapterCalls.hospitals).toHaveBeenCalledWith("h1", "560038");
  });

  it("no hospital for a pincode shows the try nearby line", async () => {
    adapterCalls.holdings.mockResolvedValue([holding("h1", "Example Health Plan 01")]);
    adapterCalls.hospitals.mockResolvedValue([]);
    render(<HospitalsView />);
    await search("560099");
    expect(await screen.findByText("No network hospital is listed for this pincode. Try a nearby one.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Hospitals" })).toBeNull();
  });

  it("hospitals with no policy shows the empty state", async () => {
    adapterCalls.holdings.mockResolvedValue([]);
    render(<HospitalsView />);
    expect(await screen.findByRole("heading", { name: "No policy yet" })).toBeInTheDocument();
    expect(screen.getByText("Add your policy and we can show the hospitals in its network.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a policy" })).toHaveAttribute("href", "/covers/add");
    expect(screen.queryByLabelText("Pincode")).toBeNull();
    expect(screen.queryByText("Type a pincode to see which hospitals take your policy without cash.")).toBeNull();
  });
});
