import type { EvidenceAdapter } from "../types";
import { delay } from "./delay";
import { INSURER_UNCHECKED_LABEL } from "../insurer-tier";

// Synthetic evidence for the demo session. Fictional insurer and plan. Shapes follow the backend bodies the BFF passes through.
// Nothing here is a verified fact: facts are `extracted_unverified` until a person confirms them, as on the real path.
const SYNTHETIC_UIN = "SYNTH00001V010101";
let version = 0;
let confirmed: { uin?: string; insurerName?: string; policyName?: string } = {};

export const mockEvidence: EvidenceAdapter = {
  policyProfile: (documentId) =>
    delay({
      documentId, version, totalPages: 3,
      proposals: { insurerCode: "SYN", insurerName: "Example Insurer", policyName: "Example Health Plan 01", uin: SYNTHETIC_UIN },
      confirmed,
    }),
  confirmPolicyProfile: (documentId, statement) => {
    version += 1;
    confirmed = { uin: statement.uin, insurerName: statement.insurerName, policyName: statement.policyName };
    return delay({ documentId, version, confirmed });
  },
  ask: (caseId, input) =>
    delay({
      answerId: "answer-example-01", caseId, question: input.question, state: "extracted_unverified",
      quotes: [{ documentId: input.documentIds?.[0] ?? "doc-example-01", page: 2, text: "Example quoted clause for the demo." }],
    }),
  answer: (caseId, answerId) => delay({ answerId, caseId, state: "extracted_unverified", quotes: [] }),
  handoff: (caseId) => delay({ caseId, facts: [], gaps: [] }),
  review: () => delay({ recorded: true }),
  designateConfirmer: (adultUserId) => delay({ adultUserId, designated: true }),
  preview: () => delay({ contractVersion: "household-scenario/v1", members: [], notes: [] }),
  passages: (caseId, query) => {
    const q = query.trim().toLowerCase();
    const hit = (text: string) => q.split(/\s+/).some((w) => w.length > 2 && text.toLowerCase().includes(w));
    const own = [{ clauseId: "clause-example-01", documentId: "doc-example-01", kind: "policy_wording", title: "Waiting periods", page: 2, snippet: "A waiting period of 30 days applies to any illness from the start date." }];
    // The insurer's wording stays in its own list, labelled; no document of the household sits behind it. Any insurer looks the same.
    const insurer = [{ chunkId: "chunk-example-01", versionId: "ver-example-01", documentId: "ins-doc-example-01", page: 9, pageSha256: "0".repeat(64), source: "insurer_wording" as const, label: INSURER_UNCHECKED_LABEL, snippet: "Medical expenses incurred for up to 60 days before the date of admission are covered." }];
    return delay({ passages: own.filter((p) => hit(p.snippet)), insurerPassages: insurer.filter((p) => hit(p.snippet)) });
  },
  sourcePack: (caseId) => delay({ caseId, documents: [] }),
  deletionInventory: (caseId) => delay({ caseId, documents: [] }),
  integrations: () => delay({ integrations: [] }),
};
