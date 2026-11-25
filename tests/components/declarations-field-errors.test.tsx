// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/covers/declarations" }));
vi.mock("@/adapters", async () => {
  const { mockCovers } = await import("@/adapters/mock/covers");
  const { mockMembers } = await import("@/adapters/mock/scenarios");
  return { adapters: { covers: mockCovers, members: mockMembers } };
});
vi.hoisted(() => { process.env.NEXT_PUBLIC_ADAPTERS = "mock"; });

import { DeclarationsView } from "@/components/covers/DeclarationsView";
import { mockCovers } from "@/adapters/mock/covers";
import { mockMembers } from "@/adapters/mock/scenarios";
import { AdapterError } from "@/adapters/types";

// The mock household starts empty, so give the page one person and one holding to submit against.
function seedHousehold() {
  vi.spyOn(mockMembers, "list").mockResolvedValue([{ id: "m1", name: "Asha", relation: "self", ageYears: 40, isOwner: true, isYou: true }]);
  vi.spyOn(mockCovers, "holdings").mockResolvedValue([{ id: "h1" } as never]);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("declarations and money field errors", () => {
  it("shows a premium error beside the premium form and wires it to the amount field", async () => {
    seedHousehold();
    render(<DeclarationsView />);
    const amount = await screen.findByLabelText("Amount in rupees");
    // Wait for holdings so the form is submittable.
    await waitFor(() => expect(screen.queryByText("Add a policy first.")).toBeNull());
    fireEvent.change(amount, { target: { value: "abc" } });
    fireEvent.submit(amount.closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("id", "premium-error");
    expect(alert.closest("form")).toBe(amount.closest("form"));
    expect(amount).toHaveAttribute("aria-invalid", "true");
    const ref = amount.getAttribute("aria-describedby")!;
    expect(document.getElementById(ref)).toHaveTextContent(alert.textContent!);
    expect(screen.getByLabelText("Paid on")).toHaveAttribute("aria-describedby", "premium-error");
    expect(screen.getByLabelText("Paid on")).not.toHaveAttribute("aria-invalid");
  });

  it("keeps a declaration error inside the declaration form, not the premium form", async () => {
    vi.spyOn(mockCovers, "addDeclaration").mockRejectedValue(new AdapterError("BACKEND_UNREACHABLE"));
    seedHousehold();
    render(<DeclarationsView />);
    const details = await screen.findByLabelText("Details");
    await waitFor(() => expect((screen.getByLabelText("Person") as HTMLSelectElement).value).not.toBe(""));
    fireEvent.change(details, { target: { value: "Asthma" } });
    fireEvent.submit(details.closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("id", "decl-error");
    expect(alert.closest("form")).toBe(details.closest("form"));
    expect(details).toHaveAttribute("aria-describedby", "decl-error");
    expect(document.getElementById("premium-error")).toBeNull();
  });
});
