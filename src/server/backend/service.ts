import "server-only";
import { z } from "zod";
import { AppError } from "./errors";
import type { BackendClient } from "./client";
import type { SessionPayload } from "./session";
import { DEMO_NAME, checkDemoLogin, demoMe as demoMeView, demoSession, isDemoEmail } from "./demo";

export const accessInput = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), password: z.string().max(200).optional() });

/** Create account in the backend. Returns the session payload to seal and the first name for the greeting. */
export async function grantAccess(client: BackendClient, raw: unknown): Promise<{ session: SessionPayload; firstName: string }> {
  const parsed = accessInput.safeParse(raw);
  if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
  // The demo email is reserved: it signs in with its password or not at all, and never creates a real household.
  if (isDemoEmail(parsed.data.email)) {
    if (!checkDemoLogin(parsed.data.email, parsed.data.password)) throw new AppError(401, "INVALID_CREDENTIALS");
    return { session: demoSession(), firstName: DEMO_NAME.split(" ")[0] };
  }
  const created = await client.createHousehold({ name: parsed.data.name, email: parsed.data.email });
  const exp = Math.min(Date.parse(created.expiresAt) || Date.now() + 86_400_000, Date.now() + 7 * 86_400_000);
  return { session: { t: created.token, h: created.householdId, m: created.ownerMemberId, a: created.adultUserId, exp }, firstName: parsed.data.name.split(" ")[0] };
}

export type MeView = { householdId: string; householdName: string; owner: { id: string; displayName: string; email?: string }; source: "backend" | "mock" };

/** Who is signed in, read back from the backend (not from what the form sent). */
export async function readMe(client: BackendClient, session: SessionPayload): Promise<MeView> {
  if (session.demo) return demoMeView();
  const v = await client.household(session.t, session.h);
  const owner = v.members.find((m) => m.id === session.m) ?? v.members[0];
  if (!owner) throw new AppError(502, "BACKEND_BAD_RESPONSE");
  return { householdId: v.household.id, householdName: v.household.display_name ?? "Your household", owner: { id: owner.id, displayName: owner.displayName }, source: "backend" };
}

export async function readStatus(client: BackendClient): Promise<{ health: boolean; ready: boolean }> {
  const [health, ready] = await Promise.all([client.health().catch(() => false), client.ready().catch(() => false)]);
  return { health, ready };
}
