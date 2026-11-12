import { describe, expect, it } from "vitest";
import { MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, returnPathFromSearch, returnPathOr, safeReturnPath, signInUrl } from "@/lib/return-path";
import { PAGES } from "@/lib/ia";

describe("safeReturnPath", () => {
  it.each(["/covers/add", "/covers/review", "/covers/declarations", "/chat", "/upload", "/home", "/policies", "/policies/holding-1", "/hospitals", "/settings"])("accepts %s", (p) => {
    expect(safeReturnPath(p)).toBe(p);
  });
  it("accepts every registered static page and a trailing slash is dropped", () => {
    for (const pg of PAGES.filter((x) => !x.route.includes("["))) expect(safeReturnPath(pg.href)).toBe(pg.href);
    expect(safeReturnPath("/covers/add/")).toBe("/covers/add");
  });
  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash", "/\\evil.example"],
    ["absolute url", "https://evil.example"],
    ["absolute url to a known path", "https://evil.example/covers/add"],
    ["encoded slashes", "/%2F%2Fevil.example"],
    ["encoded backslash", "/%5Cevil.example"],
    ["javascript scheme", "javascript:alert(1)"],
    ["unknown section", "/admin"],
    ["unknown subpage", "/covers/secret"],
    ["too deep", "/policies/a/b"],
    ["no leading slash", "covers/add"],
    ["query", "/covers/add?x=1"],
    ["fragment", "/covers/add#x"],
    ["double slash inside", "/covers//add"],
    ["newline", "/covers/add\n"],
    ["tab", "/covers\t/add"],
    ["null byte", "/covers/add\0"],
    ["space", "/covers/ add"],
    ["over long", `/policies/${"a".repeat(200)}`],
    ["empty", ""],
    ["root", "/"],
    ["not a string", 42],
    ["null", null],
  ])("rejects %s", (_n, v) => {
    expect(safeReturnPath(v)).toBeNull();
  });
  it("falls back when unsafe", () => {
    expect(returnPathOr("//evil.example", "/welcome")).toBe("/welcome");
    expect(returnPathOr("/chat", "/welcome")).toBe("/chat");
  });
  it("reads next from a query string", () => {
    expect(returnPathFromSearch("?next=%2Fcovers%2Fadd&email=a@b.co")).toBe("/covers/add");
    expect(returnPathFromSearch("?next=%2F%2Fevil.example")).toBeNull();
    expect(returnPathFromSearch("")).toBeNull();
  });
});

describe("signInUrl", () => {
  it("carries a safe path, email and name only", () => {
    const u = new URL(signInUrl({ path: "/covers/add", email: "a@b.co", name: "Asha" }), "http://x");
    expect(u.pathname).toBe("/signin");
    expect(Object.fromEntries(u.searchParams)).toEqual({ next: "/covers/add", email: "a@b.co", name: "Asha" });
  });
  it("drops an unsafe path and caps lengths", () => {
    expect(signInUrl({ path: "//evil.example" })).toBe("/signin");
    const u = new URL(signInUrl({ path: "/chat", email: "e".repeat(500), name: "n".repeat(500) }), "http://x");
    expect(u.searchParams.get("email")).toHaveLength(MAX_EMAIL_LENGTH);
    expect(u.searchParams.get("name")).toHaveLength(MAX_NAME_LENGTH);
  });
});
