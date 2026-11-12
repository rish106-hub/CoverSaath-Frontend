import type { ConflictView, FactView, Headline, HoldingStatus, HoldingSummary, HoldingView, ResolvedStatus } from "./covers-contract";
import type { Finding, Policy } from "./schemas";
import { AdapterError, type PolicyAdapter, type ReadingAdapter } from "./types";
import { backendCovers } from "./covers";
import { STATUS_TEXT, documentKindText, formatValue, isOpen, labelOf, pageText, rupees, tierText } from "@/components/covers/format";

// Real-mode policy view: the household's stored holdings and their facts, mapped for /home, /policies and /policies/[id].
// Nothing here decides anything. A status is shown as the backend gave it; a model-read value is never presented as verified.

export const MAX_HOLDINGS = 5;
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
/** One of the three headline values of a holding, in words the page can show. `tone` drives the wording and the link to review. */
export type HeadlineLine = {
  key: "sum_insured" | "policy_period" | "premium_total";
  label: string;
  /** The value, or "Not found yet" when the backend has none. */
  value: string;
  status: ResolvedStatus | null;
  statusText: string;
  tone: "read" | "confirmed" | "review" | "missing";
};
export type PolicyView = {
  id: string;
  title: string;
  /** From the backend summary only; null until the owner confirmed the product. */
  insurer: string | null;
  productName: string | null;
  /** Empty before the product is confirmed and when the backend sent no summary. */
  headlines: HeadlineLine[];
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
    citation: src ? [tierText(src.tier), documentKindText(src.page?.documentKind), page].filter(Boolean).join(", ") : null,
    quote: src?.quote ?? null,
    group: f.group ?? null,
    conflictId: f.openConflictId ?? null,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isoDay = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** Money `{ amountMinor, currency }` (INR minor units) as rupees, through the shared formatter. Null when the value is not money. */
export const moneyText = (v: unknown): string | null => (isRecord(v) && Number.isSafeInteger(v.amountMinor) && (v.currency === undefined || v.currency === "INR") ? rupees(v.amountMinor as number) : null);
/** A policy period `{ startIso, endIso, days }` as "1 Apr 2026 to 31 Mar 2027". Null when either end is missing. */
export function periodText(v: unknown): string | null {
  if (!isRecord(v)) return null;
  const s = isoDay(v.startIso);
  const e = isoDay(v.endIso);
  return s && e ? `${formatValue(s, "iso_date")} to ${formatValue(e, "iso_date")}` : null;
}

const HEADLINES = [
  { field: "sumInsured", key: "sum_insured", label: "Sum insured", text: moneyText },
  { field: "policyPeriod", key: "policy_period", label: "Policy period", text: periodText },
  { field: "premium", key: "premium_total", label: "Premium", text: moneyText },
] as const;

export const MISSING_TEXT = "Not found yet";
const toneOf = (s: ResolvedStatus): HeadlineLine["tone"] => (s === "conflicting" ? "review" : CONFIRMED.includes(s) ? "confirmed" : "read");

/** One headline. A null headline, an unknown status or a value that does not fit its type is "not found yet", never a guess. */
export function headlineLine(spec: (typeof HEADLINES)[number], h: Headline | null | undefined): HeadlineLine {
  const missing: HeadlineLine = { key: spec.key, label: spec.label, value: MISSING_TEXT, status: h?.status === "unknown" ? "unknown" : null, statusText: MISSING_TEXT, tone: "missing" };
  if (!h) return missing;
  if (h.status === "conflicting") return { key: spec.key, label: spec.label, value: "Two readings", status: h.status, statusText: STATUS_TEXT.conflicting, tone: "review" };
  if (h.status === "unknown") return missing;
  const value = spec.text(h.value);
  return value ? { key: spec.key, label: spec.label, value, status: h.status, statusText: STATUS_TEXT[h.status], tone: toneOf(h.status) } : missing;
}

/** The three headlines of a summary; empty when the backend sent none (older backend). */
export const headlinesOf = (s: HoldingSummary | null | undefined): HeadlineLine[] => (s ? HEADLINES.map((spec) => headlineLine(spec, s[spec.field])) : []);

/** One holding and what was read from it. `facts` and `conflicts` are null when the stage has none yet or the load failed. */
export function toPolicyView(h: HoldingView, loaded: { facts: FactView[]; unknownKeys: string[]; conflicts: ConflictView[] } | null, error: string | null = null): PolicyView {
  const facts = loaded?.facts ?? [];
  const insurer = h.summary?.insurerName || null;
  const product = h.summary?.productName || null;
  const stage = stageOf(h.status);
  return {
    id: h.id,
    title: product ?? "Health policy",
    insurer,
    productName: product,
    headlines: stage === "reading" || stage === "choose_plan" ? [] : headlinesOf(h.summary),
    stage,
    facts: facts.map(factLine),
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
  const read = p.facts.filter((f) => f.status !== "unknown" && !HEADLINES.some((h) => h.key === f.key));
  return [...read.filter((f) => f.group === "limits"), ...read.filter((f) => f.group !== "limits")].slice(0, n);
};

// ---- PolicyAdapter / ReadingAdapter shapes (kept for callers of adapters.policy and adapters.reading) -------------------------
// Only what the backend returned is filled. A Policy carries no status, so a typed field is filled only from a headline the owner
// confirmed (or the insurer's wording matched); a value only read from the document stays 0 or "" here, and the screens show it
// with its status instead. Renewal is the end of the policy period. Co-pay is not a headline, so it stays 0.

const confirmedValue = (h: Headline | null | undefined): unknown => (h && CONFIRMED.includes(h.status) ? h.value : undefined);
const rupeesOf = (h: Headline | null | undefined): number => {
  const v = confirmedValue(h);
  return isRecord(v) && Number.isSafeInteger(v.amountMinor) && (v.amountMinor as number) >= 0 ? (v.amountMinor as number) / 100 : 0;
};
const renewalOf = (h: Headline | null | undefined): string => {
  const v = confirmedValue(h);
  return (isRecord(v) && isoDay(v.endIso)) || "";
};

export const toPolicy = (p: PolicyView, summary?: HoldingSummary | null): Policy => ({
  id: p.id, name: p.title, insurer: p.insurer ?? "", kind: "individual",
  sumInsuredRs: rupeesOf(summary?.sumInsured), premiumRs: rupeesOf(summary?.premium), coPayPct: 0, renewsOn: renewalOf(summary?.policyPeriod), memberIds: [],
});

export const realPolicy: PolicyAdapter = {
  list: async () => {
    const holdings = (await backendCovers.holdings()).slice(0, MAX_HOLDINGS);
    return Promise.all(holdings.map(async (h) => toPolicy(await loadPolicy(h), h.summary)));
  },
  get: async (id) => {
    const h = (await backendCovers.holdings()).find((x) => x.id === id);
    return h ? toPolicy(await loadPolicy(h), h.summary) : null;
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
