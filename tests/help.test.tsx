// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { z } from "zod";
import { adapters } from "@/adapters";
import * as S from "@/adapters/schemas";
import { ALL_COMBOS } from "@/components/help/shortcutTable";
import { HELP_PAGE_CONTEXTS } from "@/components/help/pageContexts";
import { DeskView } from "@/components/help/DeskView";
import { EmergencyView } from "@/components/help/EmergencyView";
import { AssistantView } from "@/components/help/AssistantView";
import { ShortcutsView } from "@/components/help/ShortcutsView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/" }));

const BANNED = /sample|demo|preview|draft|placeholder|lorem|not advice|not an insurer|CoverSaath|Saath|ask_policy|explain_term|add_document|claim_help/i;

describe("help adapters", () => {
  it("desk board, ranked hospitals and blood are schema-valid", async () => {
    z.array(S.deskBoardCaseSchema).parse(await adapters.desk.board());
    for (const mode of ["cashless", "best"] as const) z.array(S.rankedHospitalSchema).parse(await adapters.hospital.ranked("chest", mode));
    z.array(S.bloodBankSchema).parse(await adapters.blood.banks("B+"));
    expect(Object.keys(await adapters.blood.groups())).toHaveLength(8);
  });
  it("blood bank units add up to the group stock", async () => {
    const banks = await adapters.blood.banks("O+");
    expect(banks.reduce((n, b) => n + b.units, 0)).toBe((await adapters.blood.groups())["O+"]);
  });
});

describe("help data", () => {
  it("shortcut table has no collisions", () => {
    expect(new Set(ALL_COMBOS).size).toBe(ALL_COMBOS.length);
  });
  it("every page context has three examples", () => {
    for (const c of Object.values(HELP_PAGE_CONTEXTS)) expect(c.examples).toHaveLength(3);
  });
});

describe("help views", () => {
  it("desk: J moves the selected case, signing clears the ask", async () => {
    render(<DeskView />);
    await screen.findByText("Short-settled claim", { selector: "h3" });
    fireEvent.keyDown(window, { key: "j" });
    await screen.findByText("Duplicate premium", { selector: "h3" });
    fireEvent.click(screen.getByRole("button", { name: "Sign" }));
    expect(screen.getByText("Signed ✓")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(BANNED);
    cleanup();
  });
  it("emergency: real tel links, person switch, desk checklist", async () => {
    const { container } = render(<EmergencyView />);
    expect(container.querySelector('a[href="tel:112"]')).toBeTruthy();
    expect(container.querySelector('a[href="tel:108"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kabir" }));
    expect(screen.getByText(/Kabir needs care/)).toBeTruthy();
    const box = screen.getAllByRole("checkbox")[1];
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(screen.getAllByText(/units B\+/).length).toBeGreaterThan(0));
    expect(document.body.textContent).not.toMatch(BANNED);
    cleanup();
  });
  it("assistant: try-saying chip updates the reply and asks the global card", () => {
    const seen: string[] = [];
    const h = (e: Event) => seen.push((e as CustomEvent).detail.text);
    window.addEventListener("knowvia:ask", h);
    render(<AssistantView />);
    fireEvent.click(screen.getByRole("button", { name: "How much tax can I save this year?" }));
    expect(screen.getByText(/Rs 75,000/)).toBeTruthy();
    expect(seen).toEqual(["How much tax can I save this year?"]);
    expect(document.body.textContent).not.toMatch(BANNED);
    window.removeEventListener("knowvia:ask", h);
    cleanup();
  });
  it("shortcuts: renders the full key map", () => {
    render(<ShortcutsView />);
    expect(screen.getByText("Hold to speak")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(BANNED);
    cleanup();
  });
});
