import type { HoldingView } from "@/adapters/covers-contract";

// One label per cover for the cover pickers on Chat, Network hospitals and What we found. "Cover 1" told nobody which policy was which;
// the insurer and plan name (from the holdings view) do. The holdings view carries no policy number, so no last-4 digits are shown (see #108).

/** "Insurer, Plan" from the holding summary; falls back to "Cover N" while the product is unconfirmed. Duplicates get " (N)" so every option stays distinct. */
export function holdingLabels(holdings: HoldingView[]): Map<string, string> {
  const base = holdings.map((h, i) => {
    const parts = [h.summary?.insurerName, h.summary?.productName].map((p) => p?.trim()).filter((p): p is string => Boolean(p));
    return parts.length > 0 ? parts.join(", ") : `Cover ${i + 1}`;
  });
  const total = new Map<string, number>();
  base.forEach((l) => total.set(l, (total.get(l) ?? 0) + 1));
  const seen = new Map<string, number>();
  return new Map(holdings.map((h, i) => {
    const l = base[i];
    if ((total.get(l) ?? 0) < 2) return [h.id, l];
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    return [h.id, `${l} (${n})`];
  }));
}

/** The <option> list of a cover picker. A component, not a value computed in the page, so the page's own hooks stay untouched by the label work. */
export function CoverOptions({ holdings }: { holdings: HoldingView[] }) {
  const names = holdingLabels(holdings);
  return <>{holdings.map((h) => <option key={h.id} value={h.id}>{names.get(h.id)}</option>)}</>;
}
