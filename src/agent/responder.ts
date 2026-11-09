import type { AssistantReply } from "@/adapters/schemas";
import { findings, policies, household } from "@/data/mock";
import { classify, type Classified } from "./classify";
import { contextFor, type VoiceExample } from "./page-registry";

const squash = (t: string) => t.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** The page example the person said, if any (exact or near-exact after normalising). */
function matchExample(text: string, examples: readonly VoiceExample[]): VoiceExample | undefined {
  const t = squash(text);
  return examples.find((e) => squash(e.say) === t);
}

type Data = { reply: string; steps: [string, string, string]; pageRef?: string; sources?: AssistantReply["sources"] };
function fromData(c: Classified): Data | undefined {
  const topic = c.topic?.toLowerCase();
  if (c.intent === "ask_policy" || c.intent === "explain_term") {
    const f = findings.find((x) => topic && x.label.toLowerCase().includes(topic.split(" ")[0]));
    if (f) {
      const p = policies.find((x) => x.id === f.policyId);
      return {
        reply: `${f.label}: ${f.answer}. ${f.disagrees ? "Your documents disagree on this, so check it before you rely on it." : ""}`.trim(),
        steps: [`${f.label} · ${p?.insurer ?? "policy"}`, `Read ${p?.name ?? "the policy"} ${f.pageRef}`, f.answer],
        pageRef: f.pageRef,
        sources: [{ tier: "household_evidence", label: `${p?.name ?? "Your policy"}`, page: Number(/p\.(\d+)/.exec(f.pageRef)?.[1]) || undefined, quote: f.answer }],
      };
    }
  }
  if (c.intent === "family") {
    const names = household.members.map((m) => m.name).join(", ");
    return { reply: `Your household has ${household.members.length} people: ${names}.`, steps: ["Family", `Counted ${household.members.length} people`, "Opening the family page"] };
  }
  if (c.intent === "payment" || c.intent === "remind") {
    const next = [...policies].sort((a, b) => a.renewsOn.localeCompare(b.renewsOn))[0];
    return { reply: `Next renewal: ${next.insurer}, ${next.name}, on ${next.renewsOn}.`, steps: ["Renewals", `Read ${policies.length} policy dates`, `${next.insurer} renews first`] };
  }
  return undefined;
}

const TEMPLATE: Record<string, [string, string, string]> = {
  explain_term: ["Explaining", "Found the term in your policy", "Plain-language answer ready"],
  ask_policy: ["Policy question", "Read your policies", "Answer ready"],
  calculate: ["Working it out", "Used your cover and the bill", "Result ready"],
  compare: ["Comparing", "Lined up the plans", "Opening the comparison"],
  add_document: ["Add document", "Can read a PDF, Gmail or DigiLocker", "Opening the add step"],
  payment: ["Money", "Matched receipts and renewals", "Answer ready"],
  claim_help: ["Claim help", "Checked your open cases", "Opening Claims and insurer talks"],
  family: ["Family", "Checked who is on which policy", "Answer ready"],
  navigate: ["Navigate", "Found the page", "Opening it"],
  remind: ["Reminder", "Picked the next date", "Ready to add to your calendar"],
  note: ["Note", "Saved it with this page", "Done"],
  smalltalk: ["Help", "Read policies, track claims, find hospitals", "Just say it"],
};

/** Mock assistant: answers from page context and household data. Pure, no network. `page` is a pathname (or a page name). */
export function respond(text: string, page: string): AssistantReply {
  const ctx = contextFor(page.startsWith("/") ? page : "/assistant");
  const ex = matchExample(text, ctx.examples);
  if (ex) {
    return {
      reply: ex.steps[2],
      steps: ex.steps,
      route: ex.goHref,
      goLabel: ex.goLabel,
      pageRef: ctx.page,
    };
  }
  const c = classify(text);
  const data = fromData(c);
  const steps = data?.steps ?? TEMPLATE[c.intent] ?? c.steps;
  const reply = data?.reply || c.reply || (c.intent === "smalltalk" ? "I can read your policies, track claims and find hospitals. Try one of the examples." : steps[2]);
  const action = c.actions[0];
  const asksCover = c.intent === "ask_policy" || c.intent === "explain_term";
  const answerStatus: NonNullable<AssistantReply["answerStatus"]> = data?.sources ? "evidence_found" : asksCover ? "unknown" : "out_of_scope";
  return {
    reply, steps: steps as [string, string, string],
    route: action?.href, goLabel: action?.label,
    pageRef: data?.pageRef ?? ctx.page,
    answerStatus,
    ...(data?.sources ? { sources: data.sources } : asksCover ? { sources: [{ tier: "none" as const, label: "Not found in your documents" }] } : {}),
  };
}

/** Intent plus reply, for tests and the palette. */
export function understand(text: string, page = "/assistant"): Classified & { answer: AssistantReply } {
  return { ...classify(text), answer: respond(text, page) };
}
