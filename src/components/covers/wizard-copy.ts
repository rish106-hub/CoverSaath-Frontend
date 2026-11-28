// Copy and screen rules of the add-a-policy wizard, kept apart from the view so they can be tested with no rendering.
// It exists so that which screen shows, which step it belongs to and what a failure says to the person are decided in one
// plain place: the view only draws what these functions return. Nothing here knows about the backend or shows a code.

export const WIZARD_STEPS = ["Find your policy", "Reading it", "Your people", "Your cover"] as const;

export type WizardScreen = "loading" | "load-failed" | "consent" | "pay" | "find" | "reading" | "guide" | "plan" | "plan-retry" | "people" | "cover";

export type ScreenInput = {
  consent: boolean | null; loadFailed: boolean; done: boolean; peopleDone: boolean; hasCandidates: boolean;
  slotStatus: "empty" | "working" | "waiting" | "failed" | "done"; slotCode: string | null; mustPay: boolean; hasHolding: boolean;
};

/** The first matching rule wins. The order matters: a finished policy and the plan guesses come before consent, and a refusal that has its own screen (consent, payment) never lands on the guidance screen. */
export function screenOf(i: ScreenInput): WizardScreen {
  if (i.consent === null && !i.loadFailed) return "loading";
  if (i.consent === null && i.loadFailed) return "load-failed";
  if (i.done && i.peopleDone) return "cover";
  if (i.done) return "people";
  if (i.hasCandidates) return "plan";
  if (i.consent === false) return "consent";
  if (i.slotStatus === "working" || i.slotStatus === "waiting") return "reading";
  if (i.slotStatus === "failed" && i.slotCode !== "PAYMENT_REQUIRED" && i.slotCode !== "CONSENT_REQUIRED") return "guide";
  if (i.mustPay) return "pay";
  if (i.slotStatus === "done" && i.hasHolding) return "plan-retry";
  return "find";
}

export function stepOf(screen: WizardScreen): 1 | 2 | 3 | 4 {
  switch (screen) {
    case "loading":
    case "load-failed":
    case "consent":
    case "pay":
    case "find":
      return 1;
    case "reading":
    case "guide":
    case "plan":
    case "plan-retry":
      return 2;
    case "people":
      return 3;
    case "cover":
      return 4;
  }
}

export type ReadingStage = "sending" | "checking" | "reading" | "details" | "matching";
export const STAGE_ORDER: readonly ReadingStage[] = ["sending", "checking", "reading", "details", "matching"];

/** The percent comes only from the stage the backend reports, never from a timer, so the bar never promises more than is true. */
export const STAGE_COPY: Record<ReadingStage, { label: string; h1: string; percent: number }> = {
  sending: { label: "Sending your PDF", h1: "Sending your PDF.", percent: 15 },
  checking: { label: "Safety check", h1: "Checking the file is safe.", percent: 35 },
  reading: { label: "Reading the pages", h1: "Reading the pages.", percent: 55 },
  details: { label: "Pulling out cover details", h1: "Pulling out your cover details.", percent: 75 },
  matching: { label: "Finding your plan", h1: "Finding your plan.", percent: 90 },
};

/** Check again by itself every 5 seconds while a document is still being read, at most 36 times per document (about 3 minutes). */
export const POLL_MS = 5000;
export const POLL_MAX = 36;

export type GuideAction = "another" | "retry" | "policies" | "signin" | "later";
export type Guide = { title: string; fix: string; action: GuideAction };

const CLEAN_COPY = "Open it, choose Print, then Save as PDF. Add the new copy.";
const SCHEDULE_ONLY = "Add only the schedule pages: who is covered, the sum insured and the dates.";

const GUIDES: Record<string, Guide> = {
  PDF_PROTECTED: { title: "This PDF has a password on it.", fix: CLEAN_COPY, action: "another" },
  PDF_ACTIVE_CONTENT: { title: "This PDF needs a clean copy.", fix: CLEAN_COPY, action: "another" },
  PDF_TOO_COMPLEX: { title: "This PDF needs a clean copy.", fix: CLEAN_COPY, action: "another" },
  FILE_TYPE_INVALID: { title: "That file is not a PDF.", fix: "Download the policy as a PDF from your insurer's email or app.", action: "another" },
  FILE_TOO_LARGE: { title: "That PDF is too big.", fix: SCHEDULE_ONLY, action: "another" },
  PDF_TOO_LONG: { title: "That PDF has too many pages.", fix: SCHEDULE_ONLY, action: "another" },
  FILE_EMPTY: { title: "We could not open this PDF.", fix: "Download a fresh copy from your insurer and add it.", action: "another" },
  PDF_UNREADABLE: { title: "We could not open this PDF.", fix: "Download a fresh copy from your insurer and add it.", action: "another" },
  DOCUMENT_REJECTED: { title: "We could not accept this file.", fix: "Add another copy of the policy.", action: "another" },
  POLICY_TYPE_INVALID: { title: "We could not accept this file.", fix: "Add another copy of the policy.", action: "another" },
  HOLDING_CREATE_FAILED: { title: "We could not read this one.", fix: "Add it again, or use the copy from your insurer's email.", action: "another" },
  READING_FAILED: { title: "We could not read this one.", fix: "Add it again, or use the copy from your insurer's email.", action: "another" },
  DUPLICATE_DOCUMENT: { title: "This policy is already added.", fix: "Open it from My policies.", action: "policies" },
  HOLDING_DOCUMENT_HAS_HOLDING: { title: "This policy is already added.", fix: "Open it from My policies.", action: "policies" },
  READING_UNAVAILABLE: { title: "Reading is paused right now.", fix: "Your file is saved. Come back in a little while.", action: "later" },
  UPLOAD_UNAVAILABLE: { title: "Reading is paused right now.", fix: "Your file is saved. Come back in a little while.", action: "later" },
  HOLDINGS_DISABLED: { title: "Reading is paused right now.", fix: "Your file is saved. Come back in a little while.", action: "later" },
  UNAUTHENTICATED: { title: "Please sign in again.", fix: "Then add your policy.", action: "signin" },
};

const RETRY_GUIDE: Guide = { title: "That did not go through.", fix: "Check your connection and try again.", action: "retry" };

/** What to tell the person for a failed upload, and the one way out. Unknown codes get the retry guidance; the code itself is never shown. */
export function guideFor(code: string): Guide {
  return Object.hasOwn(GUIDES, code) ? GUIDES[code] : RETRY_GUIDE;
}
