import type { AccessAdapter, HouseholdAdapter } from "./types";
import { AdapterError } from "./types";
import { accessResultSchema, householdSchema, meSchema } from "./schemas";
import { fetchWithRetry } from "@/lib/retry-fetch";
import { backendMembers, type MemberRecord } from "./scenarios";

const RELATIONS = { spouse: "spouse", wife: "spouse", husband: "spouse", partner: "spouse", son: "child", daughter: "child", child: "child", mother: "mother", father: "father" } as const;
const relationOf = (label: string | null) => RELATIONS[(label ?? "").trim().toLowerCase() as keyof typeof RELATIONS] ?? ("other" as const);

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
    // Real mode: only what the backend returns. The owner comes from /me, the rest from the stored members; nothing is borrowed from the mock family.
    const [me, stored] = await Promise.all([this.me(), backendMembers.list().catch(() => [] as MemberRecord[])]);
    if (!me) return householdSchema.parse({ id: "", displayName: "Your household", members: [] });
    const owner = { id: me.owner.id, name: me.owner.displayName, relation: "self" as const, age: 0, invite: "joined" as const };
    const others = stored
      .filter((m) => !m.isOwner && !m.isYou && m.id !== owner.id)
      .map((m) => ({ id: m.id, name: m.name, relation: relationOf(m.relation), age: m.ageYears ?? 0, invite: "none" as const }));
    return householdSchema.parse({ id: me.householdId, displayName: me.householdName, members: [owner, ...others] });
  },
};
