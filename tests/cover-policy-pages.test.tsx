// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StressTest } from "@/components/cover/StressTest";
import { Compare } from "@/components/cover/Compare";
import { pressPageShortcut } from "@/lib/shortcuts";
import { PolicyList } from "@/components/cover/PolicyList";
import { PolicyReader } from "@/components/cover/PolicyReader";

const BANNED = /sample|demo|preview|draft|placeholder|lorem|not advice|not an insurer|CoverSaath|Saath/i;
afterEach(cleanup);

describe("stress test page", () => {
  it("keys 1 to 5 pick the person and the title follows", () => {
    render(<StressTest />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("If Father needed this, who pays?");
    act(() => pressPageShortcut("person-1"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("If Meera needed this, who pays?");
    act(() => pressPageShortcut("person-4"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("If Mother needed this, who pays?");
  });
  it("the top-up lever lowers what Father pays and shows as on", () => {
    render(<StressTest />);
    const before = screen.getByRole("status").textContent;
    fireEvent.click(screen.getByRole("switch", { name: "Add a Rs 10L top-up" }));
    expect(screen.getByRole("switch", { name: "Add a Rs 10L top-up" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("status").textContent).not.toBe(before);
  });
  it("has the three board sections and no banned words", () => {
    const { container } = render(<StressTest />);
    for (const h of ["The bill, step by step", "Same treatment, whole family", "Section by section"]) expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(BANNED);
  });
});

describe("compare page", () => {
  it("keys 1 to 4 pick a plan and priority chips change the fit", () => {
    const { container } = render(<Compare />);
    act(() => pressPageShortcut("plan-1"));
    expect(screen.getByText(/Your current cover scores 67%/)).toBeInTheDocument();
    act(() => pressPageShortcut("plan-3"));
    expect(screen.getByText(/Keep your group plan and add Meridian Care/)).toBeInTheDocument();
    const chip = screen.getByRole("button", { name: /^No co-pay, Off/ });
    fireEvent.click(chip);
    expect(screen.getByRole("button", { name: /^No co-pay, Low/ })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(BANNED);
  });
  it("shows the best fit in the Recommended style", () => {
    render(<Compare />);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
  });
});

describe("policies", () => {
  it("lists the policies and links to each", async () => {
    render(<PolicyList />);
    await waitFor(() => expect(screen.getByText("Group floater Rs 5L")).toBeInTheDocument());
    expect(screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/policies/northstar-floater")).toBe(true);
  });
  it("reader: picking ICU marks the documents disagree and flips to the schedule on its tab", async () => {
    const { container } = render(<PolicyReader id="northstar-floater" />);
    await waitFor(() => expect(screen.getByText("Room rent, boarding and nursing: up to 1% of the sum insured per day.")).toBeInTheDocument());
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /^ICU/ })));
    expect(screen.getByText("Your documents disagree")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Where the documents disagree" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Policy schedule" }));
    expect(container.textContent).toContain("Schedule of cover");
    expect(container.textContent).not.toMatch(BANNED);
  });
  it("reader: unknown policy says so", async () => {
    render(<PolicyReader id="nope" />);
    await waitFor(() => expect(screen.getByText("We could not find that policy")).toBeInTheDocument());
  });
});
