import type { AccessAdapter, HouseholdAdapter } from "./types";
import { AdapterError } from "./types";
import { accessResultSchema, householdSchema, meSchema } from "./schemas";
import { fetchWithRetry } from "@/lib/retry-fetch";

// Browser-side clients for the same-origin BFF (/api/app/*). They never see the backend token.

async function call(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetchWithRetry(path, { ...init, cache: "no-store", headers: { "content-type": "application/json", "x-knowvia-app": "1", ...init?.headers } });
  } catch {
    throw new AdapterError("BACKEND_UNREACHABLE", true);
  }
}

export const backendAccess: AccessAdapter = {
  async submit(input) {
    const res = await call("/api/app/access", { method: "POST", body: JSON.stringify(input) });
    const body: unknown = await res.json().catch(() => ({}));
    const parsed = accessResultSchema.safeParse(body);
    if (!parsed.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
    return parsed.data;
  },
  async signOut() {
    await call("/api/app/signout", { method: "POST" });
  },
};

export const backendHousehold: HouseholdAdapter = {
  async me() {
    const res = await call("/api/app/me");
    if (res.status === 401) return null;
    if (!res.ok) throw new AdapterError("BACKEND_UNREACHABLE", true);
    return meSchema.parse(await res.json());
  },
  async household() {
    // Real pathway: the backend stores the owner only (more members via the members adapter). No mock people.
    const me = await this.me();
    if (!me) throw new AdapterError("UNAUTHENTICATED");
    return householdSchema.parse({
      id: me.householdId,
      displayName: me.householdName,
      members: [{ id: me.owner.id, name: me.owner.displayName, relation: "self", age: 0, invite: "joined" }],
    });
  },
};
