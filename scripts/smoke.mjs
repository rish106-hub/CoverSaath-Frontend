#!/usr/bin/env node
// Post-deploy smoke test. Usage: node scripts/smoke.mjs <baseUrl>
// Exits non-zero on the first failed check. Read-only: no sign-in, no writes.
const base = (process.argv[2] ?? process.env.SMOKE_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("usage: node scripts/smoke.mjs <baseUrl>");
  process.exit(2);
}

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures.push(name);
};
const get = (path, init) => fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(10_000), ...init });

const page = await get("/signin");
check("/signin 200", page.status === 200, String(page.status));
const html = await page.text();
check("/signin renders app shell", html.includes("<html"));

for (const [k, v] of [
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
]) {
  check(`header ${k}`, page.headers.get(k) === v, page.headers.get(k) ?? "missing");
}
check("header content-security-policy", (page.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"));
check("header strict-transport-security", base.startsWith("http://") || !!page.headers.get("strict-transport-security"));
check("no x-powered-by", !page.headers.get("x-powered-by"));

const health = await get("/api/health");
check("/api/health 200 ok", health.status === 200 && (await health.json()).ok === true, String(health.status));

// Unauthenticated BFF call must answer coded JSON, never a 500 or an HTML error page.
const me = await get("/api/app/me");
const ct = me.headers.get("content-type") ?? "";
const body = ct.includes("json") ? await me.json().catch(() => null) : null;
check("/api/app/me coded JSON", ct.includes("json") && body !== null && typeof body.code === "string", `${me.status} ${body?.code ?? ct}`);
check("/api/app/me not CONFIG_MISSING", body?.code !== "CONFIG_MISSING", body?.code ?? "");
check("/api/app/me no-store", (me.headers.get("cache-control") ?? "").includes("no-store"));

const status = await get("/api/app/status");
check("/api/app/status hidden in production", status.status === 404, String(status.status));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nsmoke ok");
