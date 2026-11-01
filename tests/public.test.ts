import { describe, expect, it } from "vitest";
import { validateAccess } from "@/components/public/validate";
import { applyOtpInput, otpComplete } from "@/components/public/otp";
import { detectWalletPlatform, orderWallets } from "@/lib/wallet-detect";

describe("access form validation", () => {
  it("accepts a name and email", () => {
    expect(validateAccess("Meera Rao", "meera.rao@company.com").ok).toBe(true);
  });
  it("flags an empty name and a bad email", () => {
    const r = validateAccess("  ", "not-an-email");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBeTruthy();
      expect(r.errors.email).toBeTruthy();
    }
  });
});

describe("otp boxes", () => {
  const empty = Array(6).fill("");
  it("fills all six boxes from a pasted code and ignores non-digits", () => {
    const r = applyOtpInput(empty, 0, "48 20-71");
    expect(r.boxes.join("")).toBe("482071");
    expect(otpComplete(r.boxes)).toBe(true);
    expect(r.focus).toBe(5);
  });
  it("advances focus after one digit", () => {
    const r = applyOtpInput(empty, 2, "7");
    expect(r.boxes[2]).toBe("7");
    expect(r.focus).toBe(3);
    expect(otpComplete(r.boxes)).toBe(false);
  });
  it("drops digits past the sixth box", () => {
    expect(applyOtpInput(empty, 4, "12345").boxes).toEqual(["", "", "", "", "1", "2"]);
  });
});

describe("wallet detection", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", "apple"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", "apple"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile", "google"],
    ["Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120 Mobile", "samsung"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", "google"],
  ])("%s -> %s", (ua, want) => {
    expect(detectWalletPlatform(ua)).toBe(want);
  });
  it("puts the detected wallet first and the rest under others", () => {
    expect(orderWallets("samsung")).toEqual({ first: "samsung", others: ["apple", "google"] });
  });
});
