// Soak: fire requests at a running server and report latency percentiles. No browser, no dependencies.
// Usage: node scripts/soak.mjs <baseUrl> [--total 2000] [--concurrency 50] [--pid <serverPid>]
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "").replace(/\/$/, "");
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
if (!base) {
  console.error("Usage: node scripts/soak.mjs <baseUrl> [--total 2000] [--concurrency 50] [--pid N]");
  process.exit(2);
}
const total = opt("total", 2000);
const concurrency = opt("concurrency", 50);
const pid = opt("pid", 0);

const ROUTES = [
  "/", "/signin", "/welcome", "/welcome/add", "/welcome/reading", "/welcome/people", "/welcome/ready",
  "/home", "/policies", "/review", "/compare", "/stress-test", "/tools", "/family", "/money", "/cards",
  "/desk", "/emergency", "/assistant", "/shortcuts", "/settings", "/api/app/me",
];

const rss = () => {
  if (!pid) return null;
  try {
    return Number(execFileSync("ps", ["-o", "rss=", "-p", String(pid)]).toString().trim()) / 1024;
  } catch {
    return null;
  }
};

const lat = [];
const byStatus = new Map();
let errors = 0;
let backendDown = 0;
let next = 0;
const rssBefore = rss();
let rssPeak = rssBefore ?? 0;

async function worker() {
  while (true) {
    const i = next++;
    if (i >= total) return;
    const url = base + ROUTES[i % ROUTES.length];
    const t0 = performance.now();
    try {
      const res = await fetch(url, { redirect: "manual", headers: { accept: "text/html" } });
      await res.arrayBuffer();
      byStatus.set(res.status, (byStatus.get(res.status) ?? 0) + 1);
      // 5xx and transport failures are errors. 4xx on API routes without a session is expected.
      // A 503 from /api/app/* means the backend is not configured for this run; counted apart.
      if (res.status === 503 && url.includes("/api/app/")) backendDown++;
      else if (res.status >= 500) errors++;
    } catch {
      errors++;
    }
    lat.push(performance.now() - t0);
    if (i % 100 === 0) rssPeak = Math.max(rssPeak, rss() ?? 0);
  }
}

const start = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const secs = (performance.now() - start) / 1000;
lat.sort((a, b) => a - b);
const pct = (p) => lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))];
const rssAfter = rss();
rssPeak = Math.max(rssPeak, rssAfter ?? 0);

console.log(`requests ${lat.length} in ${secs.toFixed(1)}s (${(lat.length / secs).toFixed(0)} req/s), concurrency ${concurrency}`);
console.log(`latency ms  p50 ${pct(50).toFixed(1)}  p95 ${pct(95).toFixed(1)}  p99 ${pct(99).toFixed(1)}  max ${lat[lat.length - 1].toFixed(1)}`);
console.log(`errors (5xx or failed) ${errors}`);
console.log(`api 503 (backend not configured, not counted) ${backendDown}`);
console.log(`status ${[...byStatus].sort().map(([s, n]) => `${s}:${n}`).join(" ")}`);
if (pid) console.log(`server RSS MB  before ${rssBefore?.toFixed(0)}  after ${rssAfter?.toFixed(0)}  peak ${rssPeak.toFixed(0)}`);
process.exit(errors ? 1 : 0);
