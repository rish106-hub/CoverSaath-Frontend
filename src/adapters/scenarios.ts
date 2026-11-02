import { z } from "zod";
import { AdapterError } from "./types";
import { fetchWithRetry } from "@/lib/retry-fetch";

// Browser clients for saved calculator inputs and household members. Same-origin BFF only (/api/app/*); they never see the
// backend token. Failures are AdapterError with a code and a retry hint; no values are put into errors.

export type ScenarioTool = "tax" | "premium_rise" | "hospital_bill" | "inflation" | "compare_weights" | "stress_levers" | "review_state";
export type ScenarioRecord = { inputs: Record<string, unknown> | null; revision: number };

export interface ScenarioAdapter {
  /** The saved inputs and their revision. `inputs` is null when nothing is saved yet. */
  load(tool: ScenarioTool): Promise<ScenarioRecord>;
  /** Replaces the saved inputs. `revision` is the one last seen; a newer one on the server throws REVISION_CONFLICT. */
  save(tool: ScenarioTool, inputs: Record<string, unknown>, revision: number | undefined): Promise<{ revision: number }>;
}

export type MemberRecord = { id: string; name: string; relation: string | null; ageYears: number | null; isOwner: boolean; isYou: boolean };
export interface MemberAdapter {
  list(): Promise<MemberRecord[]>;
  add(input: { name: string; relation: string }): Promise<MemberRecord>;
  update(id: string, input: { name?: string; relation?: string }): Promise<MemberRecord>;
  remove(id: string): Promise<void>;
}

const errorBody = z.object({ code: z.string() }).partial();
const scenarioEnvelope = z.object({ scenario: z.object({ inputs: z.record(z.string(), z.unknown()).nullable(), revision: z.number().int().nonnegative() }) });
const memberDto = z.object({
  id: z.string(), displayName: z.string(), relationshipLabel: z.string().nullable(), ageYears: z.number().nullable(), isOwner: z.boolean(), isYou: z.boolean(),
});
const toMember = (m: z.infer<typeof memberDto>): MemberRecord => ({ id: m.id, name: m.displayName, relation: m.relationshipLabel, ageYears: m.ageYears, isOwner: m.isOwner, isYou: m.isYou });

async function call(path: string, init?: RequestInit & { json?: unknown }): Promise<unknown> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetchWithRetry(path, {
      ...rest,
      body: json === undefined ? undefined : JSON.stringify(json),
      cache: "no-store",
      headers: { "content-type": "application/json", "x-knowvia-app": "1", ...rest.headers },
    });
  } catch {
    throw new AdapterError("BACKEND_UNREACHABLE", true);
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return body;
  const code = errorBody.safeParse(body);
  throw new AdapterError(res.status === 401 ? "UNAUTHENTICATED" : (code.success && code.data.code) || "BACKEND_UNREACHABLE", res.status >= 500 || res.status === 429 || res.status === 409);
}

function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return r.data;
}

export const backendScenarios: ScenarioAdapter = {
  async load(tool) {
    const d = parse(scenarioEnvelope, await call(`/api/app/scenarios?tool=${tool}`));
    return { inputs: d.scenario.inputs, revision: d.scenario.revision };
  },
  async save(tool, inputs, revision) {
    const headers: Record<string, string> = revision === undefined ? {} : { "if-match": String(revision) };
    const d = parse(scenarioEnvelope, await call(`/api/app/scenarios?tool=${tool}`, { method: "PUT", json: { inputs }, headers }));
    return { revision: d.scenario.revision };
  },
};

const listEnvelope = z.object({ members: z.array(memberDto) });
const oneEnvelope = z.object({ member: memberDto });

export const backendMembers: MemberAdapter = {
  async list() {
    return parse(listEnvelope, await call("/api/app/members")).members.map(toMember);
  },
  async add({ name, relation }) {
    const kind = /^(son|daughter|child)$/i.test(relation) ? "dependent" : "adult";
    const d = parse(oneEnvelope, await call("/api/app/members", { method: "POST", json: { displayName: name, memberKind: kind, relationshipLabel: relation } }));
    return toMember(d.member);
  },
  async update(id, { name, relation }) {
    const patch: Record<string, string> = {};
    if (name !== undefined) patch.displayName = name;
    if (relation !== undefined) patch.relationshipLabel = relation;
    return toMember(parse(oneEnvelope, await call(`/api/app/members?id=${encodeURIComponent(id)}`, { method: "PATCH", json: patch })).member);
  },
  async remove(id) {
    await call(`/api/app/members?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
