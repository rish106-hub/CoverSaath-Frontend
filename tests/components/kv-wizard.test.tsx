// @vitest-environment jsdom
// R3b add-a-policy wizard: the pure screen rules and copy, then each screen through the real view with mock adapters.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({
  listUploads: vi.fn(),
  grant: vi.fn(),
  slotsRead: vi.fn(),
  upload: vi.fn(),
  resume: vi.fn(),
  holdingFor: vi.fn(),
  candidates: vi.fn(),
  confirm: vi.fn(),
  products: vi.fn(),
  membersList: vi.fn(),
  membersAdd: vi.fn(),
  holdings: [] as unknown[],
  holdingsFail: false,
  me: { state: { status: "ready", me: { source: "mock" } } as unknown },
  payDeps: { order: vi.fn(), open: vi.fn(), verify: vi.fn(), slots: vi.fn(), wait: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/covers/add",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/adapters/uploads", async (orig) => {
  const real = await orig<typeof import("@/adapters/uploads")>();
  return { ...real, uploads: { list: () => h.listUploads(), grantConsent: (key: string) => h.grant(key) } };
});
vi.mock("@/adapters/payments", () => ({ payments: { slots: () => h.slotsRead() } }));
vi.mock("@/components/covers/pay-flow", async (orig) => {
  const real = await orig<typeof import("@/components/covers/pay-flow")>();
  return { ...real, realPayDeps: () => h.payDeps };
});
vi.mock("@/adapters/covers", async (orig) => {
  const real = await orig<typeof import("@/adapters/covers")>();
  return { ...real, backendCovers: { holdingsView: () => Promise.resolve({ holdings: [{ id: "h1" }] }) } };
});
vi.mock("@/adapters", () => ({
  adapters: {
    covers: {
      holdingsView: () => (h.holdingsFail ? Promise.reject(new Error("boom")) : Promise.resolve({ holdings: h.holdings, creationIssues: [] })),
      uploadDocument: (...a: unknown[]) => h.upload(...a),
      resumeDocument: (...a: unknown[]) => h.resume(...a),
      holdingFor: (...a: unknown[]) => h.holdingFor(...a),
      candidates: (...a: unknown[]) => h.candidates(...a),
      confirmProduct: (...a: unknown[]) => h.confirm(...a),
    },
    reference: { products: (...a: unknown[]) => h.products(...a) },
    members: { list: () => h.membersList(), add: (...a: unknown[]) => h.membersAdd(...a) },
    household: { household: () => Promise.resolve({ members: [] }) },
    document: { list: () => Promise.resolve([]) },
  },
}));
vi.mock("@/components/shell/useMe", () => ({ useMe: () => ({ state: h.me.state, retry: vi.fn() }), invalidateMe: vi.fn() }));
vi.mock("@/components/shell/UserChip", () => ({ UserChip: () => <div data-testid="user-chip" /> }));
vi.mock("@/components/agent", () => ({
  AgentProvider: ({ children }: { children: unknown }) => <>{children as never}</>,
  AgentLayer: () => <div data-testid="agent-layer" />,
  HeaderMic: () => null,
  AskBar: () => <form role="search" aria-label="Ask about your cover" />,
  useAgent: () => ({ setPaletteOpen: vi.fn() }),
}));

import { AddCoverView } from "@/components/covers/AddCoverView";
import { AppShell } from "@/components/shell/AppShell";
import { POLL_MS, STAGE_COPY, WIZARD_STEPS, guideFor, screenOf, stepOf, type ScreenInput, type WizardScreen } from "@/components/covers/wizard-copy";
import { AdapterError } from "@/adapters/types";

const FREE = { enabled: false, used: 0, allowed: 1, canAdd: true, pricePaise: 19900, currency: "INR" };
const FULL = { enabled: true, used: 1, allowed: 1, canAdd: false, pricePaise: 19900, currency: "INR" };
const PAID = { ...FULL, allowed: 2, canAdd: true };
const proof = { orderId: "order_1", paymentId: "pay_1", signature: "sig_1" };
const order = { orderId: "order_1", amountPaise: 19900, currency: "INR", keyId: "key_synthetic" };
const cand = (n: number) => ({ candidateId: `c${n}`, insurerName: "Example Insurer", productName: `Plan ${n}`, rank: n });
const person = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, relation: "Spouse", ageYears: null, isOwner: false, isYou: false, ...extra });
const pdf = (name: string) => new File([new Uint8Array(8)], name, { type: "application/pdf" });
const chooseFile = (name = "schedule.pdf") => fireEvent.change(screen.getByTestId("schedule-input"), { target: { files: [pdf(name)] } });
const heading = (name: string) => screen.findByRole("heading", { level: 1, name });

beforeEach(() => {
  for (const fn of [h.listUploads, h.grant, h.slotsRead, h.upload, h.resume, h.holdingFor, h.candidates, h.confirm, h.products, h.membersList, h.membersAdd, ...Object.values(h.payDeps)]) fn.mockReset();
  h.holdings = [];
  h.holdingsFail = false;
  h.me.state = { status: "ready", me: { source: "mock" } };
  h.listUploads.mockResolvedValue({ consent: true, documents: [], largeUpload: false, policyType: null });
  h.grant.mockResolvedValue(undefined);
  h.slotsRead.mockResolvedValue(FREE);
  h.upload.mockResolvedValue({ documentId: "doc-1" });
  h.holdingFor.mockResolvedValue("holding-1");
  h.candidates.mockResolvedValue({ holdingId: "holding-1", profileVersion: 1, candidates: [cand(1), cand(2), cand(3), cand(4)] });
  h.confirm.mockResolvedValue(undefined);
  h.products.mockResolvedValue({ products: [] });
  h.membersList.mockResolvedValue([]);
  h.membersAdd.mockImplementation(async (input: { name: string; relation: string }) => person(`m-${input.name}`, input.name, { relation: input.relation }));
  h.payDeps.order.mockResolvedValue(order);
  h.payDeps.open.mockResolvedValue(proof);
  h.payDeps.verify.mockResolvedValue(PAID);
  h.payDeps.slots.mockResolvedValue(FULL);
  h.payDeps.wait.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/** Upload a file and wait for the plan guesses. */
async function toPlan() {
  render(<AddCoverView />);
  await screen.findByTestId("schedule-input");
  chooseFile();
  await heading("Which plan is this?");
}
/** Pick the first guess and confirm: lands on the family screen. */
async function toPeople() {
  await toPlan();
  fireEvent.click(screen.getAllByRole("radio")[0]);
  fireEvent.click(screen.getByRole("button", { name: /^Yes, it is/ }));
  await heading("Who is in your family?");
}

const BASE: ScreenInput = { consent: true, loadFailed: false, done: false, peopleDone: false, hasCandidates: false, slotStatus: "empty", slotCode: null, mustPay: false, hasHolding: false };
const at = (over: Partial<ScreenInput>) => screenOf({ ...BASE, ...over });

describe("add-a-policy wizard", () => {
  it("screenOf follows the pinned order for every screen", () => {
    expect(at({ consent: null })).toBe("loading");
    expect(at({ consent: null, loadFailed: true })).toBe("load-failed");
    expect(at({ done: true, peopleDone: true, hasCandidates: true, consent: false })).toBe("cover");
    expect(at({ done: true, hasCandidates: true, consent: false })).toBe("people");
    expect(at({ hasCandidates: true, consent: false, slotStatus: "working" })).toBe("plan");
    expect(at({ consent: false, slotStatus: "working", mustPay: true })).toBe("consent");
    expect(at({ slotStatus: "working", mustPay: true })).toBe("reading");
    expect(at({ slotStatus: "waiting" })).toBe("reading");
    expect(at({ slotStatus: "failed", slotCode: "PDF_PROTECTED", mustPay: true })).toBe("guide");
    expect(at({ slotStatus: "failed", slotCode: null })).toBe("guide");
    expect(at({ slotStatus: "failed", slotCode: "PAYMENT_REQUIRED", mustPay: true })).toBe("pay");
    expect(at({ slotStatus: "failed", slotCode: "CONSENT_REQUIRED" })).toBe("find");
    expect(at({ mustPay: true })).toBe("pay");
    expect(at({ slotStatus: "done", hasHolding: true, mustPay: true })).toBe("pay");
    expect(at({ slotStatus: "done", hasHolding: true })).toBe("plan-retry");
    expect(at({ slotStatus: "done", hasHolding: false })).toBe("find");
    expect(at({})).toBe("find");
  });

  it("stepOf maps every screen to its step", () => {
    const expected: Record<WizardScreen, 1 | 2 | 3 | 4> = {
      loading: 1, "load-failed": 1, consent: 1, pay: 1, find: 1, reading: 2, guide: 2, plan: 2, "plan-retry": 2, people: 3, cover: 4,
    };
    for (const [screenName, step] of Object.entries(expected)) expect(stepOf(screenName as WizardScreen), screenName).toBe(step);
  });

  it("guideFor returns the pinned title, fix and action for every listed code", () => {
    const clean = "Open it, choose Print, then Save as PDF. Add the new copy.";
    const scheduleOnly = "Add only the schedule pages: who is covered, the sum insured and the dates.";
    const straight = "Knowvia reads it straight away.";
    const password = [
      { title: "Open the PDF", text: "Type the password. It is often your date of birth or policy number." },
      { title: "Print, then Save as PDF", text: "This makes a new copy with no lock." },
      { title: "Add the new copy here", text: straight },
    ];
    const cleanSteps = [
      { title: "Open the PDF", text: "Any PDF viewer or your browser works." },
      { title: "Print, then Save as PDF", text: "This makes a clean copy." },
      { title: "Add the new copy here", text: straight },
    ];
    const smaller = [
      { title: "Open the PDF", text: "Find the schedule: who is covered, the sum insured and the dates." },
      { title: "Print only those pages", text: "Choose Save as PDF as the printer." },
      { title: "Add the smaller copy here", text: straight },
    ];
    const rows: [string[], string, string, string, { title: string; text: string }[]][] = [
      [["PDF_PROTECTED"], "This PDF has a password on it.", clean, "another", password],
      [["PDF_ACTIVE_CONTENT", "PDF_TOO_COMPLEX"], "This PDF needs a clean copy.", clean, "another", cleanSteps],
      [["FILE_TYPE_INVALID"], "That file is not a PDF.", "Download the policy as a PDF from your insurer's email or app.", "another", []],
      [["FILE_TOO_LARGE"], "That PDF is too big.", scheduleOnly, "another", smaller],
      [["PDF_TOO_LONG"], "That PDF has too many pages.", scheduleOnly, "another", smaller],
      [["FILE_EMPTY", "PDF_UNREADABLE"], "We could not open this PDF.", "Download a fresh copy from your insurer and add it.", "another", []],
      [["DOCUMENT_REJECTED", "POLICY_TYPE_INVALID"], "We could not accept this file.", "Add another copy of the policy.", "another", []],
      [["HOLDING_CREATE_FAILED", "READING_FAILED"], "We could not read this one.", "Add it again, or use the copy from your insurer's email.", "another", []],
      [["DUPLICATE_DOCUMENT", "HOLDING_DOCUMENT_HAS_HOLDING"], "This policy is already added.", "Open it from My policies.", "policies", []],
      [["READING_UNAVAILABLE", "UPLOAD_UNAVAILABLE", "HOLDINGS_DISABLED"], "Reading is paused right now.", "Your file is saved. Come back in a little while.", "later", []],
      [["UNAUTHENTICATED"], "Please sign in again.", "Then add your policy.", "signin", []],
    ];
    for (const [codes, title, fix, action, steps] of rows) for (const code of codes) expect(guideFor(code), code).toEqual({ title, fix, action, steps });
  });

  it("guideFor falls back to the retry guidance for an unknown code", () => {
    const retry = { title: "That did not go through.", fix: "Check your connection and try again.", action: "retry", steps: [] };
    expect(guideFor("BACKEND_UNREACHABLE")).toEqual(retry);
    expect(guideFor("")).toEqual(retry);
    expect(guideFor("toString")).toEqual(retry);
  });

  it("the frame shows four steps and marks the current one", async () => {
    const { container } = render(<AddCoverView />);
    await heading("Drop your policy PDF here.");
    const steps = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    WIZARD_STEPS.forEach((name, i) => expect(steps[i].textContent).toBe(`${i + 1}${name}`));
    expect(steps.filter((li) => li.getAttribute("aria-current") === "step").map((li) => li.textContent)).toEqual(["1Find your policy"]);
    expect(steps.some((li) => li.getAttribute("data-done") === "true")).toBe(false);
    expect(container.querySelector("[data-screen]")?.getAttribute("data-screen")).toBe("find");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Close" }).getAttribute("href")).toBe("/home");
  });

  it("consent has one button and no checkbox, and granting moves to find", async () => {
    h.listUploads.mockResolvedValue({ consent: false, documents: [], largeUpload: false, policyType: null });
    render(<AddCoverView />);
    await heading("Can Knowvia read your policy?");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Yes, read my policy"]);
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    fireEvent.click(screen.getByRole("button", { name: "Yes, read my policy" }));
    await heading("Drop your policy PDF here.");
    expect(h.grant).toHaveBeenCalledTimes(1);
  });

  it("a held file is sent again after consent is granted", async () => {
    h.upload.mockRejectedValueOnce(new AdapterError("CONSENT_REQUIRED"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile();
    await heading("Can Knowvia read your policy?");
    fireEvent.click(screen.getByRole("button", { name: "Yes, read my policy" }));
    await heading("Which plan is this?");
    expect(h.upload).toHaveBeenCalledTimes(2);
    // Same file, same request key: a second try can never store the policy twice.
    expect(h.upload.mock.calls[1][0]).toBe(h.upload.mock.calls[0][0]);
    expect(h.upload.mock.calls[1][1]).toBe(h.upload.mock.calls[0][1]);
  });

  it("reading shows the stage heading, the five rows and a bar at the stage percent", async () => {
    h.upload.mockImplementation((_file: File, _key: string, _kind: string, _type: string, onStage: (s: string) => void) => {
      onStage("reading");
      return new Promise(() => undefined);
    });
    const { container } = render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile();
    await heading(STAGE_COPY.reading.h1);
    const rows = Array.from(container.querySelectorAll("[data-step]"));
    expect(rows.map((r) => r.getAttribute("data-step"))).toEqual(["done", "done", "active", "todo", "todo"]);
    expect(rows.map((r) => r.textContent?.replace(" (in progress)", ""))).toEqual(["Sending your PDF", "Safety check", "Reading the pages", "Pulling out cover details", "Finding your plan"]);
    expect(rows[2].textContent).toContain("(in progress)");
    expect(screen.getByRole("progressbar", { name: "Reading your policy" }).getAttribute("aria-valuenow")).toBe("55");
    expect(container.querySelector('[data-state="working"]')?.getAttribute("data-stage")).toBe("reading");
  });

  it("a waiting document is checked again by itself and the timer stops on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.listUploads.mockResolvedValue({
      consent: true, largeUpload: false, policyType: "personal_health",
      documents: [{ id: "d1", kind: "policy_schedule", sizeBytes: 10, uploadedAt: null, note: null, busy: true, steps: { uploaded: "done", scanned: "done", reading: "active", structured: "pending" } }],
    });
    h.resume.mockResolvedValue({ documentId: "d1", busy: true });
    const { unmount } = render(<AddCoverView />);
    await screen.findByText(/Still working on it/);
    expect(h.resume).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS); });
    expect(h.resume).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3); });
    expect(h.resume).toHaveBeenCalledTimes(2);
  });

  it("a password-protected PDF shows guidance with Choose another PDF and no code", async () => {
    h.upload.mockRejectedValue(new AdapterError("PDF_PROTECTED"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile("locked.pdf");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { level: 1, name: "This PDF has a password on it." })).toBeInTheDocument();
    // The numbered fix cards replace the one-line fix when a guide has steps (R5c.4).
    expect(alert.textContent).toContain("Print, then Save as PDF");
    expect(alert.textContent).toContain("locked.pdf");
    expect(screen.getByRole("button", { name: "Choose another PDF" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(document.body.textContent).not.toContain("PDF_PROTECTED");
  });

  it("a network failure shows Try again and Choose another PDF", async () => {
    h.upload.mockRejectedValueOnce(new AdapterError("BACKEND_UNREACHABLE"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile();
    await heading("That did not go through.");
    expect(screen.getByRole("button", { name: "Choose another PDF" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await heading("Which plan is this?");
    expect(h.upload.mock.calls[1][1]).toBe(h.upload.mock.calls[0][1]);
  });

  it("guesses are capped at three and search results at four", async () => {
    h.products.mockResolvedValue({ products: [1, 2, 3, 4, 5, 6].map((n) => ({ productId: `p${n}`, productName: `Found ${n}` })) });
    await toPlan();
    expect(within(screen.getByRole("radiogroup", { name: "Plan choices" })).getAllByRole("radio")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Something else" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Insurer or plan name/ }), { target: { value: "found" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const results = await screen.findByRole("radiogroup", { name: "Search results" });
    expect(within(results).getAllByRole("radio")).toHaveLength(4);
  });

  it("pay shows the price in the heading and the button", async () => {
    h.slotsRead.mockResolvedValue(FULL);
    render(<AddCoverView />);
    await heading("Add another policy for Rs 199.");
    expect(screen.getByTestId("pay-card")).toBeInTheDocument();
    expect(screen.getByText("Your first policy is free. Each one after that is Rs 199, paid once.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay Rs 199" })).toBeEnabled();
  });

  it("a stopped payment shows its reason and Pay again", async () => {
    h.slotsRead.mockResolvedValue(FULL);
    h.payDeps.open.mockRejectedValue(new AdapterError("PAYMENT_CANCELLED"));
    render(<AddCoverView />);
    fireEvent.click(await screen.findByRole("button", { name: "Pay Rs 199" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("You closed the payment window. Nothing was paid.");
    expect(screen.getByRole("button", { name: "Pay Rs 199" })).toBeEnabled();
  });

  it("an unconfirmed payment offers Check again and no Pay button", async () => {
    h.slotsRead.mockResolvedValue(FULL);
    h.payDeps.verify.mockRejectedValue(new AdapterError("PAYMENT_VERIFY_FAILED"));
    render(<AddCoverView />);
    fireEvent.click(await screen.findByRole("button", { name: "Pay Rs 199" }));
    const again = await screen.findByRole("button", { name: "Check again" });
    expect(screen.getByRole("alert").textContent).toContain("We are still confirming your payment.");
    expect(screen.queryByRole("button", { name: /^Pay Rs/ })).toBeNull();
    expect(h.payDeps.open).toHaveBeenCalledTimes(1);
    fireEvent.click(again);
    await screen.findByRole("button", { name: "Check again" });
    // The second look re-confirms the same proof; the payment window is never opened twice.
    expect(h.payDeps.verify).toHaveBeenCalledTimes(2);
    expect(h.payDeps.open).toHaveBeenCalledTimes(1);
  });

  it("after paying, the held file goes up without choosing it again", async () => {
    h.upload.mockRejectedValueOnce(new AdapterError("PAYMENT_REQUIRED"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile();
    fireEvent.click(await screen.findByRole("button", { name: "Pay Rs 199" }));
    await heading("Which plan is this?");
    expect(h.upload).toHaveBeenCalledTimes(2);
    expect(h.upload.mock.calls[1][0]).toBe(h.upload.mock.calls[0][0]);
    expect(h.upload.mock.calls[1][1]).toBe(h.upload.mock.calls[0][1]);
    expect(h.payDeps.open).toHaveBeenCalledTimes(1);
  });

  it("people lists the family, adds a person and keeps the name on failure", async () => {
    h.membersList.mockResolvedValue([person("o", "Owner Person", { isOwner: true }), person("y", "You Person", { isYou: true }), ...[1, 2, 3, 4, 5].map((n) => person(`m${n}`, `Relative ${n}`))]);
    await toPeople();
    await screen.findByText("Relative 1");
    expect(screen.queryByText("Owner Person")).toBeNull();
    expect(screen.queryByText("You Person")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(4 + WIZARD_STEPS.length);
    expect(screen.getByText("and 1 more")).toBeInTheDocument();
    const name = screen.getByRole("textbox", { name: /Name/ });
    expect(screen.getByRole("button", { name: "Add person" })).toBeDisabled();
    fireEvent.change(name, { target: { value: "  Asha  " } });
    fireEvent.change(screen.getByRole("combobox", { name: /Relation/ }), { target: { value: "Daughter" } });
    fireEvent.click(screen.getByRole("button", { name: "Add person" }));
    await screen.findByText("and 2 more");
    expect(h.membersAdd).toHaveBeenCalledWith({ name: "Asha", relation: "Daughter" });
    expect((name as HTMLInputElement).value).toBe("");
    h.membersAdd.mockRejectedValueOnce(new Error("boom"));
    fireEvent.change(name, { target: { value: "Ravi" } });
    fireEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect((await screen.findByRole("alert")).textContent).toContain("We could not save that. Try again.");
    expect((name as HTMLInputElement).value).toBe("Ravi");
  });

  it("Skip for now and Continue both reach the cover screen", async () => {
    await toPeople();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await heading("Example Insurer – Plan 1 is in.");
    cleanup();
    await toPeople();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await heading("Example Insurer – Plan 1 is in.");
  });

  it("cover names the plan and links to the policy, the findings and health details", async () => {
    await toPeople();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await heading("Example Insurer – Plan 1 is in.");
    expect(screen.getByRole("status").textContent).toBe("Your cover is saved.");
    expect(screen.getByRole("link", { name: "Open my policy" }).getAttribute("href")).toBe("/policies/holding-1");
    expect(screen.getByRole("link", { name: "See what we found" }).getAttribute("href")).toBe("/covers/review?holding=holding-1");
    expect(screen.getByRole("link", { name: "Add health details" }).getAttribute("href")).toBe("/covers/declarations?holding=holding-1");
    expect(within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem")[3].getAttribute("aria-current")).toBe("step");
  });

  const HEADLINE_HOLDING = {
    id: "holding-1", documentId: "doc-1", kind: "policy_schedule", status: "ready",
    summary: {
      insurerName: "Example Insurer", productName: "Plan 1",
      sumInsured: { factKey: "sum_insured", value: { amountMinor: 50000000, currency: "INR" }, status: "extracted_unverified" },
      policyPeriod: { factKey: "policy_period", value: { startIso: "2026-04-01", endIso: "2027-03-31", days: 365 }, status: "user_confirmed" },
      premium: { factKey: "premium_total", value: null, status: "unknown" },
    },
  };
  async function toCover() {
    await toPeople();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await heading("Example Insurer – Plan 1 is in.");
  }

  it("the step bar draws a line between steps and ticks the done ones", async () => {
    const { container } = render(<AddCoverView />);
    await heading("Drop your policy PDF here.");
    expect(container.querySelectorAll('[aria-label="Steps"] li > [data-reached]')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-label="Steps"] svg')).toHaveLength(0);
    cleanup();
    await toPeople();
    const steps = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
    expect(steps.map((li) => li.getAttribute("data-done"))).toEqual(["true", "true", null, null]);
    expect(steps[0].querySelector("svg")).not.toBeNull();
    expect(steps[2].querySelector("svg")).toBeNull();
    // A line follows each of the first three steps; the ones before the current step are marked reached.
    expect(steps.map((li) => li.querySelector("[data-reached]") !== null)).toEqual([true, true, false, false]);
    expect(steps.map((li) => li.querySelector('[data-reached="true"]') !== null)).toEqual([true, true, false, false]);
    expect(steps[2].getAttribute("aria-current")).toBe("step");
  });

  it("find, reading, consent and pay show the document or payment illustration", async () => {
    const art = (container: HTMLElement) => Array.from(container.querySelectorAll("svg[data-art]")).map((el) => [el.getAttribute("data-art"), el.getAttribute("aria-hidden"), el.querySelector("animate") === null]);
    let view = render(<AddCoverView />);
    await heading("Drop your policy PDF here.");
    expect(art(view.container)).toEqual([["doc", "true", true]]);
    cleanup();
    h.listUploads.mockResolvedValue({ consent: false, documents: [], largeUpload: false, policyType: null });
    view = render(<AddCoverView />);
    await heading("Can Knowvia read your policy?");
    expect(art(view.container)).toEqual([["doc", "true", true]]);
    cleanup();
    h.listUploads.mockResolvedValue({ consent: true, documents: [], largeUpload: false, policyType: null });
    h.slotsRead.mockResolvedValue(FULL);
    view = render(<AddCoverView />);
    await heading("Add another policy for Rs 199.");
    expect(art(view.container)).toEqual([["pay", "true", true]]);
    cleanup();
    h.slotsRead.mockResolvedValue(FREE);
    h.upload.mockImplementation((_file: File, _key: string, _kind: string, _type: string, onStage: (s: string) => void) => { onStage("checking"); return new Promise(() => undefined); });
    view = render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile();
    await heading(STAGE_COPY.checking.h1);
    expect(art(view.container)).toEqual([["doc", "true", true]]);
    cleanup();
    h.upload.mockResolvedValue({ documentId: "doc-1" });
    await toPeople();
    expect(Array.from(document.querySelectorAll("svg[data-art]")).map((el) => el.getAttribute("data-art"))).toEqual(["family"]);
  });

  it("reading shows the stage percent above the heading", async () => {
    h.upload.mockImplementation((_file: File, _key: string, _kind: string, _type: string, onStage: (s: string) => void) => { onStage("details"); return new Promise(() => undefined); });
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile();
    const title = await heading(STAGE_COPY.details.h1);
    const percent = screen.getByText(`${STAGE_COPY.details.percent}%`);
    expect(percent.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a password-protected PDF shows three numbered fix cards", async () => {
    h.upload.mockRejectedValue(new AdapterError("PDF_PROTECTED"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile("locked.pdf");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("One quick fix")).toBeInTheDocument();
    const cards = within(alert).getAllByRole("listitem");
    expect(cards.map((li) => li.textContent)).toEqual([
      "1Open the PDFType the password. It is often your date of birth or policy number.",
      "2Print, then Save as PDFThis makes a new copy with no lock.",
      "3Add the new copy hereKnowvia reads it straight away.",
    ]);
    expect(within(alert).queryByText("Open it, choose Print, then Save as PDF. Add the new copy.")).toBeNull();
  });

  it("a too-large PDF shows the page-picking fix cards", async () => {
    h.upload.mockRejectedValue(new AdapterError("FILE_TOO_LARGE"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile("big.pdf");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { level: 1, name: "That PDF is too big." })).toBeInTheDocument();
    expect(within(alert).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "1Open the PDFFind the schedule: who is covered, the sum insured and the dates.",
      "2Print only those pagesChoose Save as PDF as the printer.",
      "3Add the smaller copy hereKnowvia reads it straight away.",
    ]);
  });

  it("a guide without steps still shows its fix line", async () => {
    h.upload.mockRejectedValue(new AdapterError("FILE_TYPE_INVALID"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile("notes.txt");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("One quick fix")).toBeInTheDocument();
    expect(within(alert).getByText("Download the policy as a PDF from your insurer's email or app.")).toBeInTheDocument();
    expect(within(alert).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("the result screen shows the headline values that were read", async () => {
    h.holdings = [HEADLINE_HOLDING];
    await toCover();
    expect(screen.getByText("Added")).toBeInTheDocument();
    const facts = await screen.findByTestId("cover-facts");
    // Only values that were read or confirmed show: the premium is unknown, so it has no card.
    expect(within(facts).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Sum insuredRs 5,00,000", "Policy period1 Apr 2026 to 31 Mar 2027"]);
    expect(screen.getByRole("status").textContent).toBe("Your cover is saved.");
  });

  it("the result screen shows no cards when the read fails", async () => {
    h.holdings = [HEADLINE_HOLDING];
    h.holdingsFail = true;
    await toCover();
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.queryByTestId("cover-facts")).toBeNull();
    expect(screen.getByRole("link", { name: "Open my policy" }).getAttribute("href")).toBe("/policies/holding-1");
  });

  it("AppShell in bare mode has no rail, top bar or ask bar on /covers/add", async () => {
    const { container } = render(<AppShell pathname="/covers/add"><p data-testid="page-body">body</p></AppShell>);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(container.querySelector('[data-shell="bare"]')).not.toBeNull();
    expect(screen.getByTestId("page-body")).toBeInTheDocument();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Knowvia sections" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Search or jump to/ })).toBeNull();
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByTestId("agent-layer")).toBeNull();
    expect(screen.queryByRole("link", { name: "Skip to content" })).toBeNull();
    expect(screen.getByTestId("viewport-gate")).toBeInTheDocument();
  });

  it("AppShell keeps the rail on every other path", async () => {
    for (const path of ["/home", "/policies", "/covers/review"]) {
      const { container } = render(<AppShell pathname={path}><p>body</p></AppShell>);
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(container.querySelector('[data-shell="bare"]'), path).toBeNull();
      expect(screen.getByRole("navigation", { name: "Knowvia sections" }), path).toBeInTheDocument();
      expect(screen.getByRole("search", { name: "Ask about your cover" }), path).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Search or jump to/ }), path).toBeInTheDocument();
      cleanup();
    }
  });

  it("no screen renders an error code", async () => {
    const code = /\b[A-Z]{2,}(?:_[A-Z]{2,})+\b/;
    // A refused upload.
    h.upload.mockRejectedValueOnce(new AdapterError("PDF_TOO_LONG"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile();
    await heading("That PDF has too many pages.");
    expect(document.body.textContent).not.toMatch(code);
    cleanup();
    // A plan lookup that failed.
    h.candidates.mockRejectedValueOnce(new AdapterError("HOLDING_PRODUCT_UNSUPPORTED"));
    render(<AddCoverView />);
    await screen.findByTestId("schedule-input");
    chooseFile();
    await heading("Finding your plan.");
    expect(document.body.textContent).not.toMatch(code);
    cleanup();
    // A payment that stopped.
    h.slotsRead.mockResolvedValue(FULL);
    h.payDeps.open.mockRejectedValue(new AdapterError("PAYMENT_FAILED", undefined));
    render(<AddCoverView />);
    fireEvent.click(await screen.findByRole("button", { name: "Pay Rs 199" }));
    await screen.findByRole("alert");
    expect(document.body.textContent).not.toMatch(code);
    cleanup();
    // A failed first read.
    h.listUploads.mockRejectedValue(new AdapterError("BACKEND_UNREACHABLE"));
    render(<AddCoverView />);
    await screen.findByRole("alert");
    expect(document.body.textContent).not.toMatch(code);
  });
});
