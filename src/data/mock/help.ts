import type { Hospital, BloodStock, Finding, DocumentItem } from "@/adapters/schemas";

export const hospitals: Hospital[] = [
  { id: "h1", name: "Sahyadri Care Hospital", km: 2.1, cashless: true, phone: "+91 20 5550 0101" },
  { id: "h2", name: "Lakeview Multispeciality", km: 3.4, cashless: true, phone: "+91 20 5550 0102" },
  { id: "h3", name: "Orchid General", km: 4.2, cashless: false, phone: "+91 20 5550 0103" },
  { id: "h4", name: "Riverside Heart Institute", km: 4.9, cashless: true, phone: "+91 20 5550 0104" },
];

export const bloodStock: BloodStock[] = [
  { bank: "City Blood Centre", group: "O+", units: 14, km: 2.8 },
  { bank: "Lakeview Blood Bank", group: "B+", units: 6, km: 3.6 },
  { bank: "Sahyadri Blood Bank", group: "A+", units: 9, km: 2.1 },
];

export const findings: Finding[] = [
  { policyId: "meridian-senior", label: "Cataract", answer: "Covered up to Rs 40,000 per eye", pageRef: "p.14 §3.2", disagrees: false },
  { policyId: "meridian-senior", label: "Room rent", answer: "Single private room, up to Rs 5,000 a day", pageRef: "p.9 §2.1", disagrees: true },
  { policyId: "northstar-floater", label: "Maternity", answer: "Waiting period 2 years", pageRef: "p.6 §1.4", disagrees: false },
];

export const documents: DocumentItem[] = [
  { id: "d1", name: "Northstar group policy schedule", status: "read" },
  { id: "d2", name: "Meridian Care senior plan", status: "read" },
];
