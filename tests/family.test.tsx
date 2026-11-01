// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach } from "vitest";
import { normaliseIndianMobile, validateAddMember, validateEditMember } from "@/components/family/logic";

vi.mock("@/components/shell", () => ({ FamilyOwner: () => <div data-testid="owner-card" /> }));

import { pressPageShortcut } from "@/lib/shortcuts";
import { FamilyView } from "@/components/family/FamilyView";

afterEach(cleanup);

describe("family logic", () => {
  it("normalises Indian mobiles", () => {
    expect(normaliseIndianMobile("98220 11223")).toBe("+91 98220 11223");
    expect(normaliseIndianMobile("+91-9822011223")).toBe("+91 98220 11223");
    expect(normaliseIndianMobile("12345")).toBeNull();
    expect(normaliseIndianMobile("5822011223")).toBeNull();
  });
  it("validates name and mobile", () => {
    expect(validateAddMember("", "x")).toEqual({ name: "Enter a name.", mobile: "Enter a 10-digit mobile number." });
    expect(validateAddMember("Priya Rao", "9822011223")).toEqual({});
  });
});

describe("edit member validation", () => {
  it("allows blank mobile and email, rejects bad ones", () => {
    expect(validateEditMember("Kabir", "", "")).toEqual({});
    expect(validateEditMember("K", "123", "nope")).toEqual({ name: "Enter a name.", mobile: "Enter a 10-digit mobile number.", email: "Enter a valid email address." });
    expect(validateEditMember("Kabir", "98220 11223", "a@b.co")).toEqual({});
  });
});

describe("FamilyView", () => {
  it("renders all section headings and switches person with a number key", () => {
    render(<FamilyView />);
    for (const h of ["People", "Family on Knowvia", "Policy by person", "Key dates", "Who sees what"]) {
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Father at a glance" })).toBeInTheDocument();
    act(() => pressPageShortcut("person-2"));
    expect(screen.getByRole("heading", { name: "Rohan at a glance" })).toBeInTheDocument();
    expect(screen.getByText("Put these dates on")).toBeInTheDocument();
  });
  it("add member: validates, goes to step 2, sends, closes on Esc", async () => {
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: "Add family member" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Priya Rao" } });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "98220 11223" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(/What happens next for Priya/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Sent just now on WhatsApp")).toBeInTheDocument();
  });
  it("Esc closes the sheet", () => {
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: "Add family member" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("person card opens the edit sheet, validates, saves and shows the new details", async () => {
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: /^Rohan, Spouse/ }));
    expect(screen.getByRole("dialog", { name: "Edit Rohan" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "98220 11223" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "rohan.new@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Rohan K" } });
    fireEvent.click(screen.getByRole("button", { name: "SMS" }));
    fireEvent.keyDown(screen.getByLabelText(/^Name/), { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /^Rohan K, Spouse/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Rohan K, Spouse/ }));
    expect((screen.getByLabelText(/^Mobile number/) as HTMLInputElement).value).toBe("98220 11223");
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe("rohan.new@example.com");
    expect(screen.getByRole("button", { name: "SMS" })).toHaveAttribute("aria-pressed", "true");
  });
  it("edit sheet: a failed save shows could not save and keeps the sheet; Esc closes", async () => {
    const { adapters } = await import("@/adapters");
    const spy = vi.spyOn(adapters.invite, "updateMember").mockRejectedValueOnce(new Error("x"));
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: /^Mother, Parent/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText(/Could not save/)).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    spy.mockRestore();
  });
});
