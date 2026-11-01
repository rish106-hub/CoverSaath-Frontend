import type { MemberAdapter, MemberRecord, ScenarioAdapter, ScenarioRecord } from "../scenarios";
import { AdapterError } from "../types";
import { delay } from "./delay";

// In-memory stand-ins with the same revision rules as the backend, so tests and mock mode behave alike.

const saved = new Map<string, ScenarioRecord>();

export const mockScenarios: ScenarioAdapter = {
  load: (tool) => delay(structuredClone(saved.get(tool) ?? { inputs: null, revision: 0 })),
  save: async (tool, inputs, revision) => {
    const cur = saved.get(tool) ?? { inputs: null, revision: 0 };
    if (revision !== undefined && revision !== cur.revision) throw new AdapterError("REVISION_CONFLICT", true);
    const next = { inputs: structuredClone(inputs), revision: cur.revision + 1 };
    saved.set(tool, next);
    return delay({ revision: next.revision });
  },
};

let n = 0;
const rows = new Map<string, MemberRecord>();
export const mockMembers: MemberAdapter = {
  list: () => delay([...rows.values()]),
  add: async ({ name, relation }) => {
    const m: MemberRecord = { id: `mock-member-${++n}`, name, relation, ageYears: null, isOwner: false, isYou: false };
    rows.set(m.id, m);
    return delay(m);
  },
  update: async (id, { name, relation }) => {
    const cur = rows.get(id);
    if (!cur) throw new AdapterError("NOT_FOUND");
    const m = { ...cur, ...(name !== undefined ? { name } : {}), ...(relation !== undefined ? { relation } : {}) };
    rows.set(id, m);
    return delay(m);
  },
  remove: async (id) => {
    rows.delete(id);
  },
};
