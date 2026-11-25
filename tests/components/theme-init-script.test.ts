// @vitest-environment jsdom
// Row 31 of issue #107: first-time visitors follow prefers-color-scheme; a stored choice wins.
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY, themeInitScript } from "@/components/theme";

function run(stored: string | null, osDark: boolean | "no-matchmedia") {
  document.documentElement.removeAttribute("data-theme");
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k === THEME_KEY ? stored : null) });
  if (osDark === "no-matchmedia") vi.stubGlobal("matchMedia", undefined);
  else vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("dark") && osDark }));
  window.eval(themeInitScript);
  return document.documentElement.getAttribute("data-theme");
}

describe("themeInitScript", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("first visit, OS dark -> dark", () => expect(run(null, true)).toBe("dark"));
  it("first visit, OS light -> light", () => expect(run(null, false)).toBe("light"));
  it("stored light beats OS dark", () => expect(run("light", true)).toBe("light"));
  it("stored dark beats OS light", () => expect(run("dark", false)).toBe("dark"));
  it("garbage stored value falls back to the OS setting", () => expect(run("blue", true)).toBe("dark"));
  it("no matchMedia -> light", () => expect(run(null, "no-matchmedia")).toBe("light"));
});
