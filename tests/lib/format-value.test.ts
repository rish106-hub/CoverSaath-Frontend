import { describe, expect, it } from "vitest";
import { formatValue } from "@/components/covers/format";

describe("formatValue objects", () => {
  it("duration object renders days", () => {
    expect(formatValue({ days: 30 }, "days")).toBe("30 days");
    expect(formatValue({ days: 1 }, "days")).toBe("1 day");
    const zero = formatValue({ days: 0 }, "days");
    expect(zero).not.toBe("See the document");
    expect(zero).not.toContain("[object");
  });
  it("amountMinor renders rupees", () => {
    expect(formatValue({ amountMinor: 150000000, currency: "INR" }, "paise")).toBe("Rs 15,00,000");
  });
  it("text object renders text", () => {
    expect(formatValue({ text: "abc" }, null, "text")).toBe("abc");
  });
  it("unknown object shape is Not found", () => {
    for (const v of [formatValue({ foo: 1 }, null), formatValue({}, null), formatValue({ days: "x" }, null), formatValue(null, null)]) {
      expect(v).toBe("Not found");
      expect(v).not.toMatch(/\{|\[object|See the document/);
    }
  });
  it("pipe junk is not found", () => {
    expect(formatValue({ text: "Intermediary Name | Code | Phone" }, null, "text")).toBe("Not found");
    expect(formatValue({ text: "A | B" }, null, "text")).toBe("A | B");
    expect(formatValue({ text: "" }, null, "text")).toBe("Not found");
  });
});
