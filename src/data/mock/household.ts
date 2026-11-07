import type { Household, Policy } from "@/adapters/schemas";

// All people, insurers and numbers below are invented.
export const household: Household = {
  id: "mock-household",
  displayName: "Rao family",
  members: [
    { id: "meera", name: "Meera", relation: "self", age: 41, city: "Pune", invite: "joined" },
    { id: "rohan", name: "Rohan", relation: "spouse", age: 43, city: "Pune", invite: "joined" },
    { id: "kabir", name: "Kabir", relation: "child", age: 8, city: "Pune", invite: "none" },
    { id: "mother", name: "Mother", relation: "mother", age: 68, city: "Nashik", invite: "joined" },
    { id: "father", name: "Father", relation: "father", age: 71, city: "Nashik", invite: "sent" },
  ],
};

export const policies: Policy[] = [
  { id: "northstar-floater", name: "Group floater Rs 5L", insurer: "Northstar Health", kind: "group", sumInsuredRs: 500000, premiumRs: 0, coPayPct: 0, renewsOn: "2027-03-31", memberIds: ["meera", "rohan", "kabir"] },
  { id: "kaveri-topup", name: "Super top-up Rs 10L after Rs 5L", insurer: "Kaveri Insurance", kind: "top-up", sumInsuredRs: 1000000, premiumRs: 8400, coPayPct: 0, renewsOn: "2027-06-14", memberIds: ["meera", "kabir"] },
  { id: "meridian-senior", name: "Senior plan Rs 3L each", insurer: "Meridian Care", kind: "senior", sumInsuredRs: 300000, premiumRs: 41200, coPayPct: 20, renewsOn: "2027-03-13", memberIds: ["mother", "father"] },
];
