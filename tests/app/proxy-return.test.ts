import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());
const at = (path: string, cookie?: string) => new NextRequest(`http://app.test${path}`, cookie ? { headers: { cookie } } : undefined);
const matcher = (path: string) => config.matcher.some((m) => new RegExp(`^${m.replace("/:path*", "(/.*)?")}$`).test(path));

describe("proxy return path", () => {
  it("guards the add-cover, chat, upload and hospitals sections", () => {
    for (const p of ["/covers/add", "/covers/review", "/chat", "/upload", "/hospitals", "/policies/h1"]) expect(matcher(p), p).toBe(true);
  });
  it("sends a signed-out visitor to /signin carrying the page, email and name", () => {
    vi.stubEnv("NEXT_PUBLIC_ADAPTERS", "real");
    const res = proxy(at("/covers/add?email=asha%40example.com&name=Asha&utm=x"));
    const loc = new URL(res.headers.get("location") as string);
    expect(loc.pathname).toBe("/signin");
    expect(Object.fromEntries(loc.searchParams)).toEqual({ next: "/covers/add", email: "asha@example.com", name: "Asha" });
  });
  it("carries a plain path with no extras", () => {
    vi.stubEnv("NEXT_PUBLIC_ADAPTERS", "real");
    expect(new URL(proxy(at("/chat")).headers.get("location") as string).search).toBe("?next=%2Fchat");
  });
  it("sends a path outside the allowlist to plain /signin", () => {
    vi.stubEnv("NEXT_PUBLIC_ADAPTERS", "real");
    expect(new URL(proxy(at("/covers/secret")).headers.get("location") as string).search).toBe("");
  });
  it("lets a signed-in visitor through", () => {
    vi.stubEnv("NEXT_PUBLIC_ADAPTERS", "real");
    expect(proxy(at("/covers/add", "__Host-kv_session=x")).headers.get("location")).toBeNull();
  });
});
