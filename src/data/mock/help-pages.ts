import type { DeskBoardCase, RankedHospital, BloodBank } from "@/adapters/schemas";

// Help group data (Desk, Emergency, Assistant, Shortcuts, Settings). All names, numbers and ids are invented.

type Msg = DeskBoardCase["thread"][number];
const k = (at: string, text: string): Msg => ({ from: "Knowvia", at, text, side: "knowvia" });

export const deskBoard: DeskBoardCase[] = [
  {
    id: "short-settled", title: "Short-settled claim", who: "Father", amount: "Rs 41,800", next: "Tue", ref: "Claim MC-CL-2026-0914",
    stage: 1, stateLabel: "With TPA", rung: 0,
    thread: [
      k("Mon 10:12", "We found the gap: Rs 41,800 was cut as “room rent proportionate deduction”. Father’s schedule allows Rs 3,000 a day; the wording says 1% of cover. We’re asking the TPA to apply the schedule."),
      { from: "TPA", at: "Mon 16:40", text: "Case reopened for review. Expected response in 3 working days.", side: "other" },
      { from: "You", at: "Mon 18:02", text: "Do you need anything from me?", side: "you" },
      k("Mon 18:02", "Only a signature on the claim form. If they ask for the room tariff card, we’ll get it from the hospital."),
    ],
    docs: [{ name: "Discharge summary", highlighted: true }, { name: "Final bill", highlighted: false }, { name: "Settlement letter", highlighted: false }],
  },
  {
    id: "duplicate-premium", title: "Duplicate premium", who: "Parents", amount: "Rs 15,850", next: "Fri", ref: "Receipts 9 and 11 Mar",
    stage: 0, stateLabel: "Raised", rung: 0,
    thread: [
      k("Mon 09:30", "Two payments of Rs 15,850 for the same renewal, on 9 and 11 March. We’ve asked Meridian Care to refund the second one to the card it came from."),
      { from: "Meridian Care", at: "Tue 11:05", text: "Request logged. Refunds take 7 to 10 working days after checks.", side: "other" },
      k("Tue 11:06", "We’ll check your bank for it on the 14th and close this when it lands."),
    ],
    docs: [{ name: "Receipt 9 Mar", highlighted: true }, { name: "Receipt 11 Mar", highlighted: true }, { name: "Card statement", highlighted: false }],
  },
  {
    id: "pre-approval", title: "Cashless pre-approval", who: "Mother", amount: "Rs 55,000", next: "done", ref: "Cataract · Kothrud Care",
    stage: 3, stateLabel: "Approved", rung: -1,
    thread: [
      k("Thu 08:10", "Sent the pre-approval form with the eye surgeon’s note and Mother’s e-card."),
      { from: "TPA", at: "Thu 14:22", text: "Approved for Rs 55,000. Lens limit applies as per policy.", side: "other" },
      k("Thu 14:23", "Approved. The hospital desk has the letter. You pay only for the premium lens upgrade, Rs 6,500, if you choose it."),
    ],
    docs: [{ name: "Approval letter", highlighted: true }, { name: "Surgeon’s note", highlighted: false }, { name: "E-card", highlighted: false }],
  },
  {
    id: "ecard-name", title: "Name spelling on e-card", who: "Kabir", amount: "—", next: "Wed", ref: "Northstar group cover",
    stage: 2, stateLabel: "Documents", rung: 0,
    thread: [
      k("Fri 12:00", "Kabir’s e-card says “Kabeer”. A mismatch can slow a cashless claim, so we asked HR to fix it."),
      { from: "HR desk", at: "Mon 10:40", text: "Please share a copy of the birth certificate.", side: "other" },
      k("Mon 10:41", "Sent the copy from your DigiLocker, with your OK from last week."),
    ],
    docs: [{ name: "Birth certificate", highlighted: true }, { name: "Old e-card", highlighted: false }],
  },
];

export const deskSteps = [
  { name: "Raised", detail: "We have everything we need" },
  { name: "With TPA", detail: "Our coordinator is on it" },
  { name: "Documents", detail: "We ask you only if needed" },
  { name: "Resolved", detail: "Money or approval in hand" },
] as const;

export const deskLadder = [
  { name: "TPA review", detail: "We ask them to recheck with the policy wording.", when: "3 working days" },
  { name: "Insurer grievance", detail: "A written complaint to the insurer’s grievance team.", when: "14 days" },
  { name: "Bima Bharosa", detail: "The regulator’s complaint portal, if the insurer doesn’t fix it.", when: "30 days" },
  { name: "Insurance Ombudsman", detail: "Free, independent hearing for a final answer.", when: "after 30 days" },
] as const;

export const deskContacts = [
  { name: "Meridian Care TPA desk", detail: "Father’s claim · email + portal", due: "Tue" },
  { name: "Meridian Care renewals", detail: "Duplicate refund", due: "Fri" },
  { name: "Northstar via your HR", detail: "Kabir’s e-card", due: "Wed" },
] as const;

export const deskLive = [
  "Reading the TPA’s reply on Father’s claim",
  "Checking your bank for the Rs 15,850 refund",
  "Asking Kothrud Care for the room tariff card",
  "Preparing the insurer grievance, ready if needed",
  "Watching HR’s inbox for Kabir’s new e-card",
] as const;

export const deskRaise = [
  { say: "The hospital is asking me for a deposit", reply: "Called Kothrud Care’s TPA desk: cashless is approved, the deposit isn’t needed. Sent you the letter to show." },
  { say: "My claim is taking too long", reply: "Opened Father’s claim: day 6 of 30. We’ve chased the TPA and will escalate on day 15." },
  { say: "They rejected my mother’s physio bill", reply: "Read the reason: outpatient physio isn’t covered. We checked the wording; it’s correct, so no case raised." },
] as const;

export const deskScore = [
  { label: "Recovered this year", value: "Rs 58,240" },
  { label: "Open cases", value: "3" },
  { label: "Avg first reply", value: "1.6 days" },
] as const;

// ---- Emergency ----
type EmergencyPerson = { name: string; full: string; plan: "group" | "senior"; policyNo: string; valid: string; left: string; abha: string; tpa: string };
export const emergencyPeople: EmergencyPerson[] = [
  { name: "Meera", full: "Meera Rao", plan: "group", policyNo: "NHG/2026/771204-01", valid: "31 Mar 2027", left: "Rs 5,00,000", abha: "91-4471-•••• -2210", tpa: "Northstar TPA, 24×7" },
  { name: "Rohan", full: "Rohan Rao", plan: "group", policyNo: "NHG/2026/771204-02", valid: "31 Mar 2027", left: "Rs 5,00,000", abha: "Not linked", tpa: "Northstar TPA, 24×7" },
  { name: "Kabir", full: "Kabir Rao", plan: "group", policyNo: "NHG/2026/771204-03", valid: "31 Mar 2027", left: "Rs 5,00,000", abha: "Not linked", tpa: "Northstar TPA, 24×7" },
  { name: "Mother", full: "Lalitha Rao", plan: "senior", policyNo: "SNR/2026/048212", valid: "13 Mar 2027", left: "Rs 3,00,000", abha: "91-2208-•••• -5531", tpa: "Meridian desk, 24×7" },
  { name: "Father", full: "Suresh Rao", plan: "senior", policyNo: "SNR/2026/048213", valid: "13 Mar 2027", left: "Rs 2,62,000", abha: "91-2208-•••• -5540", tpa: "Meridian desk, 24×7" },
];

export const emergencyIssues: Record<string, { label: string; dept: string }> = {
  chest: { label: "Chest pain", dept: "Cardiac ICU" },
  trauma: { label: "Accident or injury", dept: "Level 1 trauma" },
  stroke: { label: "Stroke signs", dept: "Stroke unit" },
  breath: { label: "Breathing trouble", dept: "Pulmonology ICU" },
  child: { label: "Child with high fever", dept: "Paediatric ICU" },
  preg: { label: "Pregnancy", dept: "Maternity + NICU" },
};

export function rankHospitals(issue: string, mode: "cashless" | "best"): RankedHospital[] {
  const dept = emergencyIssues[issue]?.dept ?? "Emergency";
  if (mode === "cashless") {
    return [
      { pin: "A", name: "Paud Road Heart Institute", distance: "3.2 km · 12 min", why: `${dept} · cashless`, tag: "Best match · cashless", x: 30, y: 30, top: true },
      { pin: "B", name: "Kothrud Care Hospital", distance: "1.8 km · 7 min", why: "Emergency + ICU · cashless", tag: "Nearest cashless", x: 58, y: 40, top: false },
      { pin: "C", name: "Wanowrie General Hospital", distance: "9.4 km · 26 min", why: `${dept} · cashless`, tag: "Cashless", x: 78, y: 74, top: false },
    ];
  }
  return [
    { pin: "A", name: "Deccan Multispeciality Hospital", distance: "2.6 km · 10 min", why: `${dept} · top-rated for this`, tag: "Best treatment · reimbursement", x: 40, y: 26, top: true },
    { pin: "B", name: "Kothrud Care Hospital", distance: "1.8 km · 7 min", why: "Emergency + ICU · cashless", tag: "Nearest cashless", x: 58, y: 40, top: false },
    { pin: "C", name: "Paud Road Heart Institute", distance: "3.2 km · 12 min", why: `${dept} · cashless`, tag: "Cashless", x: 30, y: 66, top: false },
  ];
}

export const bloodGroups: Record<string, number> = { "A+": 14, "A−": 2, "B+": 23, "B−": 1, "O+": 31, "O−": 3, "AB+": 6, "AB−": 0 };

export function bloodBanks(group: string): BloodBank[] {
  const n = bloodGroups[group] ?? 0;
  const a = Math.ceil(n * 0.5);
  const b = Math.floor(n * 0.3);
  return [
    { name: "City Blood Centre", distance: "2.4 km", units: a },
    { name: "Karve Road Blood Bank", distance: "4.1 km", units: b },
    { name: "District Hospital Blood Bank", distance: "6.7 km", units: n - a - b },
  ];
}

// ---- Assistant ----
type Utterance = {
  say: string; label: string; person: string; conf: string; route: string; tone: "urgent" | "cover" | "number" | "word";
  kicker: string; answer: string; ref?: string; acts: { text: string; href: string; primary?: boolean }[];
};
export const utterances: Utterance[] = [
  { say: "Papa ko chest pain ho raha hai", label: "Help in an emergency", person: "Father", conf: "Certain", route: "Open Emergency for Father", tone: "urgent", kicker: "Opening Emergency for Father", answer: "Call 112 now. Kothrud Care Hospital is 7 minutes away and cashless on his plan.", acts: [{ text: "Call 112", href: "tel:112", primary: true }, { text: "Open Emergency", href: "/emergency" }] },
  { say: "Is cataract covered for my mother?", label: "A question about your cover", person: "Mother", conf: "Very sure", route: "Answer with the exact clause", tone: "cover", kicker: "From Mother’s senior plan", answer: "Yes, up to Rs 40,000 per eye. She pays 20% of that as co-pay.", ref: "Senior plan p.14 §5.2", acts: [{ text: "See the clause", href: "/policies/meridian-senior", primary: true }, { text: "Stress test it", href: "/stress-test" }] },
  { say: "How much tax can I save this year?", label: "Work out a number", person: "Whole family", conf: "Very sure", route: "Open the tax calculator, filled in", tone: "number", kicker: "80D, old regime, pre-filled", answer: "Rs 75,000: Rs 25,000 for your family and Rs 50,000 for your parents.", ref: "Premium receipts on file · 2", acts: [{ text: "Open calculator", href: "/tools", primary: true }] },
  { say: "What does restore benefit mean?", label: "What a word means", person: "Everyone", conf: "Very sure", route: "Explain it in plain words", tone: "word", kicker: "In plain words", answer: "If you use up your cover in a year, the insurer refills it once for a new illness.", ref: "Your group plan: once a year · p.18", acts: [{ text: "Explain like a bill", href: "/assistant", primary: true }] },
];

/** Plain-words understanding list. `matches` is the utterance index that lights the row. */
export const understanding = [
  { glyph: "✚", title: "Help in an emergency", detail: "Opens Emergency at once for the person you name.", on: 0 },
  { glyph: "?", title: "A question about your cover", detail: "Answered from your own policy, with the page.", on: 1 },
  { glyph: "Aa", title: "What a word means", detail: "Plain meaning, then what your policy says.", on: 3 },
  { glyph: "%", title: "Work out a number", detail: "Tax, co-pay, room rent: filled in for you.", on: 2 },
  { glyph: "⇄", title: "Compare plans", detail: "Side by side, for your family only.", on: -1 },
  { glyph: "+", title: "Add a document", detail: "Upload, photo, or DigiLocker.", on: -1 },
  { glyph: "₹", title: "Money and receipts", detail: "Finds payments, refunds and tax proof.", on: -1 },
  { glyph: "→", title: "Take me somewhere", detail: "Opens any screen you name.", on: -1 },
] as const;

// ---- Shortcuts ----
export const inputPaths = {
  key: { title: "Keyboard only", steps: [["Get beta access", "Tab · Enter"], ["Pick who you look after", "← → · Space"], ["Sign in with code", "type 6 digits"], ["Add policy", "N · Enter"], ["Move between cards", "J · K"], ["Emergency for Father", "E · 5"]] },
  mouse: { title: "Mouse only", steps: [["Get beta access", "click"], ["Pick who you look after", "click chips"], ["Sign in", "Continue with Google"], ["Add policy", "drag the PDF in"], ["Answer questions", "click suggestions"], ["Emergency", "red button, always visible"]] },
  voice: { title: "Voice only", steps: [["“Get me access”", "opens beta"], ["“Me and my parents”", "fills the chips"], ["“Sign me in with Google”", "starts sign-in"], ["“Read my DigiLocker policy”", "adds it"], ["“What do I pay for a knee surgery?”", "stress test"], ["“Papa ko chest pain”", "emergency, instantly"]] },
} as const;

export const paletteDemo = {
  room: [["▣", "Room rent check", "Calculators", "G C"], ["▤", "Room limit · group plan p.12", "Policies", ""], ["?", "Ask Knowvia: “What room can I take?”", "Ask", "/"], ["≡", "Guide: Room rent, explained with one bill", "Learn", ""]],
  father: [["●", "Emergency for Father", "Actions", "E"], ["◐", "Stress test: Father", "Stress test", "G S"], ["▣", "Father’s e-card", "Wallet", ""], ["⇆", "Father’s short-settled claim", "Desk", "G D"]],
  tax: [["%", "80D calculator", "Calculators", ""], ["◔", "Download tax proof pack", "Money", "G M"], ["?", "Ask Knowvia: “How much tax can I save?”", "Ask", "/"], ["≡", "Guide: 80D in two minutes", "Learn", ""]],
} as const;
