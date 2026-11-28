// @vitest-environment jsdom
// R3d Home: the cover as one sentence, one next step, three equal right cards. Real-account Home against stubbed backend reads.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { backendCovers } from "@/adapters/covers";
import { AdapterError } from "@/adapters/types";
import type { FactView, HoldingView } from "@/adapters/covers-contract";
import { RealHome } from "@/components/cover-real/RealHome";
import { HomeGreeting } from "@/components/shell/HomeGreeting";

const me = vi.hoisted(() => ({ state: { status: "ready", me: { owner: { displayName: "Asha Example" } } } as unknown }));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: me.state, retry: vi.fn() }), invalidateMe: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fact = (o: Partial<FactView> & { factKey: string }): FactView => ({ status: "extracted_unverified", alternatives: [], checkWithInsurer: false, sources: [], ...o });
const WITH_SUM: HoldingView["summary"] = {
  insurerName: "Example Insurer", productName: "Example Health Plan 01",
  sumInsured: { factKey: "sum_insured", value: { amountMinor: 100000000, currency: "INR" }, status: "extracted_unverified" },
  policyPeriod: null, premium: null,
};
const NO_SUM: HoldingView["summary"] = { insurerName: "Example Insurer", productName: "Example Health Plan 01", sumInsured: null, policyPeriod: null, premium: null };
const holding = (id: string, summary = WITH_SUM): HoldingView => ({ id, documentId: `d-${id}`, kind: "policy_wording", status: "ready", summary });
const RENEWAL = fact({ factKey: "renewal_date", value: "2027-03-14", unit: "iso_date" });
const OTHER = fact({ factKey: "room_rent_limit", value: 500000, unit: "paise", valueType: "number" });

function stub(holdings: HoldingView[], facts: FactView[] = [OTHER]) {
  vi.spyOn(backendCovers, "holdingsView").mockResolvedValue({ holdings, creationIssues: [] });
  vi.spyOn(backendCovers, "facts").mockResolvedValue({ holdingId: "h1", status: "ready", facts, unknownKeys: [] });
  vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "ready", conflicts: [] });
}

describe("Home (R3d)", () => {
  it("one policy with a sum insured reads as one sentence", async () => {
    stub([holding("h1")]);
    render(<RealHome />);
    const cover = await screen.findByTestId("home-cover");
    expect(cover).toHaveTextContent("Rs 10,00,000");
    expect(cover.closest("h2")).toHaveTextContent("You have Rs 10,00,000 of health cover.");
  });

  it("one policy without a sum insured says the policy is on Knowvia", async () => {
    stub([holding("h1", NO_SUM)]);
    render(<RealHome />);
    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent("Your policy is on Knowvia.");
    expect(screen.queryByTestId("home-cover")).toBeNull();
  });

  it("two policies show the count and never add values together", async () => {
    stub([holding("h1"), holding("h2")]);
    render(<RealHome />);
    const cover = await screen.findByTestId("home-cover");
    expect(cover).toHaveTextContent(/^2$/);
    expect(cover.closest("h2")).toHaveTextContent("You have 2 policies on Knowvia.");
    expect(document.body.textContent).not.toContain("20,00,000");
  });

  it("the next step is the only primary action and links to the next step", async () => {
    stub([holding("h1")]);
    const { container } = render(<RealHome />);
    const next = await screen.findByTestId("home-next");
    expect(next).toHaveAttribute("href", "/chat?holding=h1");
    expect(next.className).toMatch(/cta/);
    expect(container.querySelectorAll('[class*="cta"]')).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("each of the first two policies is a card that links to its page", async () => {
    stub([holding("h1"), holding("h2")]);
    render(<RealHome />);
    const cards = await screen.findAllByTestId("home-policy");
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.getAttribute("href"))).toEqual(["/policies/h1", "/policies/h2"]);
    expect(cards[0]).toHaveAttribute("aria-label", "Example Health Plan 01");
    expect(cards[0]).toHaveTextContent("Example Insurer");
    expect(cards[0]).toHaveTextContent("Rs 10,00,000");
    expect(cards[0].querySelector('[data-kind="ok"]')).toHaveTextContent("Read and ready");
    expect(cards[0]).not.toHaveTextContent("more");
    // Two policies leave no room for the Ask card: its prompts are not on the page, and the next-step card is the third.
    expect(screen.queryByRole("link", { name: "What are my waiting periods?" })).toBeNull();
  });

  it("a third policy shows and 1 more on the second card", async () => {
    stub([holding("h1"), holding("h2"), holding("h3")]);
    render(<RealHome />);
    const cards = await screen.findAllByTestId("home-policy");
    expect(cards).toHaveLength(2);
    expect(cards[1]).toHaveTextContent("and 1 more");
    expect(cards[0]).not.toHaveTextContent("and 1 more");
  });

  it("renewal found shows the date with a green signal", async () => {
    stub([holding("h1")], [RENEWAL]);
    render(<RealHome />);
    await screen.findByTestId("home-cover");
    const panel = screen.getByTestId("home-renewal");
    expect(panel.textContent).toContain("2027");
    expect(panel).toHaveTextContent("Your next renewal.");
    expect(panel).toHaveTextContent("Example Health Plan 01");
    expect(panel).toHaveAttribute("href", "/policies/h1");
  });

  it("renewal missing shows Not in your policy with a yellow signal", async () => {
    stub([holding("h1")], [OTHER]);
    const { container } = render(<RealHome />);
    await screen.findByTestId("home-cover");
    const panel = screen.getByTestId("home-renewal");
    expect(panel).toHaveTextContent("No renewal date yet");
    expect(panel).toHaveTextContent("Open your policy to check its dates.");
    expect(container.textContent).not.toMatch(/Invalid Date|undefined|null/);
  });

  it("ask has two prompts that link to chat with the question", async () => {
    stub([holding("h1")]);
    const { container } = render(<RealHome />);
    await screen.findByTestId("home-cover");
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="/chat?q="]'));
    expect(links.map((l) => l.textContent)).toEqual(["What are my waiting periods?", "What does my policy not cover?"]);
    expect(links.map((l) => decodeURIComponent(l.getAttribute("href")!.split("q=")[1]))).toEqual(links.map((l) => l.textContent));
    expect(links[0].getAttribute("href")).toContain("%20");
  });

  it("home has no Soon tile and no Cover per person", async () => {
    stub([holding("h1")]);
    const { container } = render(<RealHome />);
    await screen.findByTestId("home-cover");
    expect(container).not.toHaveTextContent("Cover per person");
    expect(container).not.toHaveTextContent("Soon");
    expect(container).not.toHaveTextContent("Your cover at a glance");
    expect(container.querySelector('[aria-disabled="true"]')).toBeNull();
  });

  it("loading, error and empty states are unchanged", async () => {
    stub([]);
    const empty = render(<RealHome />);
    expect(empty.container.textContent).toContain("Loading");
    expect(await screen.findByTestId("empty-state")).toHaveTextContent("Add your first policy");
    expect(screen.getByRole("link", { name: "Add a policy" })).toHaveAttribute("href", "/covers/add");
    empty.unmount();
    vi.spyOn(backendCovers, "holdingsView").mockRejectedValue(new AdapterError("HOLDINGS_DISABLED"));
    render(<RealHome />);
    expect(await screen.findByTestId("real-error")).toHaveTextContent("Cover details are not switched on yet.");
  });

  it("the greeting has no date line", async () => {
    const { container } = render(<HomeGreeting />);
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/^Good (morning|afternoon|evening), Asha\.$/);
    expect(container.textContent).not.toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    expect(container.querySelector(".k-no-fade")).not.toBeNull();
  });

  it("the next-step button text follows where it leads", async () => {
    // Nothing open: the next step is to ask, so the button says "Ask now".
    stub([holding("h1")]);
    const ask = render(<RealHome />);
    expect(await screen.findByTestId("home-next")).toHaveTextContent("Ask now");
    ask.unmount();
    vi.restoreAllMocks();
    // A policy that still needs its plan chosen: the step leads to /covers/add.
    stub([{ ...holding("h1"), status: "insurer_pending" }]);
    const plan = render(<RealHome />);
    const choose = await screen.findByTestId("home-next");
    expect(choose).toHaveAttribute("href", "/covers/add?resume=1");
    expect(choose).toHaveTextContent("Choose your plan");
    plan.unmount();
    vi.restoreAllMocks();
    // An open detail: the step leads to /covers/review.
    stub([{ ...holding("h1"), status: "conflicts" }]);
    vi.spyOn(backendCovers, "conflicts").mockResolvedValue({ holdingId: "h1", status: "conflicts", conflicts: [{ id: "c1", factKey: "copay_percent", reason: "tier_mismatch", resolution: "pending", checkWithInsurer: false, candidates: [] }] });
    render(<RealHome />);
    const decide = await screen.findByTestId("home-next");
    expect(decide).toHaveAttribute("href", "/covers/review?holding=h1");
    expect(decide).toHaveTextContent("Decide now");
  });
});
