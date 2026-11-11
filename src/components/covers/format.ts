import type { FactView, ResolvedStatus, SourceView } from "@/adapters/covers-contract";

// Pure display helpers for the cover screens. No decision is made here: a status is shown as the backend gave it.

export const GROUP_ORDER = ["Limits", "Waiting", "Exclusions", "Cashless", "Money", "Other details"] as const;
export type GroupLabel = (typeof GROUP_ORDER)[number];

const GROUP_OF: Record<string, GroupLabel> = {
  limits: "Limits", cover: "Limits",
  waiting: "Waiting",
  exclusions: "Exclusions",
  cashless: "Cashless", network: "Cashless",
  money: "Money", premium: "Money", payment: "Money", bonus: "Money",
};
export const groupOf = (group: string | null | undefined): GroupLabel => GROUP_OF[group ?? ""] ?? "Other details";

/** "room_rent_limit" becomes "Room rent limit". The backend sends keys, not display text. */
export function labelOf(factKey: string): string {
  const words = factKey.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : factKey;
}

const rupees = (paise: number): string => `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(paise / 100)}`;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null);
const plural = (n: number, one: string): string => `${n} ${n === 1 ? one : `${one}s`}`;

/** One value in plain words, by its unit. Null or an unreadable value is "Not found". */
export function formatValue(value: unknown, unit: string | null | undefined, type?: string | null): string {
  if (value === null || value === undefined || value === "") return "Not found";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const n = num(value);
  if (n !== null) {
    switch (unit) {
      case "paise": return rupees(n);
      case "days": return plural(n, "day");
      case "months": return plural(n, "month");
      case "years": return plural(n, "year");
      case "percent": return `${n}%`;
      case "basis_points": return `${n / 100}%`;
      default: return type === "text" ? String(value) : new Intl.NumberFormat("en-IN").format(n);
    }
  }
  if (typeof value === "string") {
    if (unit === "iso_date" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    }
    return value;
  }
  return "See the document";
}

export const STATUS_TEXT: Record<ResolvedStatus, string> = {
  extracted_unverified: "Read from your document",
  reviewed_reference: "Matches the insurer's wording",
  user_confirmed: "You confirmed this",
  conflicting: "Needs your decision",
  unknown: "Not found",
};
/** Amber rows are the ones still open. */
export const isOpen = (s: ResolvedStatus): boolean => s === "conflicting" || s === "unknown";

export const TIER_TEXT: Record<string, string> = { own_pdf: "Your document", ida_wording: "The insurer's wording", user_declaration: "What you told us" };
export const tierText = (tier: string | null | undefined): string => TIER_TEXT[tier ?? ""] ?? "Another source";

/** "Page 2" from the backend's page id ("page-2"); the id itself when it has no number. */
export function pageText(page: SourceView["page"]): string | null {
  if (!page) return null;
  const m = /(\d+)\s*$/.exec(page.pageId);
  return m ? `Page ${m[1]}` : "In the document";
}

export function groupFacts(facts: FactView[]): { label: GroupLabel; facts: FactView[] }[] {
  const by = new Map<GroupLabel, FactView[]>();
  for (const f of facts) by.set(groupOf(f.group), [...(by.get(groupOf(f.group)) ?? []), f]);
  return GROUP_ORDER.filter((g) => by.has(g)).map((label) => ({ label, facts: by.get(label) as FactView[] }));
}

export const todayIso = (): string => new Date().toISOString().slice(0, 10);
