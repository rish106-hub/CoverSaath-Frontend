import { afterEach, describe, expect, it, vi } from "vitest";
import { backendCovers } from "@/adapters/covers";
import { mockCovers } from "@/adapters/mock/covers";
import { mockAdapters } from "@/adapters/mock";
import { realAdapters } from "@/adapters/real";
import { containsUin } from "@/adapters/covers-contract";

afterEach(() => vi.unstubAllGlobals());

const pdf = (size = 64, name = "policy.pdf") => new File([new Uint8Array(size)], name, { type: "application/pdf" });

describe("real covers adapter", () => {
  it("calls only the same-origin BFF, marks writes and sends the key", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(JSON.stringify({ ok: true, data: { holdingId: "h1", status: "product_reported", profileVersion: 1, replay: false } }), { status: 200 });
    });
    await backendCovers.confirmProduct("h1", { candidateId: "p1", expectedVersion: 0 }, "confirm-key-12345678");
    expect(seen[0]?.url).toBe("/api/app/covers/holdings/h1/confirm");
    const h = seen[0]?.init.headers as Record<string, string>;
    expect(h["x-knowvia-app"]).toBe("1");
    expect(h["idempotency-key"]).toBe("confirm-key-12345678");
  });
  it("turns a coded failure into an AdapterError and a body outside the contract into BACKEND_BAD_RESPONSE", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, code: "NOT_AVAILABLE", retryable: false }), { status: 501 }));
    await expect(backendCovers.declarations()).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, code: "HOLDINGS_DISABLED", retryable: false }), { status: 503 }));
    await expect(backendCovers.premiumDues()).rejects.toMatchObject({ code: "HOLDINGS_DISABLED", retryable: true });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: true, data: { facts: "nope" } }), { status: 200 }));
    await expect(backendCovers.facts("h1")).rejects.toMatchObject({ code: "BACKEND_BAD_RESPONSE" });
  });
  it("refuses a file over 4 MB before any call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(backendCovers.upload(pdf(4 * 1024 * 1024 + 1), "k")).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("mock covers adapter", () => {
  it("is wired into both adapter sets", () => {
    expect(mockAdapters.covers).toBe(mockCovers);
    expect(realAdapters.covers).toBe(backendCovers);
  });
  it("refuses a non-PDF, an empty file and one over 4 MB with coded errors", async () => {
    await expect(mockCovers.upload(new File(["x"], "a.txt", { type: "text/plain" }), "k")).rejects.toMatchObject({ code: "FILE_TYPE_INVALID" });
    await expect(mockCovers.upload(pdf(0), "k")).rejects.toMatchObject({ code: "FILE_EMPTY" });
    await expect(mockCovers.upload(pdf(4 * 1024 * 1024 + 1), "k")).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });
  it("runs upload, candidates, confirm, facts, conflict resolve, and no body holds a UIN", async () => {
    const { holdingId } = await mockCovers.upload(pdf(), "k");
    const c = await mockCovers.candidates(holdingId as string);
    expect(c.candidates.length).toBeLessThanOrEqual(3);
    expect(Object.keys(c.candidates[0] ?? {}).sort()).toEqual(["candidateId", "insurerName", "productName", "rank"]);
    const first = c.candidates[0]!;
    await expect(mockCovers.confirmProduct(holdingId as string, { candidateId: first.candidateId, expectedVersion: 9 }, "ck-1234567890")).rejects.toMatchObject({ code: "POLICY_PROFILE_VERSION_CONFLICT" });
    const done = await mockCovers.confirmProduct(holdingId as string, { candidateId: first.candidateId, expectedVersion: c.profileVersion }, "ck-1234567890");
    expect(done.status).toBe("conflicts");
    expect((await mockCovers.confirmProduct(holdingId as string, { candidateId: first.candidateId, expectedVersion: c.profileVersion }, "ck-1234567890")).replay).toBe(true);
    const facts = await mockCovers.facts(holdingId as string);
    const conflicts = await mockCovers.conflicts(holdingId as string);
    expect(containsUin(facts) || containsUin(conflicts) || containsUin(c)).toBe(false);
    expect(facts.facts.some((f) => f.status === "conflicting")).toBe(true);
    const cf = conflicts.conflicts[0]!;
    expect(cf.candidates).toHaveLength(2);
    const r = await mockCovers.resolveConflict(holdingId as string, cf.id, { chosenFactId: cf.candidates[1]!.id });
    expect(r.holdingStatus).toBe("ready");
    await expect(mockCovers.resolveConflict(holdingId as string, cf.id, { chosenFactId: cf.candidates[1]!.id })).rejects.toMatchObject({ code: "CONFLICT_ALREADY_RESOLVED" });
    expect((await mockCovers.facts(holdingId as string)).facts.every((f) => f.status !== "conflicting")).toBe(true);
  });
  it("real adapter sends the new verbs to same-origin paths only", async () => {
    const seen: { url: string; method?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen.push({ url, method: init.method });
      const body = url.includes("premium-dues/") ? { id: "d", holdingId: "h", dueOn: "2026-12-01", amountPaise: 1, state: "paid" } : { deleted: true };
      return new Response(JSON.stringify({ ok: true, data: body }), { status: 200 });
    });
    await backendCovers.deleteDeclaration("d1");
    await backendCovers.deletePremium("p1");
    await backendCovers.payPremiumDue("d1", { paymentId: "p1" });
    expect(seen).toEqual([
      { url: "/api/app/covers/declarations/d1", method: "DELETE" },
      { url: "/api/app/covers/premiums/p1", method: "DELETE" },
      { url: "/api/app/covers/premium-dues/d1/pay", method: "POST" },
    ]);
  });
  it("mock covers edit, delete, dues and pay match the backend rules", async () => {
    const d = await mockCovers.addDeclaration({ memberId: "m9", kind: "habit", label: "Example" });
    await expect(mockCovers.updateDeclaration(d.id, { label: "Changed", ifMatch: 99 })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    const upd = await mockCovers.updateDeclaration(d.id, { label: "Changed", ifMatch: d.revision ?? 0 });
    expect([upd.label, upd.revision]).toEqual(["Changed", 2]);
    expect((await mockCovers.declarations("m9")).map((x) => x.id)).toEqual([d.id]);
    await mockCovers.deleteDeclaration(d.id);
    await expect(mockCovers.deleteDeclaration(d.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const pay = await mockCovers.addPremium({ holdingId: "h7", amountPaise: 500, paidOn: "2026-10-01" });
    const due = await mockCovers.addPremiumDue({ holdingId: "h7", dueOn: "2026-12-01", amountPaise: 500 });
    expect((await mockCovers.addPremiumDue({ holdingId: "h7", dueOn: "2026-12-01", amountPaise: 500 })).id).toBe(due.id);
    await expect(mockCovers.payPremiumDue(due.id, { paymentId: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await mockCovers.payPremiumDue(due.id, { paymentId: pay.id })).state).toBe("paid");
    expect(await mockCovers.premiumDues({ holdingId: "h7", state: "expected" })).toEqual([]);
    await mockCovers.deletePremium(pay.id);
    expect(await mockCovers.premiums("h7")).toEqual([]);
  });
  it("stores declarations and premiums in memory", async () => {
    const d = await mockCovers.addDeclaration({ memberId: "m1", kind: "habit", label: "Example habit" });
    expect((await mockCovers.declarations()).some((x) => x.id === d.id)).toBe(true);
    const p = await mockCovers.addPremium({ holdingId: "h1", amountPaise: 100, paidOn: "2026-10-01" });
    expect(p.channel).toBe("unknown");
    expect((await mockCovers.premiums()).some((x) => x.id === p.id)).toBe(true);
  });
});
