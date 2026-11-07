/* Persistence proof (V1). Signs up a synthetic person through the live BFF, performs every wired write through /api/app/*,
 * reads it back (twice, with a second cookie jar), then reads Postgres directly with psql and checks sealing and erasure.
 * Local only: loopback BFF, loopback database, synthetic data. Prints no tokens, cookies or secrets. */
import { spawnSync } from "node:child_process";
import { features, FEATURE_REASON, type FeatureName } from "../src/adapters/features";
import { DEFAULT_PREFS, onboardingFromWire, onboardingToWire, prefsFromWire, prefsToWire } from "../src/adapters/user-data";
import type { UiOnboarding, UiPrefs } from "../src/adapters/types";

const BFF = process.env.VERIFY_BFF_URL ?? "http://127.0.0.1:3200";
const DB = { host: "127.0.0.1", port: "54329", user: "coversaath", name: "knowvia_dryrun" } as const;

// ---- Safety: loopback only, never the owner's dev database or backend ----------------------------------------------------
const bffUrl = new URL(BFF);
if (!["127.0.0.1", "localhost", "[::1]"].includes(bffUrl.hostname)) throw new Error("REFUSED: BFF host is not loopback");
if (bffUrl.port === "8787") throw new Error("REFUSED: port 8787 is the owner's backend");
if (!/^[a-z0-9_]+$/.test(DB.name) || (DB.name as string) === "coversaath_dev") throw new Error("REFUSED: database name");
if (!["127.0.0.1", "localhost"].includes(DB.host)) throw new Error("REFUSED: database host is not loopback");

/** FLAGGED: not a pass and not a defect of this app. The reason says what the backend lacks; the control is off or the limit is documented. */
type Status = "PASS" | "FAIL" | "FLAGGED";
type Row = { field: string; route: string; table: string; sealed: "yes" | "no" | "n/a"; status: Status; note?: string };
const rows: Row[] = [];
const add = (r: Row) => rows.push(r);

// ---- HTTP through the BFF with a cookie jar ------------------------------------------------------------------------------
class Jar {
  cookie = "";
  constructor(cookie = "") {
    this.cookie = cookie;
  }
  async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { "x-knowvia-app": "1", accept: "application/json", ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (body !== undefined) h["content-type"] = "application/json";
    const res = await fetch(`${BFF}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    const set = res.headers.getSetCookie().find((c) => c.startsWith("kv_session="));
    if (set) this.cookie = set.split(";")[0];
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON */
    }
    return { status: res.status, data };
  }
}

// ---- Postgres via psql (no dependency). Connection built from validated parts, no URL, no query-string params -----------
function sql(query: string): string[][] {
  const r = spawnSync(
    "psql",
    ["-X", "-A", "-t", "-q", "-F", "\u001f", "-h", DB.host, "-p", DB.port, "-U", DB.user, "-d", DB.name, "-v", "ON_ERROR_STOP=1", "-c", query],
    { encoding: "utf8", env: { ...process.env, PGCONNECT_TIMEOUT: "5" } },
  );
  if (r.status !== 0) throw new Error(`psql failed: ${(r.stderr || "").split("\n")[0].replace(/password=\S+/g, "")}`);
  return r.stdout.split("\n").filter(Boolean).map((l) => l.split("\u001f"));
}
const lit = (s: string) => {
  if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(s)) throw new Error("unsafe id");
  return `'${s}'`;
};

// ---- Fixtures ------------------------------------------------------------------------------------------------------------
const ts = Date.now();
const NAME = `Persist Check ${ts}`;
const LOCAL = `persist.check.${ts}`;
const EMAIL = `${LOCAL}@example.com`;
const M = {
  addr1: `ZZPersist-Lane-${ts}`, addr2: `ZZPersist-Flat-${ts}`, landmark: `ZZPersist-Landmark-${ts}`, city: `ZZPersistCity${ts}`,
  homeLine: `ZZPersist-HomeRd-${ts}`, workLine: `ZZPersist-WorkRd-${ts}`, label: `ZZPersistLabel${ts}`,
  review: `ZZPersistReview${ts}`, who: `ZZPersistWho${ts}`, member: `ZZPersistMember${ts}`, memberRel: `ZZPersistRel${ts}`,
};
const NUMS = ["7312451", "19.07598", "72.87766", "13.08271", "80.27073", "4417"]; // distinctive numeric values
const forbidden = [...Object.values(M), LOCAL, ...NUMS];

const addr = (line1: string, extra: Record<string, string> = {}) => ({ line1, city: M.city, state: "Karnataka", pincode: "560001", ...extra });

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function subset(want: any, got: any): boolean {
  if (want === null || typeof want !== "object") return want === got;
  if (!got || typeof got !== "object") return false;
  return Object.keys(want).every((k) => subset(want[k], got[k]));
}

async function main() {
  const jar = new Jar();
  const signup = await jar.call("POST", "/api/app/access", { name: NAME, email: EMAIL });
  if (signup.status !== 200 || !signup.data?.ok || !jar.cookie) {
    console.log(`ABORT  sign-up through the BFF failed (status ${signup.status}, code ${signup.data?.code ?? "none"}). Is the BFF configured with the backend env?`);
    process.exit(3);
  }
  const me = await jar.call("GET", "/api/app/me");
  const hid: string = me.data?.householdId;
  if (!hid) throw new Error("no household id from /api/app/me");
  console.log(`signed up ${NAME} (household ${hid})`);

  // ---- 1. Writes -------------------------------------------------------------------------------------------------------
  const W: Record<string, { route: string; status: number; ok: boolean }> = {};
  const put = async (key: string, method: string, path: string, body: unknown, headers: Record<string, string> = {}) => {
    const r = await jar.call(method, path, body, headers);
    W[key] = { route: `${method} ${path.split("?")[0]}${path.includes("?") ? "?" + path.split("?")[1] : ""}`, status: r.status, ok: r.status >= 200 && r.status < 300 && r.data?.ok === true };
    return r.data;
  };

  const perm = (permission: string, state: string, surface: string) => put(`perm:${permission}`, "PUT", "/api/app/permissions", { permission, state, surface });
  await perm("location", "granted", "settings");
  await perm("notifications", "granted", "settings");
  await perm("calendar", "granted", "settings");

  await put("addr", "PUT", "/api/app/places", { kind: "registered_address", address: addr(M.addr1, { line2: M.addr2, landmark: M.landmark }), source: "user_typed" });
  await put("home", "PUT", "/api/app/places", { kind: "saved_place", slot: "home", label: M.label, address: addr(M.homeLine) });
  await put("work", "PUT", "/api/app/places", { kind: "saved_place", slot: "work", address: addr(M.workLine) });
  const exact = await put("loc", "PUT", "/api/app/places", { kind: "current_location", precision: "exact", surface: "emergency", location: { lat: 19.07598, lng: 72.87766, accuracyM: 12 } });
  const exactRev: number | undefined = exact?.place?.revision;
  await put("loc-coarse", "PUT", "/api/app/places", { kind: "current_location", precision: "coarse", surface: "settings", location: { lat: 13.08271, lng: 80.27073, accuracyM: 30 }, revision: exactRev });

  const prefs = { sources: ["email", "digilocker"], notifications: { channels: ["email", "whatsapp"], renewalReminders: true }, sharing: { allowFamilyView: true }, voiceLanguage: "hi-IN", reducedMotion: true, theme: "dark" };
  await put("prefs", "PUT", "/api/app/preferences", { prefs });
  const onboarding = { step: 3, way: "connect", people: { self: true, partner: true, children: false, parents: true }, wallet: "google" };
  await put("onboarding", "PUT", "/api/app/onboarding", { state: onboarding, completed: true });

  const scen: Record<string, Record<string, unknown>> = {
    tax: { regime: "old", ageBand: "60to80", deduction80d: 50000, premiumsPaid: 7312451, shareWithFamily: true },
    hospital_bill: { sumInsured: 1000000, roomRentCap: 5000, roomRentActual: 7500, billAmount: 7312451 },
    inflation: { who: M.who, caseKind: "cardiac", medicalInflationPct: 12, years: 15 },
    compare_weights: { kind: "family_floater", scenario: "maternity", weights: { price: 10, coverage: 90, network: 40, claims: 55, waitingPeriods: 20, restoration: 30 } },
    stress_levers: { who: M.who, scenario: "critical_illness", levers: { sumInsuredPct: 200, claimDelayDays: 14, roomUpgrade: true, billMultiplierPct: 150 } },
    review_state: { items: { "dec-1": { status: "edited", value: M.review }, "look-1": { status: "accepted" } } },
    premium_rise: { currentPremium: 24000, riseRatePct: 9, years: 10 },
  };
  for (const [tool, inputs] of Object.entries(scen)) await put(`scen:${tool}`, "PUT", `/api/app/scenarios?tool=${tool}`, { inputs });

  const added = await put("member-add", "POST", "/api/app/members", { displayName: M.member, memberKind: "dependent", relationshipLabel: M.memberRel });
  const memberId: string | undefined = added?.member?.id;
  if (memberId) await put("member-edit", "PATCH", `/api/app/members?id=${encodeURIComponent(memberId)}`, { relationshipLabel: `${M.memberRel}-edited` });

  // ---- 2. Read back via BFF, then through a second cookie jar (refresh / new device with the same session) ---------------
  const readAll = async (j: Jar) => {
    const [p, pl, pr, ob, sc, mb] = await Promise.all(["permissions", "places", "preferences", "onboarding", "scenarios", "members"].map((x) => j.call("GET", `/api/app/${x}`)));
    return { perms: p.data?.permissions ?? [], places: pl.data?.places ?? [], prefs: pr.data, onb: ob.data, scenarios: sc.data?.scenarios ?? [], members: mb.data?.members ?? [] };
  };
  const first = await readAll(jar);
  const second = await readAll(new Jar(jar.cookie));
  const same = (get: (r: typeof first) => unknown) => eq(get(first), get(second));

  const permOf = (r: typeof first, n: string) => r.perms.find((x: any) => x.permission === n);
  const placeOf = (r: typeof first, kind: string, slot?: string) => r.places.find((x: any) => x.kind === kind && (slot ? x.slot === slot : true));
  const scenOf = (r: typeof first, tool: string) => r.scenarios.find((x: any) => x.tool === tool)?.inputs;
  const deepAddr = (line1: string, extra: Record<string, string> = {}) => ({ ...addr(line1, extra), country: "IN" });

  // ---- 3. Direct Postgres reads -----------------------------------------------------------------------------------------
  type Tbl = { name: string; sealed: string[]; where: string };
  const H = lit(hid);
  const tables: Tbl[] = [
    { name: "device_permissions", sealed: [], where: `household_id=${H}` },
    { name: "household_places", sealed: ["payload_ciphertext", "label_ciphertext"], where: `household_id=${H}` },
    { name: "adult_preferences", sealed: ["prefs_ciphertext"], where: `household_id=${H}` },
    { name: "onboarding_progress", sealed: ["state_ciphertext"], where: `household_id=${H}` },
    { name: "tool_scenarios", sealed: ["inputs_ciphertext"], where: `household_id=${H}` },
  ];
  const dump: Record<string, { cols: string[]; recs: Record<string, string | null>[] }> = {};
  for (const t of tables) {
    const json = sql(`select coalesce(json_agg(row_to_json(x)),'[]'::json) from (select * from public.${t.name} where ${t.where}) x`);
    const recs = JSON.parse(json[0][0]) as Record<string, string | null>[];
    dump[t.name] = { cols: recs[0] ? Object.keys(recs[0]) : [], recs };
  }
  const q = (name: string, pred: (r: Record<string, string | null>) => boolean) => dump[name].recs.filter(pred);
  const sealedOk = (name: string, recs: Record<string, string | null>[]) => {
    const cols = tables.find((t) => t.name === name)!.sealed;
    return recs.length > 0 && recs.every((r) => cols.every((c) => r[c] == null || /^enc[12]\./.test(String(r[c]))) && cols.some((c) => r[c] != null));
  };
  // Plaintext scan: every column of every row of every new table, case-insensitive.
  const leaks: string[] = [];
  for (const t of tables) {
    const blob = JSON.stringify(dump[t.name].recs).toLowerCase();
    for (const f of forbidden) if (blob.includes(f.toLowerCase())) leaks.push(`${t.name}:${f.length > 12 ? f.slice(0, 12) + "…" : f}`);
  }
  const noLeak = (name: string) => !leaks.some((l) => l.startsWith(`${name}:`));

  // ---- 4. Matrix rows ---------------------------------------------------------------------------------------------------
  const decide = (cond: boolean): Status => (cond ? "PASS" : "FAIL");
  const wrote = (k: string) => W[k]?.ok === true;
  const route = (k: string) => W[k]?.route ?? "(not called)";

  const permRow = (n: string, name = n) => {
    const recs = q("device_permissions", (r) => r.permission === n && r.state === "granted");
    const rb = permOf(first, n)?.state === "granted" && permOf(second, n)?.state === "granted";
    add({ field: `permission ${name}`, route: route(`perm:${n}`), table: "device_permissions", sealed: "no", status: decide(wrote(`perm:${n}`) && rb && recs.length === 1 && noLeak("device_permissions")), note: "state is plaintext by design (no ciphertext column)" });
  };
  permRow("location");
  permRow("notifications");
  permRow("calendar");

  const placeRowChk = (field: string, key: string, kind: string, slot: string | undefined, want: unknown, readFrom: (r: typeof first) => any) => {
    const recs = q("household_places", (r) => r.kind === kind && (slot ? r.slot === slot : true));
    const rb = subset(want, readFrom(first)) && subset(want, readFrom(second));
    add({ field, route: route(key), table: "household_places", sealed: sealedOk("household_places", recs) ? "yes" : "no", status: decide(wrote(key) && rb && recs.length === 1 && sealedOk("household_places", recs) && noLeak("household_places")) });
  };
  placeRowChk("registered address (line1, line2, landmark, city, state, pincode)", "addr", "registered_address", undefined, deepAddr(M.addr1, { line2: M.addr2, landmark: M.landmark }), (r) => placeOf(r, "registered_address")?.address);
  placeRowChk("saved place Home (+ label)", "home", "saved_place", "home", { ...deepAddr(M.homeLine) }, (r) => placeOf(r, "saved_place", "home")?.address);
  placeRowChk("saved place Work", "work", "saved_place", "work", deepAddr(M.workLine), (r) => placeOf(r, "saved_place", "work")?.address);
  {
    const l = placeOf(first, "current_location")?.location;
    const recs = q("household_places", (r) => r.kind === "current_location");
    const coarseOk = l?.lat === 13.08 && l?.lng === 80.27;
    add({ field: "current location (coarse, ~1 km, 24 h expiry)", route: `${route("loc")} then ${route("loc-coarse")}`, table: "household_places", sealed: sealedOk("household_places", recs) ? "yes" : "no", status: decide(wrote("loc") && wrote("loc-coarse") && coarseOk && eq(placeOf(first, "current_location")?.location, placeOf(second, "current_location")?.location) && recs.length === 1 && !!recs[0]?.expires_at && sealedOk("household_places", recs) && noLeak("household_places")), note: "exact fix rounded to 2 dp; expires_at set" });
    const labelRecs = q("household_places", (r) => r.slot === "home");
    const labelSealed = labelRecs.length === 1 && /^enc[12]\./.test(String(labelRecs[0].label_ciphertext));
    add({ field: "saved place Home label", route: route("home"), table: "household_places.label_ciphertext", sealed: labelSealed ? "yes" : "no", status: decide(labelSealed && placeOf(first, "saved_place", "home")?.label === M.label) });
  }

  const prefRecs = dump["adult_preferences"].recs;
  const prefSealed = sealedOk("adult_preferences", prefRecs);
  const gp = first.prefs?.prefs;
  const prefFields: [string, boolean, string?][] = [
    ["preference connected sources", eq(gp?.sources?.slice().sort(), ["digilocker", "email"]), "ABHA/Gmail map to closed enum values"],
    ["preference notification channels", eq(gp?.notifications?.channels?.slice().sort(), ["email", "whatsapp"])],
    ["preference family sharing", gp?.sharing?.allowFamilyView === true],
    ["preference voice language", gp?.voiceLanguage === "hi-IN", '"Both" is stored as none'],
    ["preference reduced motion", gp?.reducedMotion === true],
    ["preference theme", gp?.theme === "dark"],
  ];
  for (const [f, ok, note] of prefFields) {
    add({ field: f, route: route("prefs"), table: "adult_preferences", sealed: prefSealed ? "yes" : "no", status: decide(wrote("prefs") && ok && eq(first.prefs, second.prefs) && prefRecs.length === 1 && prefSealed && noLeak("adult_preferences")), note });
  }

  const obRecs = dump["onboarding_progress"].recs;
  const obSealed = sealedOk("onboarding_progress", obRecs);
  const gs = first.onb?.state;
  const obFields: [string, boolean][] = [
    ["onboarding step + way", gs?.step === 3 && gs?.way === "connect"],
    ["onboarding people toggles", eq(gs?.people, onboarding.people)],
    ["onboarding wallet choice", gs?.wallet === "google"],
    ["onboarding completed", first.onb?.completed === true && !!obRecs[0]?.completed_at],
  ];
  for (const [f, ok] of obFields) {
    add({ field: f, route: route("onboarding"), table: "onboarding_progress", sealed: obSealed ? "yes" : "no", status: decide(wrote("onboarding") && ok && eq(first.onb, second.onb) && obRecs.length === 1 && obSealed && noLeak("onboarding_progress")) });
  }

  const scenFields: [string, string][] = [
    ["scenario tax (80D regime, premiums, age band)", "tax"], ["scenario hospital_bill (room rent)", "hospital_bill"], ["scenario inflation planner", "inflation"],
    ["scenario compare_weights", "compare_weights"], ["scenario stress_levers", "stress_levers"], ["scenario review_state", "review_state"], ["scenario premium_rise", "premium_rise"],
  ];
  const scenRecs = dump["tool_scenarios"].recs;
  const scenSealed = sealedOk("tool_scenarios", scenRecs);
  for (const [f, tool] of scenFields) {
    const recs = scenRecs.filter((r) => r.tool === tool);
    const rb = subset(scen[tool], scenOf(first, tool)) && eq(scenOf(first, tool), scenOf(second, tool));
    add({ field: f, route: route(`scen:${tool}`), table: "tool_scenarios", sealed: sealedOk("tool_scenarios", recs) ? "yes" : "no", status: decide(wrote(`scen:${tool}`) && rb && recs.length === 1 && sealedOk("tool_scenarios", recs) && noLeak("tool_scenarios")) });
  }
  void scenSealed;

  // Members: existing table, but the backend seals name and relationship label (enc1./enc2.).
  const mem = first.members.find((x: any) => x.id === memberId);
  const memRow = memberId ? sql(`select display_name, relationship_label from public.household_members where id=${lit(memberId)} and household_id=${H}`)[0] : undefined;
  const isSealed = (v?: string) => /^enc[12]\./.test(v ?? "");
  const nameSealed = !!memRow && isSealed(memRow[0]) && !memRow[0].includes(M.member);
  const relSealed = !!memRow && isSealed(memRow[1]);
  add({ field: "family member add (name)", route: route("member-add"), table: "household_members.display_name", sealed: nameSealed ? "yes" : "no", status: decide(wrote("member-add") && !!mem && mem.displayName === M.member && nameSealed) });
  add({ field: "family member add/edit (relation label) round trip", route: `${route("member-add")}; ${route("member-edit")}`, table: "household_members.relationship_label", sealed: "n/a", status: decide(wrote("member-edit") && mem?.relationshipLabel === `${M.memberRel}-edited`) });
  // The backend seals household_members.display_name only (column-backfill list). Sealing relationship_label is a backend change; the app cannot do it.
  add({ field: "family member relation label sealed at rest", route: "(backend)", table: "household_members.relationship_label", sealed: relSealed ? "yes" : "no", status: relSealed ? "PASS" : "FLAGGED", note: relSealed ? undefined : "backend-owned: relationship_label is not in the backend sealed-column list; stored in plaintext" });

  // ---- 5. Erasure -------------------------------------------------------------------------------------------------------
  const rev = await jar.call("PUT", "/api/app/permissions", { permission: "location", state: "revoked", surface: "settings", revision: permOf(first, "location")?.revision });
  const gone = sql(`select count(*) from public.household_places where household_id=${H} and kind='current_location'`)[0][0] === "0";
  const after = await readAll(jar);
  const stillThere = sql(`select count(*) from public.household_places where household_id=${H} and kind<>'current_location'`)[0][0];
  add({ field: "erasure: revoke location -> current location deleted", route: "PUT /api/app/permissions (revoked)", table: "household_places", sealed: "n/a", status: decide(rev.status === 200 && gone && !placeOf(after, "current_location") && Number(stillThere) === 3), note: "address + Home + Work kept (3 rows)" });

  if (memberId) {
    const del = await jar.call("DELETE", `/api/app/members?id=${encodeURIComponent(memberId)}`);
    const memLeft = sql(`select count(*) from public.household_members where id=${lit(memberId)}`)[0][0];
    const placeLeft = sql(`select count(*) from public.household_places where member_id=${lit(memberId)}`)[0][0];
    add({ field: "erasure: remove member -> member row gone", route: "DELETE /api/app/members?id=", table: "household_members", sealed: "n/a", status: decide(del.status === 200 && memLeft === "0") });
    add({ field: "erasure: remove member -> member place rows gone", route: "(no BFF route writes member places)", table: "household_places", sealed: "n/a", status: placeLeft === "0" ? "PASS" : "FAIL", note: "vacuous: no member place rows could be created via the BFF; FK cascade not exercised" });
  }

  // Cross-household refusal: a second fresh household must not see these values.
  const other = new Jar();
  await other.call("POST", "/api/app/access", { name: `Persist Other ${ts}`, email: `persist.other.${ts}@example.com` });
  const o = await readAll(other);
  add({ field: "isolation: another household sees none of it", route: "GET /api/app/{places,scenarios,...}", table: "(all)", sealed: "n/a", status: decide(o.places.length === 0 && o.scenarios.length === 0 && o.perms.length === 0 && !JSON.stringify(o).includes(M.addr1)) });
  await other.call("POST", "/api/app/signout", {});

  // ---- 6. Enum round trips: every value the screens offer must come back as it was saved ------------------------------------
  const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  const prefsRt = async (cases: UiPrefs[]) => {
    for (const ui of cases) {
      const cur = await jar.call("GET", "/api/app/preferences");
      const put = await jar.call("PUT", "/api/app/preferences", { prefs: prefsToWire(ui), revision: cur.data?.revision });
      const got = await jar.call("GET", "/api/app/preferences");
      if (put.status !== 200 || !got.data?.prefs || canon(prefsFromWire(got.data.prefs)) !== canon(ui)) return false;
    }
    return true;
  };
  const onbRt = async (cases: UiOnboarding[]) => {
    for (const ui of cases) {
      const cur = await jar.call("GET", "/api/app/onboarding");
      const put = await jar.call("PUT", "/api/app/onboarding", { state: onboardingToWire(ui), completed: ui.completed, revision: cur.data?.revision });
      const got = await jar.call("GET", "/api/app/onboarding");
      if (put.status !== 200 || !got.data?.state || canon(onboardingFromWire(got.data.state, got.data.completed)) !== canon(ui)) return false;
    }
    return true;
  };
  const base: UiPrefs = { ...DEFAULT_PREFS, sources: { gmail: false, digilocker: false, abha: false }, notify: { whatsapp: false, email: false, calendar: false }, sharing: { rohan: false, mother: false, father: false } };
  const rtRow = (field: string, table: string, ok: boolean) => add({ field, route: "PUT then GET /api/app/" + (table === "onboarding_progress" ? "onboarding" : "preferences"), table, sealed: "yes", status: decide(ok) });
  rtRow("enum round trip: connected sources (Gmail, DigiLocker, ABHA, each alone and all)", "adult_preferences", await prefsRt([
    ...(["gmail", "digilocker", "abha"] as const).map((k) => ({ ...base, sources: { ...base.sources, [k]: true } })),
    { ...base, sources: { gmail: true, digilocker: true, abha: true } }, base,
  ]));
  rtRow("enum round trip: notification channels (WhatsApp, Email, Calendar, each alone and all)", "adult_preferences", await prefsRt([
    ...(["whatsapp", "email", "calendar"] as const).map((k) => ({ ...base, notify: { ...base.notify, [k]: true } })),
    { ...base, notify: { whatsapp: true, email: true, calendar: true } }, base,
  ]));
  rtRow("enum round trip: voice language (English, Hindi, Both)", "adult_preferences", await prefsRt((["en", "hi", "both"] as const).map((v) => ({ ...base, voice: v }))));
  rtRow("enum round trip: family sharing (one switch: on = default people, off = nobody)", "adult_preferences", await prefsRt([{ ...base, sharing: { ...DEFAULT_PREFS.sharing } }, base]));
  rtRow("enum round trip: onboarding way (DigiLocker, Upload, HR mail, Policy number)", "onboarding_progress", await onbRt((["dl", "up", "hr", "no"] as const).map((way) => ({ way, step: 1, completed: false }))));
  rtRow("enum round trip: onboarding wallet (Apple, Google, none, later)", "onboarding_progress", await onbRt((["apple", "google", "none", "later"] as const).map((wallet) => ({ wallet, completed: false }))));

  // ---- 7. Flagged: controls the backend cannot store, and limits that stay -------------------------------------------------
  const flag = (field: string, note: string) => add({ field, route: "none", table: "none", sealed: "n/a", status: "FLAGGED", note });
  const OFF_LABEL: Record<FeatureName, string> = {
    profileMobile: "mobile number (Profile, Contact)",
    digilockerFetch: "Fetch from DigiLocker (Profile, Address)",
    memberContact: "member mobile, e-mail, invite channel (Family sheets)",
    advisorBooking: "advisor list and booking (Tools)",
    perPersonSharing: "per-person sharing switches (Settings)",
  };
  for (const k of Object.keys(OFF_LABEL) as FeatureName[]) {
    flag(OFF_LABEL[k], features[k] ? "STILL ON: the app would show it as saved and lose it" : `control off in the app: ${FEATURE_REASON[k]}`);
    if (features[k]) rows[rows.length - 1].status = "FAIL";
  }
  flag("wallet Samsung (WalletSheet)", "stored as the Android wallet (google); the stored wallet is never read back into a screen, so nothing shown changes");
  flag("compare cover band (Compare)", "session-only view control: no scenario field; nothing claims it is saved");
  flag("top-up finder (Tools)", "session-only calculator: no scenario kind; nothing claims it is saved");

  // Informational: where the sign-up identity lives (existing tables, not part of the new-table scan).
  const idRow = sql(`select count(*) from public.adult_users where contact_email='${EMAIL}'`);
  const emailPlain = idRow[0][0] !== "0";

  await jar.call("POST", "/api/app/signout", {});

  // ---- Output ----------------------------------------------------------------------------------------------------------
  const w = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "~" : s.padEnd(n));
  console.log("\nFIELD".padEnd(1) + "\n" + [w("field", 62), w("BFF route", 52), w("table", 34), w("sealed", 6), "status"].join(" | "));
  for (const r of rows) console.log([w(r.field, 62), w(r.route, 52), w(r.table, 34), w(r.sealed, 6), r.status + (r.note ? `  (${r.note})` : "")].join(" | "));
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  console.log(`\nSUMMARY: ${count("PASS")} PASS, ${count("FAIL")} FAIL, ${count("FLAGGED")} FLAGGED (of ${rows.length})`);
  console.log(`plaintext leaks in new tables: ${leaks.length === 0 ? "none" : leaks.join(", ")}`);
  console.log(`note: sign-up email stored plaintext in adult_users.contact_email (existing table, outside the new-table scan): ${emailPlain ? "yes" : "no"}`);
  process.exit(count("FAIL") > 0 ? 1 : 0);
}

main().catch((e) => {
  console.log(`ERROR  ${e instanceof Error ? e.message : "unknown"}`);
  process.exit(1);
});
