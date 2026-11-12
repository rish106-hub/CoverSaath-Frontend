import { AdapterError, type ChatAdapter } from "../types";
import { containsUin } from "../covers-contract";
import { turnIn, type FactUsed, type TurnAnswer, type TurnInput } from "../chat-contract";

// In-memory stand-in for the chat routes, with the BFF's rules: a message of 1 to 1000 characters, a thread must exist, the answer
// streams as meta, delta, answer, done, and every answer names the facts it used. Fictional insurer facts. No UIN anywhere. The answers
// are fixed scripts, not a model: they exist so the screens and the stream consumer can be exercised without a backend.

const FACTS: Record<string, FactUsed> = {
  wait: { factId: "f-wait", factKey: "initial_waiting_days", label: "Initial waiting period", status: "reviewed_reference", sourceTier: "ida_wording", valueText: "30 days", checkWithInsurer: false },
  ped: { factId: "f-ped", factKey: "ped_waiting_months", label: "Pre-existing disease waiting", status: "extracted_unverified", sourceTier: "own_pdf", valueText: "36 months", checkWithInsurer: false },
  room: { factId: "f-room", factKey: "room_rent_limit", label: "Room rent limit", status: "conflicting", sourceTier: "own_pdf", valueText: "1% or 2% of the sum insured per day", checkWithInsurer: true },
  cashless: { factId: "f-cashless", factKey: "cashless_network", label: "Cashless at network hospitals", status: "extracted_unverified", sourceTier: "own_pdf", valueText: "Yes", checkWithInsurer: false },
  si: { factId: "f-si", factKey: "sum_insured", label: "Sum insured", status: "extracted_unverified", sourceTier: "own_pdf", valueText: "Rs 5,00,000", checkWithInsurer: false },
};

type Script = Pick<TurnAnswer, "status" | "intent" | "answer" | "factsUsed" | "computed" | "openConflicts"> & { citations?: TurnAnswer["citations"] } & { retrieval: "vector" | "keyword" | "facts_only" };

function scriptFor(message: string): Script {
  const m = message.toLowerCase();
  if (/clause|co-?pay|terms|sub-?limit|exclusion/.test(m)) {
    const copay: FactUsed = { factId: "f-copay", factKey: "copay_percent", label: "Co-payment", status: "extracted_unverified", sourceTier: "own_pdf", valueText: "10% on claims after age 60", checkWithInsurer: false, citation: { documentKind: "policy_wording", page: 7 } };
    const si: FactUsed = { ...FACTS.si!, citation: { documentKind: "policy_schedule", page: 1 } };
    return {
      status: "evidence_found", intent: "clause_lookup", retrieval: "vector",
      answer: "Your policy terms apply a 10% co-payment on claims after age 60. The sum insured on your schedule is Rs 5,00,000.",
      factsUsed: [copay, si], computed: null, openConflicts: [],
      citations: [{ documentKind: "policy_wording", page: 7, quote: "A co-payment of 10% applies to claims after age 60." }, { documentKind: "policy_schedule", page: 1 }],
    };
  }
  if (/knee|surgery|operation|procedure/.test(m)) {
    return {
      status: "evidence_found", intent: "procedure_planning", retrieval: "facts_only",
      answer: "A planned knee surgery is covered once the 30 day initial waiting period has passed, up to your sum insured of Rs 5,00,000. Your room rent limit is read two ways in your documents, so check the exact limit with the insurer before you book a room.",
      factsUsed: [FACTS.wait!, FACTS.room!, FACTS.si!, FACTS.cashless!],
      computed: { checks: [{ id: "waiting", status: "ok", detail: "Your policy started more than 30 days before January.", factIds: ["f-wait"] }, { id: "room_rent", status: "attention", detail: "Room rent limit has two readings.", factIds: ["f-room"] }], summary: null, missingInputs: ["estimated_cost_inr"] },
      openConflicts: [{ conflictId: "c-room", factKey: "room_rent_limit" }],
    };
  }
  if (/hospital|cashless|pincode|\b\d{6}\b/.test(m)) {
    return { status: "evidence_found", intent: "network_hospitals", retrieval: "facts_only", answer: "Your cover has cashless treatment at network hospitals. Open Network hospitals and enter a pincode to see the ones near you.", factsUsed: [FACTS.cashless!], computed: null, openConflicts: [] };
  }
  if (/wait/.test(m)) {
    return { status: "evidence_found", intent: "waiting_period", retrieval: "keyword", answer: "Your policy has a 30 day initial waiting period and 36 months for pre-existing diseases.", factsUsed: [FACTS.wait!, FACTS.ped!], computed: null, openConflicts: [] };
  }
  return { status: "unknown", intent: "unknown", retrieval: "facts_only", answer: "I could not find that in your cover. Add the policy document or ask about waiting periods, limits or cashless hospitals.", factsUsed: [], computed: null, openConflicts: [] };
}

const threads = new Set<string>();
let n = 0;
const tick = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve) => { const t = setTimeout(resolve, process.env.NODE_ENV === "test" ? 0 : ms); signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true }); });

let consented = false;

export const mockChat: ChatAdapter = {
  async consent() { return consented; },
  async grantConsent() { consented = true; },
  async revokeConsent() { consented = false; },
  async startThread(holdingId) {
    n += 1;
    const id = `thread-mock-${n}`;
    threads.add(id);
    return { id, holdingId: holdingId ?? null };
  },
  async turn(threadId, input: TurnInput, onEvent, signal) {
    const p = turnIn.safeParse(input);
    if (!p.success) throw new AdapterError("INVALID_INPUT");
    if (!consented) throw new AdapterError("CONSENT_REQUIRED");
    if (!threads.has(threadId)) throw new AdapterError("NOT_FOUND");
    const sc = scriptFor(p.data.message);
    if (containsUin(sc)) throw new AdapterError("BACKEND_BAD_RESPONSE");
    onEvent({ type: "meta", data: { threadId, intent: sc.intent, retrievalMode: sc.retrieval, factsAvailable: Object.keys(FACTS).length, openConflicts: sc.openConflicts.length } });
    const words = sc.answer.split(" ");
    for (let i = 0; i < words.length; i += 4) {
      await tick(60, signal);
      if (signal?.aborted) return;
      onEvent({ type: "delta", data: { text: `${words.slice(i, i + 4).join(" ")} ` } });
    }
    await tick(60, signal);
    if (signal?.aborted) return;
    onEvent({ type: "answer", data: { turnId: `turn-mock-${n}-${Date.now()}`, status: sc.status, intent: sc.intent, answer: sc.answer, answerSource: "deterministic", factsUsed: sc.factsUsed, computed: sc.computed, openConflicts: sc.openConflicts, ...(sc.citations ? { citations: sc.citations } : {}) } });
    onEvent({ type: "done", data: {} });
  },
};
