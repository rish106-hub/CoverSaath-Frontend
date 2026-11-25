import { describe, expect, it } from "vitest";
import { FACT_LABELS, labelOf } from "@/lib/fact-labels";
import { factLine } from "@/adapters/real-policy";
import type { FactView } from "@/adapters/covers-contract";
import { groupOf } from "@/components/covers/format";

describe("fact labels", () => {
  it("fact labels exact", () => {
    const expected: Record<string, string> = {
      sum_insured: "Sum insured", waiting_initial: "Initial waiting period", waiting_ped: "Pre-existing disease wait",
      pre_hospitalisation_days: "Before admission cover", post_hospitalisation_days: "After discharge cover", seller_name: "Sold by",
      clause_ayush: "AYUSH treatment", clause_exclusion: "Not covered", premium_total: "Premium", room_rent_limit: "Room rent limit",
      renewal_date: "Next renewal", free_look_period: "Free-look period", claim_intimation_window: "Tell insurer within",
      ncb_tier: "No-claim bonus tier", member_count: "People covered", cashless_non_network: "Cashless outside network",
      portability_allowed: "Portability", icu_limit_text: "ICU limit wording",
    };
    for (const [k, v] of Object.entries(expected)) expect(FACT_LABELS[k]).toBe(v);
  });
  it("label map has all contract keys", () => {
    expect(Object.keys(FACT_LABELS).length).toBeGreaterThanOrEqual(71);
    for (const label of Object.values(FACT_LABELS)) {
      expect(label).not.toBe("");
      expect(label).not.toContain("_");
      expect(label).not.toMatch(/\d{2,}/);
    }
  });
  it("unlisted key goes to Other details", () => {
    const fact = { factKey: "zzz_new_key", status: "extracted_unverified", value: { days: 5 }, unit: null, valueType: null, group: "limits", sourceTier: "own_pdf", sources: [] } as unknown as FactView;
    const line = factLine(fact);
    expect(line.label).toBe(labelOf("zzz_new_key"));
    expect(line.label).toBe("Zzz new key");
    expect(line.value).toBe("5 days");
    expect(groupOf(line.group)).toBe("Other details");
  });
});
