// "Things to check" data (board Audit). Invented.

export const reviewTotal = 44;

export type Decision = { q: string; options: string[] };
export const decisions: Decision[] = [
  { q: "Logos for DigiLocker, ABDM and e-RaktKosh", options: ["Show the official name until written permission arrives", "Use the logos now and ask permission later"] },
  { q: "Wallet accounts", options: ["Start with Google Wallet, add Apple Wallet later", "All wallets at launch"] },
  { q: "What the e-card QR opens", options: ["A secure link that expires", "Plain policy details"] },
  { q: "Reading receipts from email", options: ["Forward to an address first, add sign-in later", "Gmail sign-in from the start"] },
  { q: "Who writes to the TPA", options: ["Knowvia drafts, our team sends", "Knowvia sends after you approve each message"] },
  { q: "Advisor calls", options: ["First call free, then a flat fee", "Insurers pay the advisors"] },
];

export type LookItem = { t: string; where: string; href: string };
export const lookItems: LookItem[] = [
  { t: "Beta page", where: "Landing page", href: "/" },
  { t: "Speak to Knowvia", where: "Overview, dark panel", href: "/home" },
  { t: "Cover at a glance", where: "Overview, top row", href: "/home" },
  { t: "Brand logos", where: "Sign in, Wallet and Money", href: "/cards" },
  { t: "Knowvia name", where: "Every page", href: "/home" },
  { t: "Emergency in light mode", where: "Emergency", href: "/emergency" },
  { t: "Add family by phone number", where: "Family", href: "/family" },
  { t: "Compare, Stress test and Family pages", where: "Compare, Stress test, Family", href: "/compare" },
];
