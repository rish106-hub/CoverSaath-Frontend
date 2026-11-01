import "server-only";
import { z } from "zod";
import { DataError, type Send } from "./data-http";
import type { SessionPayload } from "./session";

// Household member routes (backend plan B-A). The backend stores display name, kind, relationship label and date of birth. Phone,
// e-mail and invite channel have no backend field yet and are not sent.

const text = (max: number) => z.string().trim().min(1).max(max);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const addMemberInput = z.strictObject({
  displayName: text(80), memberKind: z.enum(["adult", "dependent"]), relationshipLabel: text(40).optional(), dateOfBirth: day.optional(),
});
export const updateMemberInput = z.strictObject({ displayName: text(80), relationshipLabel: text(40).nullable(), dateOfBirth: day.nullable() }).partial()
  .refine((o) => Object.keys(o).length > 0);
const memberId = z.string().regex(/^[A-Za-z0-9_.:-]{1,100}$/);

const stored = z.object({
  id: z.string(), displayName: z.string(), memberKind: z.string().nullish(), relationshipLabel: z.string().nullish(),
  ageYears: z.number().nullish(), isOwner: z.boolean().optional(), isYou: z.boolean().optional(),
}).loose();
export type MemberView = { id: string; displayName: string; memberKind: string | null; relationshipLabel: string | null; ageYears: number | null; isOwner: boolean; isYou: boolean };
const view = (m: z.infer<typeof stored>): MemberView => ({
  id: m.id, displayName: m.displayName, memberKind: m.memberKind ?? null, relationshipLabel: m.relationshipLabel ?? null,
  ageYears: m.ageYears ?? null, isOwner: m.isOwner === true, isYou: m.isYou === true,
});

function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new DataError(502, "BACKEND_BAD_RESPONSE");
  return r.data;
}
function input<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new DataError(400, "INVALID_INPUT");
  return r.data;
}

const base = (s: SessionPayload) => `/api/v1/households/${encodeURIComponent(s.h)}/members`;

export function memberService(send: Send, session: SessionPayload) {
  return {
    async list(): Promise<MemberView[]> {
      return parse(z.object({ members: z.array(stored) }).loose(), await send("GET", base(session), { token: session.t })).members.map(view);
    },
    async add(body: unknown): Promise<MemberView> {
      const b = input(addMemberInput, body);
      return view(parse(stored, await send("POST", base(session), { token: session.t, json: b })));
    },
    async update(id: unknown, body: unknown): Promise<MemberView> {
      const m = input(memberId, id);
      const b = input(updateMemberInput, body);
      return view(parse(stored, await send("PATCH", `${base(session)}/${encodeURIComponent(m)}`, { token: session.t, json: b })));
    },
    async remove(id: unknown): Promise<void> {
      const m = input(memberId, id);
      await send("DELETE", `${base(session)}/${encodeURIComponent(m)}`, { token: session.t });
    },
  };
}
