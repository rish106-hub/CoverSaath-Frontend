import type { Page, Route } from "@playwright/test";

// Synthetic real-account backend for the browser: answers every same-origin /api/app/* call the shell and the real-account screens make,
// so a dev server running in backend mode (no backend behind it) renders what a signed-in person sees. Each shape is copied from the zod
// contract the browser adapter parses (src/adapters/covers-contract.ts, documents-contract.ts, user-data-contract.ts, scenarios.ts,
// payments.ts, evidence-contract.ts, schemas.ts) and from the BFF envelope of its route: cover and evidence routes answer
// `{ ok: true, data }`, documents and user-data routes answer `{ ok: true, ... }`, /me answers the bare session object.
// Synthetic data only. The backend's own API is never answered here (a browser call to it is aborted and recorded), and a request to any
// host other than the dev server is aborted and recorded too.
//
// Options: `long` gives holding h1 a very long product and insurer name, three open conflicts and one 120-character fact (to catch text
// cut off inside a card); `canAdd: false` makes the payment slots answer "pay first" so the wizard shows the pay screen; `verify: "down"`
// makes the payment verify call fail with a retryable 502 so the payment stays unconfirmed.

export type RealAccountOptions = { policies?: 1 | 2 | 5; long?: boolean; canAdd?: boolean; verify?: "ok" | "down" };

const LONG_PRODUCT_NAME = "Example Comprehensive Family Health Protection Plan Platinum 2026";
const LONG_INSURER_NAME = "Example General Insurance Company Limited";
// Exactly 120 characters; it replaces the value of one Limits fact when `long` is set.
const LONG_FACT_VALUE = "Cataract surgery is covered up to Rs 40,000 per eye, and every other day-care procedure up to the sum insured each year.";
// Facts that carry an open conflict when `long` is set. All three are known labels, so each keeps its group.
const LONG_CONFLICT_KEYS = ["deductible", "copay_percent", "waiting_ped"] as const;

const PRODUCT_NAMES = ["Example Health Plan 01", "Example Family Floater 02", "Example Senior Care 03", "Example Top-up Plan 04", "Example Care Plus 05"];
const INSURER_NAMES = ["Example Insurer", "Example Insurer", "Example Insurer", "Example Insurer", "Example Insurer"];

const money = (rupees: number) => ({ currency: "INR", amountMinor: rupees * 100 });
const sourceOf = (n: number, quote: string) => [{ id: `s-${n}`, tier: "own_pdf", status: "extracted_unverified", value: null, page: { pageId: `p${n}`, documentKind: "policy_schedule", pageNumber: n }, quote, current: true }];

type FactSpec = { key: string; group: string; value: unknown; unit?: string; type?: string; status?: string; page: number; quote: string };
// Nine facts in Limits (so that group pages at eight), four in Waiting, two in Exclusions. Keys are known labels, so each keeps its group.
const FACT_SPECS: FactSpec[] = [
  { key: "renewal_date", group: "limits", value: "2027-03-31", unit: "iso_date", type: "date", page: 1, quote: "Policy ends on 31 March 2027." },
  { key: "room_rent_limit", group: "limits", value: "1 percent of the sum insured per day", type: "text", page: 3, quote: "Room rent up to 1% of the sum insured per day." },
  { key: "icu_limit", group: "limits", value: "2 percent of the sum insured per day", type: "text", page: 3, quote: "ICU charges up to 2% of the sum insured per day." },
  { key: "deductible", group: "limits", value: 2500000, unit: "paise", page: 4, quote: "Deductible of Rs 25,000 applies." },
  { key: "sub_limit", group: "limits", value: "Cataract up to Rs 40,000 per eye", type: "text", page: 4, quote: "Cataract: Rs 40,000 per eye." },
  { key: "ambulance_limit", group: "limits", value: 300000, unit: "paise", page: 5, quote: "Ambulance up to Rs 3,000." },
  { key: "pre_hospitalisation_days", group: "limits", value: 60, unit: "days", page: 5, quote: "60 days before admission." },
  { key: "post_hospitalisation_days", group: "limits", value: 90, unit: "days", page: 5, quote: "90 days after discharge." },
  { key: "copay_percent", group: "limits", value: 10, unit: "percent", status: "user_confirmed", page: 6, quote: "10% co-payment on every claim." },
  { key: "waiting_initial", group: "waiting", value: 30, unit: "days", page: 7, quote: "Initial waiting period of 30 days." },
  { key: "waiting_ped", group: "waiting", value: 36, unit: "months", page: 7, quote: "Pre-existing diseases after 36 months." },
  { key: "waiting_maternity", group: "waiting", value: 24, unit: "months", page: 7, quote: "Maternity after 24 months." },
  { key: "waiting_specific", group: "waiting", value: 24, unit: "months", page: 8, quote: "Listed illnesses after 24 months." },
  { key: "clause_exclusion", group: "exclusions", value: "Cosmetic treatment is not covered", type: "text", page: 9, quote: "Cosmetic treatment is excluded." },
  { key: "clause_ayush", group: "exclusions", value: "AYUSH treatment covered in a recognised hospital", type: "text", page: 9, quote: "AYUSH treatment is covered in a recognised hospital." },
];
const UNKNOWN_KEYS = ["seller_irdai_registration", "tpa_name"];

const factView = (f: FactSpec, long: boolean) => {
  const conflictIndex = long ? LONG_CONFLICT_KEYS.indexOf(f.key as (typeof LONG_CONFLICT_KEYS)[number]) : -1;
  const value = long && f.key === "sub_limit" ? LONG_FACT_VALUE : f.value;
  return {
    factKey: f.key, factClass: "term", valueType: f.type ?? "number", unit: f.unit ?? null, group: f.group,
    status: conflictIndex >= 0 ? "conflicting" : f.status ?? "extracted_unverified", value: conflictIndex >= 0 ? null : value, sourceTier: "own_pdf", alternatives: [], checkWithInsurer: false,
    openConflictId: conflictIndex >= 0 ? `conflict-${conflictIndex + 1}` : null,
    sources: sourceOf(f.page, f.quote),
  };
};

// One open conflict per key in LONG_CONFLICT_KEYS: the schedule says one thing and the insurer's wording another (two candidate readings).
const conflictViews = () => LONG_CONFLICT_KEYS.map((key, i) => {
  const spec = FACT_SPECS.find((f) => f.key === key) as FactSpec;
  return {
    id: `conflict-${i + 1}`, factKey: key, factClass: "term", valueType: spec.type ?? "number", reason: "value_mismatch", kind: "own_vs_insurer", resolution: "pending",
    checkWithInsurer: false,
    candidates: [
      { id: `cs-${i + 1}-a`, tier: "own_pdf", status: "extracted_unverified", value: spec.value, page: { pageId: `p${spec.page}`, documentKind: "policy_schedule", pageNumber: spec.page }, quote: spec.quote, current: true, source: "own_document" },
      { id: `cs-${i + 1}-b`, tier: "ida_wording", status: "extracted_unverified", value: spec.value, page: { pageId: `p${spec.page + 10}`, documentKind: "policy_wording", pageNumber: spec.page + 10 }, quote: spec.quote, current: true, source: "reviewed_reference" },
    ],
  };
});

const MEMORY_MARKDOWN = [
  "# Policy memory",
  "## Limits",
  '- Sum insured Rs 5,00,000 (you stated this) Quote: "Sum insured Rs 5,00,000." [policy_schedule, p.1]',
  '- Room rent limit 1 percent of the sum insured per day (read from your document, not verified) Quote: "Room rent up to 1% of the sum insured per day." [policy_schedule, p.3]',
  "## Waiting periods",
  '- Pre-existing disease wait 36 months (read from your document, not verified) Quote: "Pre-existing diseases after 36 months." [policy_schedule, p.7]',
].join("\n");

// Network hospitals of a pincode: 560099 has none; any other pincode has twelve, every third one without cashless. With `long` the first one
// has a 90-character name and address (to catch text cut off inside a row).
const hospitalList = (pincode: string, long: boolean) => pincode === "560099" ? [] : Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const first = long && n === 1;
  return {
    id: `hosp-${n}`, name: first ? `Example Hospital 1 ${"Multi Speciality Care ".repeat(4)}`.slice(0, 90) : `Example Hospital ${n}`,
    address: first ? `${n} Example Main Road, ${"Synthetic Layout Block ".repeat(4)}`.slice(0, 90) : `${n} Example Road`, city: "Bengaluru", pincode, cashless: n % 3 !== 0,
  };
});

const WIZARD_HOLDING_ID = "h-new";
const WIZARD_DOCUMENT_ID = "doc-new";

export async function asRealAccount(page: Page, opts: RealAccountOptions = {}): Promise<{ unhandled: string[] }> {
  const count = opts.policies ?? 2;
  const long = opts.long === true;
  const canAdd = opts.canAdd !== false;
  const verifyDown = opts.verify === "down";
  const unhandled: string[] = [];
  const port = process.env.KV_E2E_PORT ?? "3312";
  const baseUrl = `http://localhost:${port}`;
  const baseHost = new URL(baseUrl).host;

  // The proxy only checks that the session cookie exists; the session itself is read by the browser from /api/app/me (answered below).
  await page.context().addCookies([{ name: "kv_session", value: "synthetic-session", url: baseUrl }]);

  // State of the add-a-policy wizard: consent, then an uploaded schedule that is read over two progress checks, then a holding awaiting its plan.
  const wizard = { consent: false, uploaded: false, advances: 0, confirmed: false };
  // Payment: `paid` flips when the verify call is answered "ok"; only then do the slots say another policy can be added.
  const payment = { paid: false };
  const slotsView = () => ({ enabled: !canAdd, used: count, allowed: payment.paid ? 2 : 1, canAdd: canAdd || payment.paid, pricePaise: 19900, currency: "INR" });

  const holdings = () => {
    const list = Array.from({ length: count }, (_, i) => {
      const n = i + 1;
      const first = n === 1;
      const summary: Record<string, unknown> = {
        insurerName: first && long ? LONG_INSURER_NAME : INSURER_NAMES[i], productName: first && long ? LONG_PRODUCT_NAME : PRODUCT_NAMES[i],
        sumInsured: { factKey: "sum_insured", value: money(first ? 500000 : 300000 + n * 100000), status: "user_confirmed" },
        wordingState: "fss",
      };
      if (first) {
        summary.policyPeriod = { factKey: "policy_period", value: { startIso: "2026-04-01", endIso: "2027-03-31", days: 365 }, status: "extracted_unverified" };
        summary.premium = { factKey: "premium_total", value: money(18500), status: "extracted_unverified" };
      }
      return { id: `h${n}`, documentId: `doc-h${n}`, kind: "policy_schedule", status: first && long ? "conflicts" : "ready", summary };
    });
    if (wizard.uploaded) {
      list.push({ id: WIZARD_HOLDING_ID, documentId: WIZARD_DOCUMENT_ID, kind: "policy_schedule", status: wizard.confirmed ? "ready" : "insurer_pending", summary: { insurerName: null, productName: null, wordingState: "missing" } } as never);
    }
    return list;
  };

  const docView = (steps: Record<string, string>, busy: boolean) => ({ id: WIZARD_DOCUMENT_ID, kind: "policy_schedule", sizeBytes: 1024, uploadedAt: null, steps, note: null, busy });

  type Answer = { status?: number; json: unknown };
  const answer = (method: string, path: string, query: URLSearchParams = new URLSearchParams()): Answer | null => {
    const data = (d: unknown): Answer => ({ json: { ok: true, data: d } });
    const get = method === "GET";
    if (get && path === "/api/app/me") return { json: { householdId: "hh-example-01", householdName: "Rao household", owner: { id: "u-asha", displayName: "Asha Rao", email: "asha.rao@example.com" }, source: "backend" } };
    if (get && path === "/api/app/preferences") return { json: { ok: true, prefs: null, revision: 0 } };
    if (get && path === "/api/app/onboarding") return { json: { ok: true, state: null, completed: true, revision: 0 } };
    if (get && path === "/api/app/permissions") return { json: { ok: true, permissions: [] } };
    if (get && path === "/api/app/places") return { json: { ok: true, places: [] } };
    if (get && path === "/api/app/members") return { json: { members: [{ id: "u-asha", displayName: "Asha Rao", relationshipLabel: null, ageYears: null, isOwner: true, isYou: true }] } };
    if (get && path === "/api/app/scenarios") return { json: { scenario: { inputs: null, revision: 0 } } };
    if (get && path === "/api/app/payments/slots") return data(slotsView());
    if (method === "POST" && path === "/api/app/payments/order") return { status: 201, json: { ok: true, data: { orderId: "order_e2e_0001", amountPaise: 19900, currency: "INR", keyId: "rzp_test_e2e" } } };
    if (method === "POST" && path === "/api/app/payments/verify") {
      if (verifyDown) return { status: 502, json: { code: "BACKEND_UNREACHABLE", retryable: true } };
      payment.paid = true;
      return data({ ...slotsView(), paid: true });
    }
    if (get && path === "/api/app/integrations") return data({});
    if (get && path === "/api/app/documents") return { json: { ok: true, consent: wizard.consent, documents: [], policyType: null, largeUpload: false } };
    if (method === "POST" && path === "/api/app/documents/consent") { wizard.consent = true; return { json: { ok: true, consent: true } }; }
    if (method === "POST" && path === "/api/app/documents") {
      wizard.advances = 0;
      return { json: { ok: true, document: docView({ uploaded: "done", scanned: "active", reading: "pending", structured: "pending" }, true) } };
    }
    if (method === "POST" && path === `/api/app/documents/${WIZARD_DOCUMENT_ID}/advance`) {
      wizard.advances += 1;
      if (wizard.advances === 1) return { json: { ok: true, document: docView({ uploaded: "done", scanned: "done", reading: "active", structured: "pending" }, true) } };
      wizard.uploaded = true;
      return { json: { ok: true, document: docView({ uploaded: "done", scanned: "done", reading: "done", structured: "done" }, false) } };
    }
    if (get && path === "/api/app/covers/holdings") return data({ holdings: holdings(), creationIssues: [] });
    const m = /^\/api\/app\/covers\/holdings\/([^/]+)\/([a-z-]+)$/.exec(path);
    if (m) {
      const [, id, what] = m as unknown as [string, string, string];
      const holdingStatus = id === "h1" && long ? "conflicts" : "ready";
      if (get && what === "facts") return data({ holdingId: id, status: holdingStatus, facts: id === "h1" ? FACT_SPECS.map((f) => factView(f, long)) : [], unknownKeys: id === "h1" ? UNKNOWN_KEYS : [] });
      if (get && what === "conflicts") return data({ holdingId: id, status: holdingStatus, conflicts: id === "h1" && long ? conflictViews() : [] });
      if (get && what === "memory-document") return data({ holdingId: id, markdown: MEMORY_MARKDOWN });
      if (get && what === "documents") return data({ holdingId: id, documents: [{ documentId: `doc-${id}`, kind: "policy_schedule", factsState: "included" }] });
      if (get && what === "hospitals") return data({ hospitals: hospitalList(query.get("pincode") ?? "", long) });
      if (get && what === "passages") return data({ passages: [], insurerPassages: [] });
      if (get && what === "candidates") return data({ holdingId: id, profileVersion: 0, candidates: [{ candidateId: "c1", insurerName: "Example Insurer", productName: "Example Health Plan 01", rank: 1 }, { candidateId: "c2", insurerName: "Example Insurer", productName: "Example Family Floater 02", rank: 2 }] });
      if (method === "POST" && what === "confirm") { wizard.confirmed = true; return data({ holdingId: id, status: "ready", profileVersion: 1, replay: false }); }
    }
    if (get && path === "/api/app/covers/cover-memory") return data({ markdown: MEMORY_MARKDOWN });
    if (get && path === "/api/app/covers/declarations") return data({ declarations: [] });
    if (get && path === "/api/app/covers/premiums") return data({ premiums: [] });
    if (get && path === "/api/app/covers/premium-dues") return data({ dues: [] });
    return null;
  };

  // Registered first and matched last: anything that is not the dev server is refused so no real address is ever contacted.
  await page.route((url) => url.host !== baseHost && !/^(data|blob):/.test(url.protocol), async (route: Route) => {
    const u = new URL(route.request().url());
    unhandled.push(`EXTERNAL ${route.request().method()} ${u.host}${u.pathname}`);
    await route.abort();
  });

  // The backend's own API is never fulfilled: any browser call to it is refused and recorded, so it shows up in `unhandled`.
  await page.route("**/api/v1/**", async (route: Route) => {
    unhandled.push(`BACKEND ${route.request().method()} ${new URL(route.request().url()).pathname}`);
    await route.abort();
  });

  await page.route("**/api/app/**", async (route: Route) => {
    const req = route.request();
    const u = new URL(req.url());
    const hit = answer(req.method(), u.pathname, u.searchParams);
    if (hit) {
      await route.fulfill({ status: hit.status ?? 200, contentType: "application/json", body: JSON.stringify(hit.json) });
      return;
    }
    unhandled.push(`${req.method()} ${u.pathname}`);
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "NOT_FOUND" }) });
  });

  return { unhandled };
}
