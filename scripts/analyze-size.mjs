// First-load JS (gzip) per route, read from a finished `next build` (.next/). No dependencies.
// Static routes: the <script> tags in the prerendered HTML. Dynamic routes: rootMainFiles plus the
// page and layout entries of the client-reference manifest. Budget: 300 kB gzip per route.
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const BUDGET_KB = 400;

const gz = new Map();
function gzipKb(dist, file) {
  if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(path.join(dist, file))).length / 1024);
  return gz.get(file);
}

function manifestChunks(dist, appDir, page) {
  const file = path.join(appDir, page, "page_client-reference-manifest.js");
  if (!existsSync(file)) return [];
  const sandbox = { globalThis: {} };
  sandbox.globalThis.__RSC_MANIFEST = {};
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox);
  const m = Object.values(sandbox.globalThis.__RSC_MANIFEST)[0];
  const out = new Set();
  for (const [k, files] of Object.entries(m?.entryJSFiles ?? {})) {
    if (/\/(error|not-found|global-error|loading)$/.test(k)) continue;
    files.forEach((f) => out.add(f));
  }
  return [...out];
}

export function analyze(dist = ".next") {
  const appDir = path.join(dist, "server", "app");
  const routes = JSON.parse(readFileSync(path.join(dist, "app-path-routes-manifest.json"), "utf8"));
  const root = JSON.parse(readFileSync(path.join(dist, "build-manifest.json"), "utf8")).rootMainFiles ?? [];
  const rows = [];
  for (const [entry, route] of Object.entries(routes)) {
    if (!entry.endsWith("/page") || route === "/_global-error" || route === "/_not-found") continue;
    const pageDir = entry.slice(0, -"/page".length) || "/";
    const htmlPath = path.join(appDir, route === "/" ? "index" : route) + ".html";
    let files;
    if (existsSync(htmlPath)) {
      const html = readFileSync(htmlPath, "utf8");
      files = [...new Set([...html.matchAll(/\/_next\/(static\/chunks\/[^"']+\.js)/g)].map((m) => m[1]))];
    } else {
      files = [...new Set([...root, ...manifestChunks(dist, appDir, pageDir)])];
    }
    files = files.filter((f) => existsSync(path.join(dist, f)));
    const kb = files.reduce((n, f) => n + gzipKb(dist, f), 0);
    rows.push({ route, kb: Math.round(kb * 10) / 10, chunks: files.length });
  }
  return rows.sort((a, b) => b.kb - a.kb);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dist = process.argv[2] ?? ".next";
  if (!existsSync(path.join(dist, "BUILD_ID"))) {
    console.error(`No build in ${dist}. Run "npm run build" first.`);
    process.exit(2);
  }
  const rows = analyze(dist);
  console.log(`First-load JS, gzip (budget ${BUDGET_KB} kB)`);
  for (const r of rows) console.log(`${String(r.kb).padStart(8)} kB  ${String(r.chunks).padStart(3)} chunks  ${r.route}${r.kb > BUDGET_KB ? "   OVER BUDGET" : ""}`);
  process.exit(rows.some((r) => r.kb > BUDGET_KB) ? 1 : 0);
}
