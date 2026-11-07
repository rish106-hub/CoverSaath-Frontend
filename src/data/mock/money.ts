import type { Receipt, DeskCase } from "@/adapters/schemas";

export const receipts: Receipt[] = [
  { id: "r1", memberId: "father", label: "Cardiology consult", amountRs: 3200, date: "2026-10-08", source: "gmail" },
  { id: "r2", memberId: "mother", label: "Cataract pre-check", amountRs: 2100, date: "2026-09-21", source: "gmail" },
  { id: "r3", memberId: "meera", label: "Premium, Kaveri top-up", amountRs: 8400, date: "2026-06-14", source: "gmail" },
  { id: "r4", memberId: "meera", label: "Premium, Kaveri top-up (second debit)", amountRs: 8400, date: "2026-06-16", source: "gmail" },
  { id: "r5", memberId: "kabir", label: "Paediatrician visit", amountRs: 900, date: "2026-08-30", source: "upload" },
];

export const deskCases: DeskCase[] = [
  { id: "c1", title: "Father’s short-settled claim", detail: "With the TPA · reopened Mon", status: "In progress", progress: 50, eta: "Tue" },
  { id: "c2", title: "Duplicate premium refund", detail: "Rs 15,850 · both receipts found", status: "In progress", progress: 25, eta: "Fri" },
  { id: "c3", title: "Sign the claim form", detail: "One signature, 30 seconds", status: "Needs you", progress: 90, eta: "today" },
  { id: "c4", title: "Compare parents’ renewal", detail: "Starts 13 Feb", status: "Scheduled", progress: 0, eta: "104 days" },
  { id: "c5", title: "Mother’s cataract pre-approval", detail: "Approved by Meridian Care", status: "Done", progress: 100, eta: "done" },
];
