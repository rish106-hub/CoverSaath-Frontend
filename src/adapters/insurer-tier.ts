// The insurer-wording tier (CoverSaath ADR 0036, ADR 0039). A fact read by a model from the insurer's public wording is
// `extracted_unverified` in tier `ida_wording`. It is always shown with this label, its page and a quote of at most 160 characters.
// FOR LEGAL REVIEW: the label wording is not final. It must match the backend's INSURER_UNCHECKED_LABEL word for word.

export const INSURER_UNCHECKED_LABEL = "From the insurer's wording, not checked";
/** The backend caps a quote at 160 characters on every insurer-tier path; the page enforces it again on what it shows. */
export const INSURER_QUOTE_MAX = 160;
/** Source kind and tier the backend uses for chat and passage sources taken from the insurer's wording (never a household document). */
export const INSURER_SOURCE = "insurer_wording";

/** An insurer-tier reading that no person or reviewer has checked. */
export const isInsurerUnchecked = (tier: string | null | undefined, status: string | null | undefined): boolean => tier === "ida_wording" && status === "extracted_unverified";

/** At most INSURER_QUOTE_MAX characters, cut with an ellipsis; null for an empty quote. */
export function clipQuote(quote: string | null | undefined, max = INSURER_QUOTE_MAX): string | null {
  const q = (quote ?? "").replace(/\s+/g, " ").trim();
  if (!q) return null;
  return q.length <= max ? q : `${q.slice(0, max - 1).trimEnd()}…`;
}

/** "From the insurer's wording, not checked, page 7". */
export const insurerLine = (page?: number | null): string => (page ? `${INSURER_UNCHECKED_LABEL}, page ${page}` : INSURER_UNCHECKED_LABEL);
