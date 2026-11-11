import { afterEach, describe, expect, it, vi } from "vitest";
import { backendEvidence } from "@/adapters/evidence";
import { mockEvidence } from "@/adapters/mock/evidence";
import { mockAdapters } from "@/adapters/mock";
import { realAdapters } from "@/adapters/real";

afterEach(() => vi.unstubAllGlobals());

const stub = (status: number, body: unknown) => {
  const seen: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  });
  return seen;
};

describe("evidence adapters", () => {
  it("the real adapter calls only the same-origin BFF, marks writes and sends the key", async () => {
    const seen = stub(200, { ok: true, data: { version: 1 } });
    const out = await backendEvidence.confirmPolicyProfile("doc-1", { expectedVersion: 0 }, "profile-key-12345678");
    expect(out).toEqual({ version: 1 });
    expect(seen[0]?.url).toBe("/api/app/documents/doc-1/policy-profile/confirm");
    const h = seen[0]?.init.headers as Record<string, string>;
    expect(h["x-knowvia-app"]).toBe("1");
    expect(h["idempotency-key"]).toBe("profile-key-12345678");
  });
  it("turns a coded failure into an AdapterError and an unreadable body into BACKEND_BAD_RESPONSE", async () => {
    stub(409, { ok: false, code: "POLICY_PROFILE_NOT_READY", retryable: true });
    await expect(backendEvidence.policyProfile("doc-1")).rejects.toMatchObject({ code: "POLICY_PROFILE_NOT_READY", retryable: true });
    stub(200, { ok: true, data: "text" });
    await expect(backendEvidence.policyProfile("doc-1")).rejects.toMatchObject({ code: "BACKEND_BAD_RESPONSE" });
  });
  it("every ported route has a real and a mock method", () => {
    const names = Object.keys(realAdapters.evidence).sort();
    expect(names).toEqual(Object.keys(mockEvidence).sort());
    expect(names).toEqual(["answer", "ask", "confirmPolicyProfile", "deletionInventory", "designateConfirmer", "handoff", "integrations", "policyProfile", "preview", "review", "sourcePack"]);
    expect(mockAdapters.evidence).toBe(mockEvidence);
  });
  it("the mock answers are never verified", async () => {
    const a = await mockEvidence.ask("case-1", { question: "Q?" }, "k-12345678");
    expect(a.state).toBe("extracted_unverified");
  });
});
