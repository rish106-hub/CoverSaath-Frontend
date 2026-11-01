// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { backendMembers, backendScenarios, type ScenarioAdapter } from "@/adapters/scenarios";
import { mockScenarios } from "@/adapters/mock/scenarios";
import { AdapterError } from "@/adapters/types";
import { useScenario } from "@/lib/use-scenario";
import { taxCodec, type TaxState } from "@/lib/scenario-codecs";
import { SaveState } from "@/components/ui/SaveState";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("browser adapters call the BFF", () => {
  it("scenario load and save carry the revision and the app marker", async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "PUT" ? json(200, { ok: true, scenario: { tool: "tax", inputs: { regime: "new" }, revision: 4 } }) : json(200, { ok: true, scenario: { tool: "tax", inputs: null, revision: 3 } }));
    vi.stubGlobal("fetch", f);
    expect(await backendScenarios.load("tax")).toEqual({ inputs: null, revision: 3 });
    expect(await backendScenarios.save("tax", { regime: "new" }, 3)).toEqual({ revision: 4 });
    const [url, init] = f.mock.calls[1]!;
    expect(url).toBe("/api/app/scenarios?tool=tax");
    expect((init!.headers as Record<string, string>)["if-match"]).toBe("3");
    expect((init!.headers as Record<string, string>)["x-knowvia-app"]).toBe("1");
    expect(init!.body).toBe(JSON.stringify({ inputs: { regime: "new" } }));
  });

  it("unauthenticated, conflict and network failures are coded AdapterErrors", async () => {
    vi.stubGlobal("fetch", async () => json(401, { ok: false, code: "UNAUTHENTICATED", retryable: false }));
    await expect(backendScenarios.load("tax")).rejects.toMatchObject({ code: "UNAUTHENTICATED", retryable: false });
    vi.stubGlobal("fetch", async () => json(409, { ok: false, code: "REVISION_CONFLICT", retryable: true }));
    await expect(backendScenarios.save("tax", {}, 1)).rejects.toMatchObject({ code: "REVISION_CONFLICT", retryable: true });
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    await expect(backendScenarios.load("tax")).rejects.toMatchObject({ code: "BACKEND_UNREACHABLE", retryable: true });
    vi.stubGlobal("fetch", async () => json(200, { nonsense: true }));
    await expect(backendScenarios.load("tax")).rejects.toMatchObject({ code: "BACKEND_BAD_RESPONSE" });
  });

  it("members add and edit round trip", async () => {
    const dto = { id: "m2", displayName: "Priya Rao", relationshipLabel: "Child", ageYears: null, isOwner: false, isYou: false };
    const f = vi.fn(async (_u: string, init?: RequestInit) =>
      json(init?.method === "POST" ? 201 : 200, { ok: true, member: init?.method === "PATCH" ? { ...dto, displayName: "Priya K" } : dto }));
    vi.stubGlobal("fetch", f);
    const added = await backendMembers.add({ name: "Priya Rao", relation: "Child" });
    expect(added).toMatchObject({ id: "m2", name: "Priya Rao", relation: "Child" });
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toEqual({ displayName: "Priya Rao", memberKind: "dependent", relationshipLabel: "Child" });
    expect(await backendMembers.update("m2", { name: "Priya K" })).toMatchObject({ name: "Priya K" });
    expect(f.mock.calls[1]![0]).toBe("/api/app/members?id=m2");
    expect(JSON.parse(f.mock.calls[1]![1]!.body as string)).toEqual({ displayName: "Priya K" });
  });
});

/** A screen with one tax-like input, a hook and the save state. */
function Harness({ adapter, delayMs = 600 }: { adapter: ScenarioAdapter; delayMs?: number }) {
  const [value, setValue] = useState<TaxState>({ regime: "old", self: 6200, par: 38400, senior: true });
  const self = value.self;
  const setSelf = (n: number) => setValue((c) => ({ ...c, self: n }));
  const { status, retry } = useScenario<TaxState>({
    tool: "tax", value, codec: taxCodec, adapter, delayMs,
    apply: (p) => setValue((c) => ({ ...c, ...p })),
  });
  return (
    <>
      <input aria-label="Self" type="number" value={self} onChange={(e) => setSelf(Number(e.target.value))} />
      <SaveState status={status} onRetry={retry} />
    </>
  );
}
const adapterOf = (over: Partial<ScenarioAdapter> = {}) => {
  const load = vi.fn(async () => ({ inputs: null as Record<string, unknown> | null, revision: 0 }));
  const save = vi.fn(async (_t: string, _i: Record<string, unknown>, rev: number | undefined) => ({ revision: (rev ?? 0) + 1 }));
  const adapter = { load, save, ...over } as ScenarioAdapter;
  return { adapter, load: adapter.load as ReturnType<typeof vi.fn>, save: adapter.save as ReturnType<typeof vi.fn> };
};
const settle = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

describe("useScenario", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("restores the saved values on mount and does not save them back", async () => {
    const a = adapterOf({ load: vi.fn(async () => ({ inputs: taxCodec.encode({ regime: "new", self: 9000, par: 1, senior: false }), revision: 5 })) });
    render(<Harness adapter={a.adapter} />);
    await settle();
    expect(screen.getByLabelText("Self")).toHaveValue(9000);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(a.save).not.toHaveBeenCalled();
  });

  it("sends one request for rapid changes, 600 ms after the last, with the revision", async () => {
    const a = adapterOf({ load: vi.fn(async () => ({ inputs: null, revision: 2 })) });
    render(<Harness adapter={a.adapter} />);
    await settle();
    for (const v of ["7", "70", "700", "7000"]) {
      fireEvent.change(screen.getByLabelText("Self"), { target: { value: v } });
      await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    }
    expect(a.save).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(a.save).toHaveBeenCalledTimes(1);
    expect(a.save.mock.calls[0]![1]).toMatchObject({ premiumsPaid: 7000 });
    expect(a.save.mock.calls[0]![2]).toBe(2);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("a failed save keeps the value, shows Retry, and retry saves it", async () => {
    let fail = true;
    const a = adapterOf({ save: vi.fn(async (_t, _i, rev) => { if (fail) throw new AdapterError("BACKEND_UNREACHABLE", true); return { revision: (rev ?? 0) + 1 }; }) });
    render(<Harness adapter={a.adapter} />);
    await settle();
    fireEvent.change(screen.getByLabelText("Self"), { target: { value: "8100" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(screen.getByText(/Could not save/)).toBeInTheDocument();
    expect(screen.getByLabelText("Self")).toHaveValue(8100);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await settle();
    expect(a.save).toHaveBeenCalledTimes(2);
    expect(a.save.mock.calls[1]![1]).toMatchObject({ premiumsPaid: 8100 });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Self")).toHaveValue(8100);
  });

  it("a revision conflict reloads the revision and sends the newest values once more", async () => {
    let first = true;
    const a = adapterOf({
      load: vi.fn(async () => ({ inputs: null, revision: first ? 1 : 9 })),
      save: vi.fn(async (_t, _i, rev) => {
        if (rev === 1) throw new AdapterError("REVISION_CONFLICT", true);
        return { revision: (rev ?? 0) + 1 };
      }),
    });
    render(<Harness adapter={a.adapter} />);
    await settle();
    first = false;
    fireEvent.change(screen.getByLabelText("Self"), { target: { value: "5555" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(a.save.mock.calls.map((c) => c[2])).toEqual([1, 9]);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("a change made while a save is in flight is saved afterwards, one request at a time", async () => {
    let release: () => void = () => undefined;
    let running = 0, peak = 0;
    const a = adapterOf({
      save: vi.fn(async (_t, _i, rev) => {
        running++; peak = Math.max(peak, running);
        await new Promise<void>((r) => { release = r; });
        running--;
        return { revision: (rev ?? 0) + 1 };
      }),
    });
    render(<Harness adapter={a.adapter} />);
    await settle();
    fireEvent.change(screen.getByLabelText("Self"), { target: { value: "1111" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    fireEvent.change(screen.getByLabelText("Self"), { target: { value: "2222" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(a.save).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(700); });
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(10); });
    expect(a.save).toHaveBeenCalledTimes(2);
    expect(a.save.mock.calls[1]![1]).toMatchObject({ premiumsPaid: 2222 });
    expect(peak).toBe(1);
  });

  it("leaving the page sends a pending change", async () => {
    const a = adapterOf();
    const { unmount } = render(<Harness adapter={a.adapter} />);
    await settle();
    fireEvent.change(screen.getByLabelText("Self"), { target: { value: "4321" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    unmount();
    await settle();
    expect(a.save).toHaveBeenCalledTimes(1);
    expect(a.save.mock.calls[0]![1]).toMatchObject({ premiumsPaid: 4321 });
  });

  it("works against the in-memory adapter and a first save starts at revision 0", async () => {
    const { result } = renderHook(() => {
      const [v, setV] = useState<TaxState>({ regime: "old", self: 1, par: 2, senior: false });
      return { v, setV, ...useScenario<TaxState>({ tool: "tax", value: v, codec: taxCodec, adapter: mockScenarios, apply: (p) => setV((c) => ({ ...c, ...p })) }) };
    });
    await settle();
    act(() => result.current.setV((c) => ({ ...c, regime: "new" })));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(result.current.status).toBe("saved");
    const read = mockScenarios.load("tax");
    await vi.advanceTimersByTimeAsync(5);
    expect((await read).inputs).toMatchObject({ regime: "new" });
  });
});
