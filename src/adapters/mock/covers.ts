import { AdapterError, type CoversAdapter } from "../types";
import { MAX_UPLOAD_BYTES, POLICY_TYPES } from "../documents-contract";
import { precheck } from "../uploads";
import { containsUin, type Conflicts, type DeclarationView, type DueView, type Facts, type PremiumView } from "../covers-contract";
import { PINCODE, type HospitalView } from "../chat-contract";
import { delay } from "./delay";

// In-memory stand-in for the cover routes, with the same rules as the BFF: PDF only, 4 MB cap, a coded error for each refusal, a
// stale profile version refused, a conflict settled once. Fictional insurer and plans. No UIN anywhere. Facts are
// `extracted_unverified` until a person chooses, as on the real path.

const quote = (page: number, text: string) => ({ pageId: `page-${page}`, blockIndex: 0, quote: text });
const factsSeed = (): Facts["facts"] => [
  { factKey: "sum_insured", factClass: "personal_value", valueType: "money", unit: "paise", group: "limits", status: "extracted_unverified", value: 50_000_000, alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-si-own", tier: "own_pdf", status: "extracted_unverified", value: 50_000_000, page: { pageId: "page-1", blockIndex: 0 }, quote: "Sum insured Rs 5,00,000", current: true }] },
  { factKey: "room_rent_limit", factClass: "product_term", valueType: "text", unit: "none", group: "limits", status: "conflicting", value: null, alternatives: [], checkWithInsurer: true, openConflictId: "c-room", sources: [] },
  { factKey: "initial_waiting_days", factClass: "product_term", valueType: "number", unit: "days", group: "waiting", status: "reviewed_reference", value: 30, alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-iw-own", tier: "own_pdf", status: "extracted_unverified", value: 30, page: { pageId: "page-2", blockIndex: 1 }, quote: "30 days from the start date", current: true }, { id: "s-iw-ida", tier: "ida_wording", status: "reviewed_reference", value: 30, page: null, quote: "A waiting period of 30 days applies.", current: true }] },
  { factKey: "ped_waiting_months", factClass: "product_term", valueType: "number", unit: "months", group: "waiting", status: "extracted_unverified", value: 36, alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-ped-own", tier: "own_pdf", status: "extracted_unverified", value: 36, page: { pageId: "page-2", blockIndex: 4 }, quote: "36 months for pre-existing diseases", current: true }] },
  { factKey: "exclusion_cosmetic", factClass: "product_term", valueType: "bool", unit: "none", group: "exclusions", status: "extracted_unverified", value: true, alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-ex-own", tier: "own_pdf", status: "extracted_unverified", value: true, page: { pageId: "page-3", blockIndex: 2 }, quote: "Cosmetic treatment is not covered", current: true }] },
  { factKey: "cashless_network", factClass: "product_term", valueType: "bool", unit: "none", group: "cashless", status: "extracted_unverified", value: true, alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-cl-own", tier: "own_pdf", status: "extracted_unverified", value: true, page: { pageId: "page-1", blockIndex: 6 }, quote: "Cashless at network hospitals", current: true }] },
  { factKey: "premium_total", factClass: "personal_value", valueType: "money", unit: "paise", group: "money", status: "extracted_unverified", value: 1_850_000, alternatives: [], checkWithInsurer: false, openConflictId: null, sources: [{ id: "s-pr-own", tier: "own_pdf", status: "extracted_unverified", value: 1_850_000, page: { pageId: "page-1", blockIndex: 9 }, quote: "Total premium Rs 18,500", current: true }] },
];
const conflictsSeed = (): Conflicts["conflicts"] => [
  { id: "c-room", factKey: "room_rent_limit", factClass: "product_term", valueType: "text", reason: "own_vs_insurer", resolution: "pending", resolvedAt: null, resolvingFactId: null, checkWithInsurer: true, candidates: [
    { id: "f-room-own", tier: "own_pdf", status: "extracted_unverified", value: "1 percent of the sum insured per day", ...quote(2, "Room rent up to 1% of the sum insured per day"), current: true },
    { id: "f-room-ida", tier: "ida_wording", status: "reviewed_reference", value: "2 percent of the sum insured per day", page: null, quote: "Room rent is limited to 2% of the sum insured per day.", current: true },
  ] },
];

type State = { facts: Facts["facts"]; conflicts: Conflicts["conflicts"]; status: Facts["status"]; version: number; confirmed: string | null; key: string | null };
const holdings = new Map<string, { documentId: string; state: State; linked: { documentId: string; kind: string }[] }>();
const docs = new Map<string, string>();
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
const get = (id: string) => {
  const h = holdings.get(id);
  if (!h) throw new AdapterError("NOT_FOUND");
  return h;
};
const guard = <T>(v: T): T => {
  if (containsUin(v)) throw new AdapterError("BACKEND_BAD_RESPONSE");
  return v;
};

export const mockCovers: CoversAdapter = {
  uploadDocument: async (file, key, kind, policyType) => {
    const pre = precheck(file, MAX_UPLOAD_BYTES);
    if (pre) throw new AdapterError(pre);
    if (!POLICY_TYPES.includes(policyType)) throw new AdapterError("POLICY_TYPE_INVALID");
    n += 1;
    const documentId = `doc-mock-${n}`;
    docs.set(documentId, kind);
    // As on the backend, every uploaded document gets a holding of its own; the schedule's is the one the person works with.
    holdings.set(`holding-mock-${n}`, { documentId, state: { facts: [], conflicts: [], status: "uploaded", version: 0, confirmed: null, key: null }, linked: [{ documentId, kind: "schedule" }] });
    void key;
    return delay({ documentId });
  },
  holdingFor: async (documentId) => delay([...holdings].find(([, h]) => h.documentId === documentId)?.[0] ?? null),
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
    return delay({ holdingId, documentId: input.documentId, kind, linked });
  },
  holdings: () => delay([...holdings].map(([id, h]) => ({ id, documentId: h.documentId, kind: docs.get(h.documentId) ?? "policy_wording", status: h.state.status }))),
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
    h.state.facts = factsSeed();
    h.state.conflicts = conflictsSeed();
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
