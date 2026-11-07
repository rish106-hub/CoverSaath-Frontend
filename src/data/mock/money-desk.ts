// Money desk board data (design/Money.dc.html). All people, insurers and amounts are invented.

type InboxReceipt = { id: string; logo: string; title: string; date: string; from: string; amountRs: number; isoDate: string; policyNumber?: string };

export const inbox: InboxReceipt[] = [
  { id: "m1", logo: "MC", title: "Meridian Care · Senior plan", date: "9 Mar", from: "renewals@", amountRs: 15850, isoDate: "2026-03-09", policyNumber: "MC-SR-001" },
  { id: "m2", logo: "MC", title: "Meridian Care · Senior plan", date: "11 Mar", from: "renewals@", amountRs: 15850, isoDate: "2026-03-11", policyNumber: "MC-SR-001" },
  { id: "m3", logo: "KG", title: "Kaveri General · Super top-up", date: "14 Jun", from: "policy@", amountRs: 7900, isoDate: "2026-06-14", policyNumber: "KG-TU-114" },
  { id: "m4", logo: "NH", title: "Northstar · Parents add-on", date: "2 Apr", from: "hr@", amountRs: 8200, isoDate: "2026-04-02", policyNumber: "NH-GR-077" },
  { id: "m5", logo: "KC", title: "Kothrud Care · Final bill", date: "21 Aug", from: "billing@", amountRs: 190000, isoDate: "2026-08-21" },
  { id: "m6", logo: "NH", title: "Northstar · Payslip deduction", date: "30 Apr", from: "payroll@", amountRs: 15900, isoDate: "2026-04-30", policyNumber: "NH-GR-077" },
];

type ExpectedRow = { id: string; title: string; amountRs: number; due: string; dueIso: string; policyNumber?: string; /** index into inbox that the board matches by hand */ manualMatch?: boolean };

export const expectedRows: ExpectedRow[] = [
  { id: "x1", title: "Parents’ senior plan", amountRs: 15850, due: "Due 13 Mar", dueIso: "2026-03-13", policyNumber: "MC-SR-001" },
  { id: "x3", title: "Kaveri super top-up", amountRs: 7900, due: "Due 14 Jun", dueIso: "2026-06-14", policyNumber: "KG-TU-114" },
  { id: "x4", title: "Parents add-on via HR", amountRs: 8200, due: "Due Apr", dueIso: "2026-04-01", policyNumber: "NH-GR-077" },
];

export const months: { name: string; amountRs: number; note: string }[] = [
  { name: "Jan", amountRs: 0, note: "" },
  { name: "Feb", amountRs: 0, note: "" },
  { name: "Mar", amountRs: 31700, note: "Parents’ senior plan, paid twice" },
  { name: "Apr", amountRs: 24100, note: "Parents add-on via HR, payslip deduction" },
  { name: "May", amountRs: 0, note: "" },
  { name: "Jun", amountRs: 7900, note: "Kaveri super top-up" },
  { name: "Jul", amountRs: 0, note: "" },
  { name: "Aug", amountRs: 3240, note: "Mother’s pharmacy bill" },
  { name: "Sep", amountRs: 0, note: "" },
  { name: "Oct", amountRs: 0, note: "" },
  { name: "Nov", amountRs: 0, note: "" },
  { name: "Dec", amountRs: 0, note: "" },
];

export const renewals = [
  { days: "12", title: "Northstar group cover", detail: "Via HR · 13 Nov · nothing to pay", amount: "Rs 0", soon: true },
  { days: "133", title: "Meridian senior plan", detail: "Parents · 13 Mar · compare first", amount: "Rs 15,850", soon: false },
  { days: "225", title: "Kaveri super top-up", detail: "Family · 14 Jun", amount: "Rs 7,900", soon: false },
];

export const byPerson = [
  { label: "Meera, Rohan, Kabir", amountRs: 24100, pct: 38, color: "var(--harbour)" },
  { label: "Top-up", amountRs: 7900, pct: 12, color: "var(--sea-glass)" },
  { label: "Parents", amountRs: 31700, pct: 50, color: "var(--ochre)" },
];

export const inFlight = [
  { title: "Father’s short-settled claim", amount: "Rs 41,800", pct: 50, status: "With the TPA · reply due Tue", done: false },
  { title: "Duplicate premium refund", amount: "Rs 15,850", pct: 25, status: "Raised with Meridian Care · Fri", done: false },
  { title: "Mother’s pharmacy bill", amount: "Rs 3,240", pct: 100, status: "Paid to your bank · 28 Oct", done: true },
];

export const weekLog = [
  { at: "Mon", text: "Found two Rs 15,850 payments in March and opened a refund." },
  { at: "Mon", text: "Matched the payslip deduction to the parents add-on." },
  { at: "Tue", text: "Built your 80D pack: Rs 63,700 across 4 receipts." },
  { at: "Wed", text: "Saw Mother’s refund land in your bank and closed it." },
  { at: "Thu", text: "Flagged the group cover renewal: nothing to pay, one form to sign." },
];

export const planWho = [
  { label: "You, Rohan, Kabir", coverLakh: 5, premiumRs: 7900, growth: 0.07 },
  { label: "Mother and Father", coverLakh: 3, premiumRs: 31700, growth: 0.12 },
];
export const planCases = [
  { label: "Heart bypass", lakh: 6.5 },
  { label: "Cancer care", lakh: 14 },
  { label: "Knee replacement", lakh: 3.8 },
  { label: "ICU, 5 days", lakh: 5.2 },
];
