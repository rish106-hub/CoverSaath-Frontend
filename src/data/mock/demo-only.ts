// Sample copy and figures for the onboarding and wallet screens. Moved out of public.ts unchanged so the public screens (Landing, Tour, SignIn)
// can carry redacted data while demo-gated screens keep what they render. Never shown to a signed-in person.

export const ONBOARD_WAYS = [
  { id: "dl", logo: "DL", t: "DigiLocker", d: "Pull every policy issued to your mobile number.", time: "Fastest · 20 s" },
  { id: "up", logo: "⇪", t: "Upload a PDF", d: "Policy wording, schedule or e-card.", time: "30 s" },
  { id: "hr", logo: "✉", t: "Forward the HR mail", d: "Send it to policies@knowvia.in and we read it.", time: "Hands-free" },
  { id: "no", logo: "#", t: "Policy number", d: "Pick your insurer and enter the number.", time: "1 min" },
] as const;
export const ONBOARD_TIPS = [
  { i: "✉", t: "Search your email", d: "Type “policy schedule” or your insurer’s name. The PDF is usually attached to the welcome mail.", k: "Most people find it here", tone: "mist" },
  { i: "◫", t: "Company cover? Ask HR", d: "HR or the benefits portal has the e-card and the group policy. One message is enough.", k: "Knowvia can write the message", tone: "ochre" },
  { i: "▣", t: "Look in DigiLocker", d: "Many insurers push policies to DigiLocker under “Issued documents”.", k: "Sign in once, we fetch it", tone: "violet" },
  { i: "⚿", t: "PDF asks for a password?", d: "It is often your date of birth (DDMMYYYY) or the first four letters of your name plus birth year.", k: "Say it; we never store it", tone: "coral" },
] as const;
export const READING_FINDINGS = [
  { icon: "◎", k: "Family cover", v: "Rs 5,00,000", ref: "Schedule p.1" },
  { icon: "▣", k: "Room limit", v: "Rs 5,000 a day", ref: "p.12 §4.1" },
  { icon: "%", k: "Co-pay", v: "None", ref: "p.2" },
  { icon: "◷", k: "Waiting period", v: "Waived (group plan)", ref: "p.8 §3" },
  { icon: "◉", k: "Members", v: "Meera, Rohan, Kabir", ref: "Schedule p.1" },
  { icon: "↻", k: "Restore benefit", v: "Once a year", ref: "p.18" },
] as const;
export const READING_SAY = [
  ["My father’s card shows another number", "Noted under Father · e-card. I’ll check it against his schedule when you add it."],
  ["I think HR changed the plan in April", "Filed as a question for HR. I’ll compare this policy with the April version if you forward it."],
  ["I paid my parents’ premium twice", "Opened a case on the Desk: duplicate premium. I’ll look for both receipts in Gmail."],
] as const;
export const READING_TIPS = [
  "Rs 5,000 a day is about a private single room in most Pune hospitals.",
  "Group plans usually waive waiting periods, so old conditions are covered from day one.",
  "Restore refills your cover once if a claim uses it up in the year.",
];
export const ONBOARD_PEOPLE = [
  { id: "M", n: "Meera", rel: "You · 41", on: true },
  { id: "R", n: "Rohan", rel: "Spouse · 43", on: true },
  { id: "K", n: "Kabir", rel: "Son · 8", on: true },
  { id: "A", n: "Parents", rel: "Not on this schedule", on: false },
];
export const ONBOARD_WINS = [
  { k: "Family cover", v: "Rs 5 lakh", d: "Shared by you, Rohan and Kabir. Refills once a year if used up.", ref: "Schedule p.1 · Wording p.18", tone: "mist" },
  { k: "Room limit", v: "Rs 5,000/day", d: "Pick a room within it and other charges are paid in full.", ref: "Wording p.12 §4.1", tone: "ochre" },
  { k: "Childbirth", v: "Rs 50,000", d: "Covered from day one on this group plan, plus the newborn from birth.", ref: "Wording p.21 §6.3", tone: "coral" },
] as const;

export type WalletCardData = { full: string; no: string; mid: string; valid: string; left: string; tpa: string; line: string; insurerShort: string; blood: string; room: string; copay: string };
export const WALLET_PEOPLE: Record<string, WalletCardData> = {
  Meera: { full: "Meera Rao", no: "NHG/2026/771204", mid: "NH-771204-01", valid: "31 Mar 2027", left: "Rs 5,00,000", tpa: "Northstar TPA", line: "1800 000 0000", insurerShort: "NORTHSTAR HEALTH", blood: "O+", room: "Rs 5,000 a day", copay: "None" },
  Rohan: { full: "Rohan Rao", no: "NHG/2026/771204", mid: "NH-771204-02", valid: "31 Mar 2027", left: "Rs 5,00,000", tpa: "Northstar TPA", line: "1800 000 0000", insurerShort: "NORTHSTAR HEALTH", blood: "B+", room: "Rs 5,000 a day", copay: "None" },
  Kabir: { full: "Kabir Rao", no: "NHG/2026/771204", mid: "NH-771204-03", valid: "31 Mar 2027", left: "Rs 5,00,000", tpa: "Northstar TPA", line: "1800 000 0000", insurerShort: "NORTHSTAR HEALTH", blood: "O+", room: "Rs 5,000 a day", copay: "None" },
  Mother: { full: "Lalitha Rao", no: "SNR/2026/048212", mid: "MC-048212", valid: "13 Mar 2027", left: "Rs 3,00,000", tpa: "Meridian desk", line: "1800 111 1111", insurerShort: "MERIDIAN CARE", blood: "A+", room: "Rs 3,000 a day", copay: "20% of each claim" },
  Father: { full: "Suresh Rao", no: "SNR/2026/048213", mid: "MC-048213", valid: "13 Mar 2027", left: "Rs 2,62,000", tpa: "Meridian desk", line: "1800 111 1111", insurerShort: "MERIDIAN CARE", blood: "B+", room: "Rs 3,000 a day", copay: "20% of each claim" },
};
export const WALLET_PASSES = [
  { id: "apple", name: "Apple Wallet", note: "iPhone and Mac. Opens from the lock screen." },
  { id: "google", name: "Google Wallet", note: "Android. One tap to add." },
  { id: "samsung", name: "Samsung Wallet", note: "Galaxy phones. One tap to add." },
] as const;
export const SHARE_APPLE = ["AirDrop", "WhatsApp", "Telegram", "Email", "Messages", "Google Chat", "Slack", "Download"];
export const SHARE_OTHER = ["WhatsApp", "Telegram", "Email", "Google Chat", "Signal", "Teams", "Scan with phone", "Download"];
export const SHARE_CHANNELS = ["WhatsApp", "SMS", "Email", "Telegram", "Google Chat", "Copy link"];
