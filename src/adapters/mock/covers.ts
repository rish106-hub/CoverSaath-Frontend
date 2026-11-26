import { AdapterError, type CoversAdapter } from "../types";
import { MAX_UPLOAD_BYTES, POLICY_TYPES } from "../documents-contract";
import { precheck } from "../uploads";
import { containsUin, type Conflicts, type HoldingSummary, type WordingState, type CreationIssue, type DeclarationView, type DueView, type Facts, type PremiumView } from "../covers-contract";
import { PINCODE, type HospitalView } from "../chat-contract";
import { delay } from "./delay";

// In-memory stand-in for the cover routes, with the same rules as the BFF: PDF only, 4 MB cap, a coded error for each refusal, a
// stale profile version refused, a conflict settled once. Fictional insurer and plans. No UIN anywhere. Facts are
// `extracted_unverified` until a person chooses, as on the real path.

const quote = (page: number, text: string) => ({ pageId: `page-${page}`, blockIndex: 0, quote: text });
/** A term only the insurer's wording states (ADR 0036): tier ida_wording, extracted_unverified, with the insurer's page and a quote. No insurer is named: any insurer looks the same. */
const INSURER_FACT: Facts["facts"][number] = {
  factKey: "pre_hospitalisation_days", factClass: "product_term", valueType: "number", unit: "days", group: "cover", status: "extracted_unverified", value: 60, sourceTier: "ida_wording", alternatives: [], checkWithInsurer: true, openConflictId: null,
  sources: [{ id: "s-pre-ida", tier: "ida_wording", status: "extracted_unverified", value: 60, page: null, quote: "Medical expenses incurred for up to 60 days before the date of admission are covered.", reference: { source: "fss", pageNumber: 9, verificationStatus: "unverified" }, current: true }],
};
const factsSeed = (wording: WordingState): Facts["facts"] => [
  { factKey: "sum_insured", factClass: "personal_value", valueType: "money", unit: "paise", group: "limits", status: "extracted_unverified", value: 50_000_000, sourceTier: "own_pdf", alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-si-own", tier: "own_pdf", status: "extracted_unverified", value: 50_000_000, page: { pageId: "page-1", pageNumber: 1, blockIndex: 0, documentKind: "policy_schedule" }, quote: "Sum insured Rs 5,00,000", current: true }] },
  { factKey: "room_rent_limit", factClass: "product_term", valueType: "text", unit: "none", group: "limits", status: "conflicting", value: null, alternatives: [], checkWithInsurer: true, openConflictId: "c-room", sources: [] },
  wording === "fss"
    ? { factKey: "initial_waiting_days", factClass: "product_term", valueType: "number", unit: "days", group: "waiting", status: "reviewed_reference", value: 30, sourceTier: "ida_wording", alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-iw-own", tier: "own_pdf", status: "extracted_unverified", value: 30, page: { pageId: "page-2", pageNumber: 2, blockIndex: 1 }, quote: "30 days from the start date", current: true }, { id: "s-iw-ida", tier: "ida_wording", status: "reviewed_reference", value: 30, page: null, quote: "A waiting period of 30 days applies.", current: true }] }
    : { factKey: "initial_waiting_days", factClass: "product_term", valueType: "number", unit: "days", group: "waiting", status: "extracted_unverified", value: 30, sourceTier: "own_pdf", alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-iw-own", tier: "own_pdf", status: "extracted_unverified", value: 30, page: { pageId: "page-2", pageNumber: 2, blockIndex: 1 }, quote: "30 days from the start date", current: true }] },
  { factKey: "ped_waiting_months", factClass: "product_term", valueType: "number", unit: "months", group: "waiting", status: "extracted_unverified", value: 36, sourceTier: "own_pdf", alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-ped-own", tier: "own_pdf", status: "extracted_unverified", value: 36, page: { pageId: "page-2", pageNumber: 2, blockIndex: 4 }, quote: "36 months for pre-existing diseases", current: true }] },
  { factKey: "exclusion_cosmetic", factClass: "product_term", valueType: "bool", unit: "none", group: "exclusions", status: "extracted_unverified", value: true, sourceTier: "own_pdf", alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-ex-own", tier: "own_pdf", status: "extracted_unverified", value: true, page: { pageId: "page-3", pageNumber: 3, blockIndex: 2 }, quote: "Cosmetic treatment is not covered", current: true }] },
  { factKey: "cashless_network", factClass: "product_term", valueType: "bool", unit: "none", group: "cashless", status: "extracted_unverified", value: true, sourceTier: "own_pdf", alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-cl-own", tier: "own_pdf", status: "extracted_unverified", value: true, page: { pageId: "page-1", pageNumber: 1, blockIndex: 6 }, quote: "Cashless at network hospitals", current: true }] },
  ...(wording === "fss" ? [INSURER_FACT] : []),
  { factKey: "premium_total", factClass: "personal_value", valueType: "money", unit: "paise", group: "money", status: "extracted_unverified", value: 1_850_000, sourceTier: "own_pdf", alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-pr-own", tier: "own_pdf", status: "extracted_unverified", value: 1_850_000, page: { pageId: "page-1", pageNumber: 1, blockIndex: 9 }, quote: "Total premium Rs 18,500", current: true }] },
];
const conflictsSeed = (wording: WordingState): Conflicts["conflicts"] => [
  wording === "fss"
    ? { id: "c-room", factKey: "room_rent_limit", factClass: "product_term", valueType: "text", reason: "own_vs_insurer", kind: "own_vs_insurer", resolution: "pending", resolvedAt: null, resolvingFactId: null, checkWithInsurer: true, candidates: [
      { id: "f-room-own", tier: "own_pdf", source: "own_document", documentName: "Your schedule", pageNumber: 3, status: "extracted_unverified", value: "1 percent of the sum insured per day", ...quote(3, "Room rent up to 1% of the sum insured per day"), current: true },
      { id: "f-room-ida", tier: "ida_wording", source: "reviewed_reference", documentName: "Insurer terms", pageNumber: 12, verificationStatus: "verified", status: "reviewed_reference", value: "2 percent of the sum insured per day", page: null, quote: "Room rent is limited to 2% of the sum insured per day.", current: true },
    ] }
    : { id: "c-room", factKey: "room_rent_limit", factClass: "product_term", valueType: "text", reason: "own_vs_insurer", resolution: "pending", resolvedAt: null, resolvingFactId: null, checkWithInsurer: true, candidates: [
      { id: "f-room-own", tier: "own_pdf", status: "extracted_unverified", value: "1 percent of the sum insured per day", ...quote(2, "Room rent up to 1% of the sum insured per day"), current: true },
      { id: "f-room-ida", tier: "ida_wording", status: "reviewed_reference", value: "2 percent of the sum insured per day", page: null, quote: "Room rent is limited to 2% of the sum insured per day.", current: true },
    ] },
];

type State = { facts: Facts["facts"]; conflicts: Conflicts["conflicts"]; status: Facts["status"]; version: number; confirmed: string | null; key: string | null; wording: WordingState; handoffOpen?: boolean; pullPending?: boolean };
const holdings = new Map<string, { documentId: string; state: State; linked: { documentId: string; kind: string }[] }>();
const docs = new Map<string, string>();
/** Test hook: documents the mock backend could not make a holding from. */
const issues = new Map<string, CreationIssue>();
/** Test hook: `pending` mirrors the backend's few seconds after ready (wording `missing`, reason `pending`) while the insurer pack is pulled. An FSS handoff open for this holding (wording `missing`, reason `not_checked`). `finish` flips it to the insurer's wording (`fss`) with its facts. */
export const setMockHandoff = (holdingId: string, mode: "open" | "pending" | "finish"): void => {
  const h = holdings.get(holdingId);
  if (!h) return;
  if (mode === "open") { h.state.wording = "missing"; h.state.handoffOpen = true; h.state.facts = factsSeed("missing"); h.state.conflicts = conflictsSeed("missing"); return; }
  if (mode === "pending") { h.state.wording = "missing"; h.state.handoffOpen = false; h.state.pullPending = true; h.state.facts = factsSeed("missing"); h.state.conflicts = conflictsSeed("missing"); return; }
  h.state.handoffOpen = false; h.state.pullPending = false; h.state.wording = "fss"; h.state.facts = factsSeed("fss"); h.state.conflicts = conflictsSeed("fss");
};
export const setMockCreationIssue = (documentId: string, state: CreationIssue["state"] | null): void => {
  if (state) issues.set(documentId, { documentId, state, code: state === "failed" ? "HOLDING_CREATE_FAILED" : null });
  else issues.delete(documentId);
};
let n = 0;
let seq = 0;
const declarations: DeclarationView[] = [];
const premiums: PremiumView[] = [];
const dues: DueView[] = [];

// Fictional hospitals for two seeded pincodes. Anything else has no network hospital, which is a valid answer.
const HOSPITALS: Record<string, HospitalView[]> = {
  "400053": [
    { id: "hosp-ex-1", name: "Example City Hospital", address: "12 Example Road, Andheri West", city: "Mumbai", pincode: "400053", cashless: true },
    { id: "hosp-ex-2", name: "Northwind General Hospital", address: "4 Sample Lane, Andheri West", city: "Mumbai", pincode: "400053", cashless: true },
    { id: "hosp-ex-3", name: "Lakeside Care Centre", address: "88 Lake View Marg, Andheri West", city: "Mumbai", pincode: "400053", cashless: false },
  ],
  "110001": [{ id: "hosp-ex-4", name: "Example Central Hospital", address: "1 Example Chowk", city: "New Delhi", pincode: "110001", cashless: true }],
};

const CANDIDATES = [
  { candidateId: "product-example-01", insurerName: "Example Insurer", productName: "Example Health Plan 01", rank: 1 },
  { candidateId: "product-example-02", insurerName: "Example Insurer", productName: "Example Health Plus 02", rank: 2 },
  { candidateId: "product-example-03", insurerName: "Northwind Health", productName: "Northwind Family Cover 03", rank: 3 },
];
/** Which insurer-terms state each plan lands in, so every state has a mock case: plan 01 attached, plan 02 not attached, plan 03 added by the person. */
const WORDING_OF_CANDIDATE: Record<string, WordingState> = { "product-example-01": "fss", "product-example-02": "missing", "product-example-03": "manual" };
const SEED_PERIOD = { startIso: "2026-04-01", endIso: "2027-03-31", days: 365 };
/** Names only once the product is confirmed, as on the backend. Headlines come from the seeded facts; the period is read, not confirmed. */
const summaryOf = (s: State): HoldingSummary => {
  const cand = CANDIDATES.find((c) => c.candidateId === s.confirmed);
  const money = (key: "sum_insured" | "premium_total") => {
    const f = s.facts.find((x) => x.factKey === key);
    return f ? { factKey: key, value: typeof f.value === "number" ? { amountMinor: f.value, currency: "INR" } : null, status: f.status } : null;
  };
  const read = s.facts.length > 0;
  return {
    insurerName: cand?.insurerName ?? null,
    productName: cand?.productName ?? null,
    sumInsured: money("sum_insured"),
    policyPeriod: read ? { factKey: "policy_period", value: SEED_PERIOD, status: "extracted_unverified" } : null,
    premium: money("premium_total"),
    wordingState: s.wording,
    wordingReason: s.wording === "fss" ? null : s.wording === "missing" ? (s.handoffOpen ? "not_checked" : s.pullPending ? "pending" : "no_match") : null,
  };
};
const get = (id: string) => {
  const h = holdings.get(id);
  if (!h) throw new AdapterError("NOT_FOUND");
  return h;
};
const guard = <T>(v: T): T => {
  if (containsUin(v)) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return v;
};

/** policy.md as the backend renders it (ADR 0039), from the seeded facts. Insurer-tier lines carry the insurer label, page and quote. FOR LEGAL REVIEW: reader-facing wording is not final. */
const label = (key: string): string => { const w = key.replace(/_/g, " "); return w.charAt(0).toUpperCase() + w.slice(1); };
const plain = (v: unknown, unit?: string | null): string => (typeof v === "number" ? (unit === "paise" ? `Rs ${v / 100}` : unit === "days" ? `${v} days` : unit === "months" ? `${v} months` : String(v)) : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "Not found"));
// Section names and order are the backend's MEMORY_DOCUMENT_SECTIONS. FOR LEGAL REVIEW: the reader-facing wording below mirrors the backend's draft wording.
const INSURER_BLOCK = "Insurer terms your document doesn't state";
const MEMORY_SECTIONS = ["Policy", "People covered", "Cover and limits", "Waiting periods", "Exclusions", INSURER_BLOCK, "Declared conditions", "Premiums and dues", "Conflicts to resolve", "Open questions"] as const;
const SECTION_OF_GROUP: Record<string, (typeof MEMORY_SECTIONS)[number]> = { waiting: "Waiting periods", exclusions: "Exclusions", declarations: "Declared conditions", premium: "Premiums and dues", payment: "Premiums and dues" };
function memoryMarkdown(state: State): string {
  const cite = (f: Facts["facts"][number]): { quote: string; tag: string } => {
    const src = f.sources.find((x) => x.tier === f.sourceTier) ?? f.sources[0];
    const quote = src?.quote ? ` Quote: "${src.quote}"` : "";
    if (f.sourceTier === "ida_wording" && src?.reference?.pageNumber) return { quote, tag: `[insurer_wording, p.${src.reference.pageNumber}, clause 4.2]` };
    const pageNumber = src?.page?.pageNumber ?? Number(/\d+$/.exec(src?.page?.pageId ?? "")?.[0] ?? 0);
    return { quote, tag: pageNumber ? `[${src?.page?.documentKind ?? "policy_schedule"}, p.${pageNumber}]` : "[unknown]" };
  };
  const line = (f: Facts["facts"][number]): string => {
    if (f.status === "conflicting") return `- ${label(f.factKey)} Not settled: two readings disagree, see Conflicts to resolve. [unknown]`;
    const { quote, tag } = cite(f);
    const status = f.status === "reviewed_reference" ? " (insurer wording)" : f.status === "user_confirmed" ? " (you stated this)" : f.sourceTier === "ida_wording" ? " (From the insurer's wording, not checked)" : " (read from your document, not verified)";
    return `- ${label(f.factKey)} ${plain(f.value, f.unit)}${status}${f.checkWithInsurer ? " Check with the insurer." : ""}${quote} ${tag}`;
  };
  const sections = new Map<string, string[]>(MEMORY_SECTIONS.map((name) => [name, []]));
  for (const f of state.facts) {
    const insurerOnly = f.sourceTier === "ida_wording" && f.status === "extracted_unverified" && !f.sources.some((x) => x.tier === "own_pdf");
    sections.get(insurerOnly ? INSURER_BLOCK : SECTION_OF_GROUP[f.group ?? ""] ?? "Cover and limits")?.push(line(f));
  }
  sections.set("Policy", [`- Insurer: ${state.confirmed ? "Example Insurer" : "unknown"} ${state.confirmed ? "[owner statement]" : "[unknown]"}`, `- Product: ${state.confirmed ? "Example Health Plan" : "unknown"} ${state.confirmed ? "[owner statement]" : "[unknown]"}`, "- Policy number: XXXXXX1234 [policy record]"]);
  sections.set("People covered", state.facts.length > 0 ? ["- Example Member (self), adult [policy_schedule, p.1]"] : []);
  sections.set("Declared conditions", declarations.map((d) => `- Example Member: ${d.label} (${d.kind.replace(/_/g, " ")}) [owner statement]`));
  sections.set("Premiums and dues", [...sections.get("Premiums and dues") ?? [], ...premiums.map((p) => `- Premium paid ${p.paidOn}: Rs ${p.amountPaise / 100} [owner statement]`)]);
  sections.set("Conflicts to resolve", state.conflicts.filter((c) => c.resolution === "pending").map((c) => `- ${label(c.factKey)} Readings: ${c.candidates.map((x) => `${String(x.value)} [${x.tier === "ida_wording" ? "insurer_wording" : "policy_schedule"}, p.${"pageNumber" in x && x.pageNumber ? x.pageNumber : 3}]`).join("; ")} Check with the insurer. [unknown]`));
  sections.set("Open questions", state.facts.length > 0 ? ["- Co-payment [unknown]"] : []);
  return [
    "# Memory", "",
    "> Built from your own documents and answers, shown only to you. Values read from your documents are not verified. The insurer's wording governs; check with the insurer before relying on any line. (Draft wording, FOR LEGAL REVIEW.)", "",
    "Generated 2026-11-25. Policy number shown by its last 4 characters only.",
    ...MEMORY_SECTIONS.flatMap((name) => ["", `## ${name}`, "", ...((sections.get(name)?.length ?? 0) > 0 ? sections.get(name) ?? [] : ["- None recorded. [unknown]"])]),
    "",
  ].join("\n");
}

const COVER_MEMORY_SECTIONS = ["At a glance", "Policies", "People covered", "Premiums and renewals", "Cover and limits", "Waiting periods", "Exclusions, terms and key clauses", "OPD, vaccination and wellness", "Claims, TPA and network hospitals", "Contacts and helplines", "Declarations and consistency", "Differences between policies", "Open questions and conflicts", "Where this comes from"];

/** Synthetic household cover memory in the backend's order: a title, then 14 sections with one or two policy-tagged lines each. */
function coverMemoryMarkdown(): string {
  return [
    "# Household Cover Memory", "",
    ...COVER_MEMORY_SECTIONS.flatMap((name) => ["", `## ${name}`, "", name === "Contacts and helplines" ? "- [Policy A] Insurer helpline 1800-000-0001 [owner statement]" : "- [Policy A] Example Health Plan 01 entry for this section [owner statement]", "- [Policy B] Example Family Floater entry for this section [owner statement]"]),
    "",
  ].join("\n");
}

export const mockCovers: CoversAdapter = {
  coverMemory: async () => delay(coverMemoryMarkdown()),
  memoryDocument: async (holdingId) => delay(memoryMarkdown(get(holdingId).state)),
  uploadDocument: async (file, key, kind, policyType, onStage) => {
    onStage?.("sending");
    const pre = precheck(file, MAX_UPLOAD_BYTES);
    if (pre) throw new AdapterError(pre);
    if (!POLICY_TYPES.includes(policyType)) throw new AdapterError("POLICY_TYPE_INVALID");
    n += 1;
    const documentId = `doc-mock-${n}`;
    docs.set(documentId, kind);
    // As on the backend, every uploaded document gets a holding of its own; the schedule's is the one the person works with.
    holdings.set(`holding-mock-${n}`, { documentId, state: { facts: [], conflicts: [], status: "uploaded", version: 0, confirmed: null, key: null, wording: "missing" }, linked: [{ documentId, kind: "schedule" }] });
    void key;
    return delay({ documentId });
  },
  resumeDocument: async (documentId, onStage) => {
    onStage?.("details");
    return delay({ documentId, busy: false });
  },
  holdingFor: async (documentId) => {
    if (issues.get(documentId)?.state === "failed") throw new AdapterError("HOLDING_CREATE_FAILED");
    return delay([...holdings].find(([, h]) => h.documentId === documentId)?.[0] ?? null);
  },
  upload: async (file, key, opts) => {
    const { documentId } = await mockCovers.uploadDocument(file, key, opts.kind, opts.policyType);
    return { documentId, holdingId: await mockCovers.holdingFor(documentId) };
  },
  holdingDocuments: async (holdingId) => {
    const h = get(holdingId);
    return delay({ holdingId, documents: structuredClone(h.linked) });
  },
  linkDocument: async (holdingId, input) => {
    const h = get(holdingId);
    if (!docs.has(input.documentId)) throw new AdapterError("NOT_FOUND");
    const kind = input.kind ?? "wording";
    const linked = !h.linked.some((d) => d.documentId === input.documentId);
    if (linked) h.linked.push({ documentId: input.documentId, kind });
    // The person's own wording: the terms are now theirs, unless the insurer's were already attached.
    if (kind === "wording" && h.state.wording === "missing") h.state.wording = "manual";
    return delay({ holdingId, documentId: input.documentId, kind, linked });
  },
  holdingsView: async () => ({ holdings: await mockCovers.holdings(), creationIssues: [...issues.values()] }),
  holdings: () => delay([...holdings].map(([id, h]) => ({ id, documentId: h.documentId, kind: docs.get(h.documentId) ?? "policy_wording", status: h.state.status, summary: summaryOf(h.state) }))),
  candidates: async (holdingId) => {
    const h = get(holdingId);
    if (h.state.status === "uploaded") h.state.status = "insurer_pending";
    return delay(guard({ holdingId, profileVersion: h.state.version, candidates: CANDIDATES }));
  },
  confirmProduct: async (holdingId, statement, key) => {
    const h = get(holdingId);
    if (h.state.key === key) return delay({ holdingId, status: h.state.status, profileVersion: h.state.version, replay: true });
    if (statement.expectedVersion !== h.state.version) throw new AdapterError("POLICY_PROFILE_VERSION_CONFLICT");
    if (!statement.candidateId) throw new AdapterError("INVALID_INPUT");
    h.state.version += 1;
    h.state.key = key;
    h.state.confirmed = statement.candidateId;
    h.state.wording = WORDING_OF_CANDIDATE[statement.candidateId] ?? "missing";
    h.state.facts = factsSeed(h.state.wording);
    h.state.conflicts = conflictsSeed(h.state.wording);
    h.state.status = "conflicts";
    return delay({ holdingId, status: h.state.status, profileVersion: h.state.version, replay: false });
  },
  facts: async (holdingId) => {
    const h = get(holdingId);
    return delay(guard({ holdingId, status: h.state.status, facts: structuredClone(h.state.facts), unknownKeys: ["copay_percent"] }));
  },
  conflicts: async (holdingId) => {
    const h = get(holdingId);
    return delay(guard({ holdingId, status: h.state.status, conflicts: structuredClone(h.state.conflicts) }));
  },
  resolveConflict: async (holdingId, conflictId, choice) => {
    const h = get(holdingId);
    const c = h.state.conflicts.find((x) => x.id === conflictId);
    if (!c) throw new AdapterError("NOT_FOUND");
    if (c.resolution !== "pending") throw new AdapterError("CONFLICT_ALREADY_RESOLVED");
    const picked = c.candidates.find((x) => x.id === choice.chosenFactId);
    if (!picked) throw new AdapterError("INVALID_INPUT");
    c.resolution = "user_chose";
    c.resolvedAt = new Date().toISOString();
    c.resolvingFactId = `decl-${conflictId}`;
    const fact = h.state.facts.find((f) => f.factKey === c.factKey);
    if (fact) {
      fact.status = "user_confirmed";
      fact.value = picked.value;
      fact.openConflictId = null;
      fact.sourceTier = "user_declaration";
    }
    if (h.state.conflicts.every((x) => x.resolution !== "pending")) h.state.status = "ready";
    return delay({ conflictId, resolvingFactId: `decl-${conflictId}`, status: "user_confirmed" as const, holdingStatus: h.state.status, replay: false });
  },
  confirmReading: async (holdingId, factId) => {
    const h = get(holdingId);
    const fact = h.state.facts.find((f) => f.sources.some((x) => x.id === factId));
    const src = fact?.sources.find((x) => x.id === factId);
    if (!fact || !src || src.current === false || src.tier === "user_declaration") throw new AdapterError("NOT_FOUND");
    if (src.tier === "ida_wording" && !src.quote) throw new AdapterError("NOT_FOUND");
    const id = `decl-${factId}`;
    const replay = fact.sources.some((x) => x.id === id);
    if (!replay) fact.sources.push({ id, tier: "user_declaration", status: "user_confirmed", value: src.value, page: null, quote: null, captureMethod: "reading_confirm", current: true });
    fact.status = "user_confirmed";
    fact.value = src.value;
    fact.sourceTier = "user_declaration";
    return delay({ factId: id, factKey: fact.factKey, status: "user_confirmed" as const, replay });
  },
  declarations: (memberId) => delay(structuredClone(declarations.filter((d) => !memberId || d.memberId === memberId))),
  addDeclaration: async (input) => {
    const row: DeclarationView = { id: `declaration-mock-${++seq}`, memberId: input.memberId, holdingId: input.holdingId ?? null, kind: input.kind, label: input.label, declaredOn: input.declaredOn ?? null, declaredToInsurer: input.declaredToInsurer ?? null, revision: 1 };
    declarations.push(row);
    return delay(structuredClone(row));
  },
  updateDeclaration: async (declarationId, input) => {
    const row = declarations.find((d) => d.id === declarationId);
    if (!row) throw new AdapterError("NOT_FOUND");
    if (input.ifMatch !== undefined && input.ifMatch !== row.revision) throw new AdapterError("REVISION_CONFLICT");
    row.label = input.label;
    row.declaredOn = input.declaredOn ?? null;
    row.declaredToInsurer = input.declaredToInsurer ?? null;
    row.revision = (row.revision ?? 0) + 1;
    return delay(structuredClone(row));
  },
  deleteDeclaration: async (declarationId) => {
    const i = declarations.findIndex((d) => d.id === declarationId);
    if (i < 0) throw new AdapterError("NOT_FOUND");
    declarations.splice(i, 1);
    return delay(undefined);
  },
  premiums: (holdingId) => delay(structuredClone(premiums.filter((p) => !holdingId || p.holdingId === holdingId))),
  addPremium: async (input) => {
    const row: PremiumView = { id: `premium-mock-${++seq}`, holdingId: input.holdingId, amountPaise: input.amountPaise, paidOn: input.paidOn, channel: input.channel ?? "unknown", paidVia: input.paidVia ?? "self", agentName: input.agentName ?? null, agentCode: input.agentCode ?? null };
    premiums.push(row);
    return delay(structuredClone(row));
  },
  deletePremium: async (paymentId) => {
    const i = premiums.findIndex((p) => p.id === paymentId);
    if (i < 0) throw new AdapterError("NOT_FOUND");
    premiums.splice(i, 1);
    return delay(undefined);
  },
  premiumDues: (filter = {}) => delay(structuredClone(dues.filter((d) => (!filter.holdingId || d.holdingId === filter.holdingId) && (!filter.state || d.state === filter.state)))),
  // One due per holding and day: a repeat returns the existing one, as the backend does.
  addPremiumDue: async (input) => {
    const same = dues.find((d) => d.holdingId === input.holdingId && d.dueOn === input.dueOn);
    if (same) return delay(structuredClone(same));
    const row: DueView = { id: `due-mock-${++seq}`, holdingId: input.holdingId, dueOn: input.dueOn, amountPaise: input.amountPaise, state: "expected", paidPaymentId: null };
    dues.push(row);
    return delay(structuredClone(row));
  },
  payPremiumDue: async (dueId, input) => {
    const row = dues.find((d) => d.id === dueId);
    if (!row) throw new AdapterError("NOT_FOUND");
    if (!premiums.some((p) => p.id === input.paymentId)) throw new AdapterError("NOT_FOUND");
    row.state = "paid";
    row.paidPaymentId = input.paymentId;
    return delay(structuredClone(row));
  },
  hospitals: async (holdingId, pincode) => {
    if (holdingId && !holdings.has(holdingId)) throw new AdapterError("NOT_FOUND");
    if (!PINCODE.test(pincode)) throw new AdapterError("INVALID_INPUT");
    return delay(guard(structuredClone(HOSPITALS[pincode] ?? [])));
  },
};
