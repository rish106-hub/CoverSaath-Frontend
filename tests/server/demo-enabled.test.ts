import { describe, expect, it } from "vitest";
import { demoEnabled } from "@/server/backend/demo";

describe("demoEnabled", () => {
  it("is off when NEXT_PUBLIC_ADAPTERS is unset (undefined)", () => {
    expect(demoEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });
  it("is off for the real adapters", () => {
    expect(demoEnabled({ NEXT_PUBLIC_ADAPTERS: "real" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
  it("is on only in mock mode", () => {
    expect(demoEnabled({ NEXT_PUBLIC_ADAPTERS: "mock" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
  it("the kill switch turns mock mode off too", () => {
    expect(demoEnabled({ NEXT_PUBLIC_ADAPTERS: "mock", DEMO_LOGIN_ENABLED: "false" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});
