// Mock data for /family (Meera Rao household, all invented). backend gap: members beyond the owner, policies, dates, sharing.

export type FamilyPerson = {
  id: string; name: string; initials: string; relation: string; age: number; cover: string;
  segments: { group: number; topUp: number; senior: number };
  status: string; tone: "ok" | "warn" | "bad"; note: string;
  has: [boolean, boolean, boolean];
  facts: [string, string, string];
  waits: { label: string; pct: number; value: string }[];
  gaps: { icon: string; title: string; detail: string; cta: string; href: string }[];
};

export const familyPeople: FamilyPerson[] = [
  { id: "meera", name: "Meera", initials: "M", relation: "You", age: 41, cover: "Rs 15L", segments: { group: 33, topUp: 67, senior: 0 }, status: "Well covered", tone: "ok", note: "Group cover ends if you leave the job.", has: [true, true, false], facts: ["Rs 15L", "Rs 0", "0"],
    waits: [{ label: "Old illnesses", pct: 100, value: "served" }, { label: "Maternity", pct: 100, value: "served" }, { label: "Named surgeries", pct: 100, value: "served" }],
    gaps: [{ icon: "↗", title: "Plan a personal base policy", detail: "Your group cover ends with the job.", cta: "See options", href: "/compare" }] },
  { id: "rohan", name: "Rohan", initials: "R", relation: "Spouse", age: 43, cover: "Rs 5L", segments: { group: 33, topUp: 0, senior: 0 }, status: "1 gap", tone: "warn", note: "Not on the top-up.", has: [true, false, false], facts: ["Rs 5L", "Rs 0", "0"],
    waits: [{ label: "Old illnesses", pct: 100, value: "served" }, { label: "Named surgeries", pct: 100, value: "served" }, { label: "Top-up", pct: 0, value: "not added" }],
    gaps: [{ icon: "↗", title: "Add Rohan to the top-up", detail: "A bill above Rs 5L for him isn't covered.", cta: "Compare top-ups", href: "/tools" }] },
  { id: "kabir", name: "Kabir", initials: "K", relation: "Son", age: 8, cover: "Rs 5L", segments: { group: 33, topUp: 0, senior: 0 }, status: "1 gap", tone: "warn", note: "Name spelt differently on the e-card.", has: [true, false, false], facts: ["Rs 5L", "Rs 0", "0"],
    waits: [{ label: "Old illnesses", pct: 100, value: "served" }, { label: "Named surgeries", pct: 100, value: "served" }, { label: "Top-up", pct: 0, value: "not added" }],
    gaps: [{ icon: "✎", title: "Fix the name on the e-card", detail: "“Kabeer” on the card, “Kabir” on records. Desk is on it.", cta: "Track it", href: "/desk" }] },
  { id: "mother", name: "Mother", initials: "Ma", relation: "Parent", age: 68, cover: "Rs 3L", segments: { group: 0, topUp: 0, senior: 20 }, status: "2 gaps", tone: "bad", note: "Pays 20% of every claim.", has: [false, false, true], facts: ["Rs 3L", "Rs 3,240", "2"],
    waits: [{ label: "Old illnesses", pct: 66, value: "1 yr left" }, { label: "Cataract", pct: 100, value: "served" }, { label: "Knee replacement", pct: 66, value: "Mar 2027" }],
    gaps: [{ icon: "%", title: "20% co-pay on every claim", detail: "About Rs 8,000 on a cataract.", cta: "Stress test", href: "/stress-test" }, { icon: "✂", title: "Cap on cataract", detail: "Rs 40,000 per eye.", cta: "Read the page", href: "/policies/meridian-senior" }] },
  { id: "father", name: "Father", initials: "Pa", relation: "Parent", age: 71, cover: "Rs 3L", segments: { group: 0, topUp: 0, senior: 20 }, status: "3 gaps", tone: "bad", note: "Room rent: pages disagree.", has: [false, false, true], facts: ["Rs 1.52L", "Rs 1.48L", "1"],
    waits: [{ label: "Old illnesses", pct: 66, value: "1 yr left" }, { label: "Heart", pct: 100, value: "served" }, { label: "Knee replacement", pct: 66, value: "Mar 2027" }],
    gaps: [{ icon: "▣", title: "Room rent: pages disagree", detail: "Schedule says Rs 3,000 a day, wording says 1% of cover.", cta: "See both pages", href: "/policies/meridian-senior" }, { icon: "%", title: "20% co-pay on every claim", detail: "Rs 76,000 on a knee replacement.", cta: "Stress test", href: "/stress-test" }, { icon: "⇆", title: "A claim was cut short", detail: "Rs 41,800 taken up with the TPA.", cta: "Open Desk", href: "/desk" }] },
];

export const familyPolicies = [
  { name: "Company group cover", meta: "Northstar · Rs 5L shared · employer pays", tone: "harbour" },
  { name: "Personal top-up", meta: "Kaveri · Rs 10L after Rs 5L", tone: "sea" },
  { name: "Senior citizen plan", meta: "Meridian · Rs 3L each", tone: "ochre" },
] as const;
export const policyRefs = ["sched. p.1", "p.2", "sched. p.1"];

export type Invite = { id: string; name: string; initials: string; mobile: string; state: "joined" | "sent" | "none"; detail: string };
export const familyInvites: Invite[] = [
  { id: "rohan", name: "Rohan", initials: "R", mobile: "+91 98765 43210", state: "joined", detail: "Group cover linked" },
  { id: "mother", name: "Mother", initials: "Ma", mobile: "+91 94220 55180", state: "joined", detail: "Senior plan linked" },
  { id: "father", name: "Father", initials: "Pa", mobile: "+91 94220 55181", state: "sent", detail: "Sent on WhatsApp, 2 days ago" },
  { id: "priya", name: "Priya", initials: "P", mobile: "+91 98220 11223", state: "none", detail: "Tap Add family member" },
];

export const familyDates = [
  { id: "senior-renews", month: "MAR", day: "13", title: "Senior plan renews", who: "Mother, Father", inDays: 132, tone: "coral" },
  { id: "group-ends", month: "MAR", day: "31", title: "Group cover year ends", who: "Meera, Rohan, Kabir", inDays: 150, tone: "mist" },
  { id: "topup-renews", month: "JUN", day: "14", title: "Top-up renews", who: "Meera", inDays: 225, tone: "marker" },
] as const;

export const sharingRows = [
  { id: "rohan", who: "Rohan", initials: "R", state: "Can see your cover", on: [true, true, true] },
  { id: "mother", who: "Mother", initials: "Ma", state: "Sees her own policy", on: [false, true, false] },
  { id: "father", who: "Father", initials: "Pa", state: "Not invited yet", on: [false, false, false] },
  { id: "school", who: "Kabir’s school", initials: "KS", state: "E-card for emergencies", on: [true, true, false] },
];

export const addMemberRelations = ["Spouse", "Child", "Mother", "Father", "Sibling’s family", "Someone else"];
export const addMemberFlow = [
  { icon: "✉", title: "Invite goes to their phone", detail: "A link that signs them in with a one-time code. No app needed." },
  { icon: "▤", title: "Their policies join this file", detail: "They add them, or say yes to DigiLocker. Knowvia reads them." },
  { icon: "◎", title: "They see only what they share", detail: "Their medical records stay theirs. You see what they allow." },
  { icon: "▣", title: "Their e-card in their wallet", detail: "Apple, Google or Samsung Wallet, set up for them." },
];
