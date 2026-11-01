import type { AccessAdapter, HouseholdAdapter } from "./types";
import { AdapterError } from "./types";
import { accessResultSchema, householdSchema, meSchema } from "./schemas";
import { mockAdapters } from "./mock";

// Browser-side clients for the same-origin BFF (/api/app/*). They never see the backend token.

async function call(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, { ...init, cache: "no-store", headers: { "content-type": "application/json", "x-knowvia-app": "1", ...init?.headers } });
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
    // backend gap: only the owner is stored today; the rest of the household is mock.
    const [me, base] = await Promise.all([this.me(), mockAdapters.household.household()]);
    if (!me) return base;
    const members = base.members.map((m) => (m.relation === "self" ? { ...m, id: me.owner.id, name: me.owner.displayName } : m));
    return householdSchema.parse({ ...base, id: me.householdId, displayName: me.householdName, members });
  },
};
