// "Things to check" data (board Audit). Invented.

export const reviewTotal = 44;

export type Decision = { q: string; options: string[] };
export const decisions: Decision[] = [
  { q: "Logos for DigiLocker, ABDM, e-RaktKosh", options: ["Show the official name until written permission arrives", "Use the marks now and ask later"] },
  { q: "Wallet accounts", options: ["Google Wallet first (free), Apple once the developer account is bought", "All three at launch"] },
  { q: "What the e-card QR opens", options: ["A signed link that expires, showing the e-card", "Plain policy text"] },
  { q: "Reading receipts from email", options: ["Forward-to-address first, Gmail and Outlook sign-in after app review", "Gmail sign-in from day one"] },
  { q: "Who talks to the TPA", options: ["Knowvia drafts, a person on our team sends", "Knowvia sends after you approve each message"] },
  { q: "Advisor calls", options: ["First call free, flat fee after; advisors see only what you share", "Advisors paid by insurers"] },
];

export type LookItem = { t: string; where: string; href: string };
export const lookItems: LookItem[] = [
  { t: "Beta page, short and simple", where: "Landing · whole page", href: "/" },
  { t: "Speak to Knowvia sheet", where: "Home · yellow button in the dark panel", href: "/home" },
  { t: "Cover at a glance, bigger", where: "Home · top row", href: "/home" },
  { t: "Real logos: Google, Apple, WhatsApp, wallets", where: "Sign in, Wallet, Money", href: "/cards" },
  { t: "Knowvia name everywhere", where: "Every page", href: "/home" },
  { t: "Emergency in light mode", where: "Emergency · whole page", href: "/emergency" },
  { t: "Add family by phone number", where: "Family · Add family member", href: "/family" },
  { t: "Compare, Stress test, Family redesigns", where: "Compare, Stress test, Family", href: "/compare" },
];
