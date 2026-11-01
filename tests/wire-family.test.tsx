// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/shell", () => ({ FamilyOwner: () => <div /> }));

import { adapters } from "@/adapters";
import { FamilyView } from "@/components/family/FamilyView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const rec = (over: Partial<{ id: string; name: string; relation: string | null; isYou: boolean; isOwner: boolean }> = {}) =>
  ({ id: "b1", name: "Rohan Rao", relation: "Spouse", ageYears: null, isOwner: false, isYou: false, ...over });

describe("family members are stored", () => {
  it("adding a member saves it once, even when the invite is retried", async () => {
    vi.spyOn(adapters.members, "list").mockResolvedValue([]);
    const add = vi.spyOn(adapters.members, "add").mockResolvedValue(rec({ id: "b9", name: "Priya Rao", relation: "Child" }));
    const invite = vi.spyOn(adapters.invite, "invite").mockRejectedValueOnce(new Error("down")).mockResolvedValue({ ok: true, state: "sent" });
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: "Add family member" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Priya Rao" } });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "98220 11223" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await screen.findByText("Could not add them. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith({ name: "Priya Rao", relation: "Father" });
    expect(invite).toHaveBeenCalledTimes(2);
  });

  it("editing a person updates the linked stored member; a failure shows Retry and keeps the sheet", async () => {
    vi.spyOn(adapters.members, "list").mockResolvedValue([rec()]);
    const update = vi.spyOn(adapters.members, "update").mockRejectedValueOnce(new Error("down")).mockResolvedValue(rec({ name: "Rohan K" }));
    render(<FamilyView />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Rohan Rao, Spouse/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Rohan Rao, Spouse/ }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Rohan K" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/Could not save/);
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Rohan K");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(update).toHaveBeenLastCalledWith("b1", { name: "Rohan K", relation: "Spouse" });
  });

  it("a person with no stored member is added on first save", async () => {
    vi.spyOn(adapters.members, "list").mockResolvedValue([]);
    const add = vi.spyOn(adapters.members, "add").mockResolvedValue(rec({ id: "b2", name: "Kabir R" }));
    render(<FamilyView />);
    fireEvent.click(screen.getByRole("button", { name: /^Kabir, Son/ }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Kabir R" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(add).toHaveBeenCalledWith({ name: "Kabir R", relation: "Son" });
  });
});
