// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isDemoSession } from "@/adapters/demo";

afterEach(() => {
  document.cookie = "kv_demo=; Max-Age=0; path=/";
});

describe("demo marker", () => {
  it("is false without the cookie", () => {
    expect(isDemoSession()).toBe(false);
  });
  it("is true only for kv_demo=1", () => {
    document.cookie = "kv_demo=1; path=/";
    expect(isDemoSession()).toBe(true);
    document.cookie = "kv_demo=0; path=/";
    expect(isDemoSession()).toBe(false);
  });
});
