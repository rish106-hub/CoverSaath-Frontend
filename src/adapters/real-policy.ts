import type { ConflictView, FactView, HoldingStatus, HoldingView, ResolvedStatus } from "./covers-contract";
import type { Finding, Policy } from "./schemas";
import { AdapterError, type PolicyAdapter, type ReadingAdapter } from "./types";
import { backendCovers } from "./covers";
import { STATUS_TEXT, formatValue, isOpen, labelOf, pageText, tierText } from "@/components/covers/format";

// Real-mode policy view: the household's stored holdings and their facts, mapped for /home, /policies and /policies/[id].
// Nothing here decides anything. A status is shown as the backend gave it; a model-read value is never presented as verified.

export const MAX_HOLDINGS = 5;
/** Facts that name the product when the owner confirmed it. Read only; absent means the page says nothing about it. */
const INSURER_KEYS = ["insurer_name", "insurer"];
const PRODUCT_KEYS = ["product_name", "plan_name"];
const CONFIRMED: ResolvedStatus[] = ["user_confirmed", "reviewed_reference"];

/** Where a holding is in its life, in words the page can act on. */
export type Stage = "reading" | "choose_plan" | "ready" | "needs_review";
export const stageOf = (s: HoldingStatus): Stage => (s === "uploaded" || s === "product_reported" ? "reading" : s === "insurer_pending" ? "choose_plan" : s === "conflicts" ? "needs_review" : "ready");

export type FactLine = {
  key: string;
  label: string;
  value: string;
  status: ResolvedStatus;
  statusText: string;
  open: boolean;
  /** "Your document, Page 2", or null when the backend returned no citation. */
  citation: string | null;
  quote: string | null;
  group: string | null;
  conflictId: string | null;
};
export type PolicyView = {
  id: string;
  title: string;
  insurer: string | null;
  stage: Stage;
  facts: FactLine[];
  pending: { id: string; label: string }[];
  notFound: number;
  /** Set when this holding's facts could not be loaded. A code, never raw text. */
  error: string | null;
};

export const codeOf = (e: unknown): string => (e instanceof AdapterError ? e.code : "BACKEND_UNREACHABLE");

export function factLine(f: FactView): FactLine {
  const src = f.sources.find((x) => x.tier === f.sourceTier) ?? f.sources[0];
  const page = src ? pageText(src.page) : null;
  return {
    key: f.factKey,
    label: labelOf(f.factKey),
    value: f.status === "conflicting" ? "Two readings" : f.status === "unknown" ? "Not found" : formatValue(f.value, f.unit, f.valueType),
    status: f.status,
    statusText: STATUS_TEXT[f.status],
    open: isOpen(f.status),
    citation: src ? [tierText(src.tier), page].filter(Boolean).join(", ") : null,
    quote: src?.quote ?? null,
    group: f.group ?? null,
    conflictId: f.openConflictId ?? null,
  };
}

const named = (facts: FactView[], keys: string[]): string | null => {
  const f = facts.find((x) => keys.includes(x.factKey) && CONFIRMED.includes(x.status) && typeof x.value === "string" && x.value);
  return f ? (f.value as string) : null;
};

/** One holding and what was read from it. `facts` and `conflicts` are null when the stage has none yet or the load failed. */
export function toPolicyView(h: HoldingView, loaded: { facts: FactView[]; unknownKeys: string[]; conflicts: ConflictView[] } | null, error: string | null = null): PolicyView {
  const facts = loaded?.facts ?? [];
  const insurer = named(facts, INSURER_KEYS);
  const product = named(facts, PRODUCT_KEYS);
  return {
    id: h.id,
    title: product ?? "Health policy",
    insurer,
    stage: stageOf(h.status),
    facts: facts.filter((f) => !INSURER_KEYS.includes(f.factKey) && !PRODUCT_KEYS.includes(f.factKey)).map(factLine),
    pending: (loaded?.conflicts ?? []).filter((c) => c.resolution === "pending").map((c) => ({ id: c.id, label: labelOf(c.factKey) })),
    notFound: loaded?.unknownKeys.length ?? 0,
    error,
  };
}

export async function loadPolicy(h: HoldingView): Promise<PolicyView> {
  if (stageOf(h.status) === "reading" || stageOf(h.status) === "choose_plan") return toPolicyView(h, null);
  try {
    const [f, c] = await Promise.all([backendCovers.facts(h.id), backendCovers.conflicts(h.id)]);
    return toPolicyView(h, { facts: f.facts, unknownKeys: f.unknownKeys, conflicts: c.conflicts });
  } catch (e) {
    return toPolicyView(h, null, codeOf(e));
  }
}

export async function loadPolicies(): Promise<PolicyView[]> {
  const holdings = await backendCovers.holdings();
  return Promise.all(holdings.slice(0, MAX_HOLDINGS).map(loadPolicy));
}

/** What a screen shows. */
export type DashState =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "empty" }
  | { kind: "ready"; policies: PolicyView[] };

export const stateOf = (policies: PolicyView[] | null, errorCode: string | null): DashState =>
  errorCode ? { kind: "error", code: errorCode } : policies === null ? { kind: "loading" } : policies.length === 0 ? { kind: "empty" } : { kind: "ready", policies };

/** Up to `n` facts worth showing first: ones that were read, limits before the rest. */
export const keyFacts = (p: PolicyView, n = 4): FactLine[] => {
  const read = p.facts.filter((f) => f.status !== "unknown");
  return [...read.filter((f) => f.group === "limits"), ...read.filter((f) => f.group !== "limits")].slice(0, n);
};

// ---- PolicyAdapter / ReadingAdapter shapes (kept for callers of adapters.policy and adapters.reading) -------------------------
// Only what the backend returned is filled. Money and renewal are not on the holdings routes, so they stay 0 and "" (backend gap).

const toPolicy = (p: PolicyView): Policy => ({ id: p.id, name: p.title, insurer: p.insurer ?? "", kind: "individual", sumInsuredRs: 0, premiumRs: 0, coPayPct: 0, renewsOn: "", memberIds: [] });

export const realPolicy: PolicyAdapter = {
  list: async () => (await loadPolicies()).map(toPolicy),
  get: async (id) => {
    const h = (await backendCovers.holdings()).find((x) => x.id === id);
    return h ? toPolicy(await loadPolicy(h)) : null;
  },
};

export const realReading: ReadingAdapter = {
  async findings(policyId): Promise<Finding[]> {
    try {
      const f = await backendCovers.facts(policyId);
      return f.facts.map((x) => {
        const l = factLine(x);
        return { policyId, label: l.label, answer: l.value, pageRef: l.citation ?? "", disagrees: x.status === "conflicting" };
      });
    } catch {
      return [];
    }
  },
};
