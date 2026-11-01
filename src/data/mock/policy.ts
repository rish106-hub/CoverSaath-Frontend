// Reading-room data for the Northstar group policy, from design/Reading.dc.html. All text is invented.

export type DocId = "policy" | "schedule";
export type Para = { before: string; mark: string; after: string; topic?: TopicId };
export type DocPage = { head: string; no: string; title: string; paras: Para[] };
export type TopicId = "sum" | "room" | "icu" | "copay" | "wait" | "auth";
export type Topic = {
  id: TopicId;
  label: string;
  value: string;
  plain: string;
  ref: string;
  /** page key "doc:page", or null when not found yet */
  at: string | null;
  state: string;
  disagrees?: boolean;
};

const p = (before: string, mark = "", after = "", topic?: TopicId): Para => ({ before, mark, after, topic });

export const READING_POLICY_ID = "northstar-floater";

export const DOCS: { id: DocId; name: string }[] = [
  { id: "policy", name: "Group policy wording" },
  { id: "schedule", name: "Policy schedule" },
];

export const PAGES: Record<string, DocPage> = {
  "policy:4": { head: "GROUP HEALTH POLICY · SECTION 3", no: "PAGE 4 OF 18", title: "3. Benefits", paras: [
    p("3.1 The Company will indemnify reasonable and customary medical expenses incurred on hospitalisation of an insured person, subject to the limits below."),
    p("3.2 ", "Room rent, boarding and nursing: up to 1% of the sum insured per day.", " Where a higher room category is chosen, associated medical expenses are payable in the proportion that the eligible room rent bears to the actual room rent.", "room"),
    p("3.3 ", "Intensive care unit charges: up to 2% of the sum insured per day.", "", "icu"),
    p("3.4 Pre-hospitalisation expenses for 30 days and post-hospitalisation expenses for 60 days are covered."),
  ] },
  "policy:5": { head: "GROUP HEALTH POLICY · SECTION 4", no: "PAGE 5 OF 18", title: "4. Waiting periods", paras: [
    p("4.1 ", "An initial waiting period of 30 days applies from the policy start date, except for accidents.", "", "wait"),
    p("4.2 Pre-existing diseases declared at enrolment are covered from day one under this group policy."),
    p("4.3 Maternity benefits are subject to the limits in the schedule."),
  ] },
  "policy:9": { head: "GROUP HEALTH POLICY · SECTION 7", no: "PAGE 9 OF 18", title: "7. Claims", paras: [
    p("7.1 Cashless facility is available at network hospitals through the TPA."),
    p("7.2 ", "For a planned admission, request pre-authorisation before admission; for an emergency, within 24 hours of admission.", "", "auth"),
    p("7.3 Reimbursement claims must be filed within 30 days of discharge."),
  ] },
  "schedule:1": { head: "POLICY SCHEDULE", no: "PAGE 1 OF 3", title: "Schedule of cover", paras: [
    p("Plan: Group Health Secure 2026"),
    p("", "Sum insured: Rs 5,00,000 per policy year, family floater.", "", "sum"),
    p("Members: employee, spouse, one child."),
  ] },
  "schedule:2": { head: "POLICY SCHEDULE", no: "PAGE 2 OF 3", title: "Sub-limits", paras: [
    p("Room rent: as per policy wording."),
    p("", "ICU: no sub-limit.", "", "icu"),
    p("Co-payment: as per policy wording."),
  ] },
};

export const TOPICS: Topic[] = [
  { id: "sum", label: "Cover amount", value: "Rs 5,00,000 a year", plain: "The most the policy may pay in a year, shared by everyone on it.", ref: "Sched. p.1", at: "schedule:1", state: "Read, not checked" },
  { id: "room", label: "Room rent", value: "Up to 1% of cover per day", plain: "A limit on the daily room charge. A costlier room can reduce what is paid on the whole bill.", ref: "p.4 §3.2", at: "policy:4", state: "Read, not checked" },
  { id: "icu", label: "ICU", value: "Your documents disagree", plain: "The policy says 2% of cover per day; the schedule says no limit. Ask the insurer which applies.", ref: "p.4 · Sched. p.2", at: "policy:4", state: "Two documents, two answers", disagrees: true },
  { id: "copay", label: "Co-payment", value: "Not in the pages read so far", plain: "A share of each claim you pay yourself. Not found in these documents yet.", ref: "—", at: null, state: "Not found yet" },
  { id: "wait", label: "Waiting period", value: "30 days for illness", plain: "Time after the start date when only accidents are covered.", ref: "p.5 §4.1", at: "policy:5", state: "Read, not checked" },
  { id: "auth", label: "Cashless approval", value: "Before a planned stay", plain: "For emergencies, within 24 hours of admission. The hospital desk raises it with the TPA.", ref: "p.9 §7.2", at: "policy:9", state: "Read, not checked" },
];

export type GuideCard = { icon: string; kind: string; title: string; tone: "sand" | "mist" | "coral" | "lilac" };
const GUIDES: Partial<Record<TopicId, GuideCard[]>> = {
  room: [
    { icon: "▣", kind: "Guide · 4 min", title: "Room rent, explained with one bill", tone: "sand" },
    { icon: "▶", kind: "Video · 6:12", title: "Picking a room at the hospital desk", tone: "mist" },
  ],
  icu: [
    { icon: "◐", kind: "Guide · 3 min", title: "When two documents disagree", tone: "coral" },
    { icon: "?", kind: "Guide · 2 min", title: "How to ask your insurer which applies", tone: "lilac" },
  ],
};
const DEFAULT_GUIDES: GuideCard[] = [
  { icon: "≡", kind: "Guide · 4 min", title: "Reading your policy in 10 minutes", tone: "mist" },
  { icon: "%", kind: "Guide · 3 min", title: "Co-pay and sub-limits, with examples", tone: "sand" },
];
export function guidesFor(topic: TopicId): GuideCard[] {
  return GUIDES[topic] ?? DEFAULT_GUIDES;
}

/** Page key shown for a topic, given which document tab is open. */
export function pageKeyFor(topic: Topic | undefined, doc: DocId): string {
  return topic?.at ?? (doc === "schedule" ? "schedule:1" : "policy:4");
}

/** The ICU topic shows the schedule page when the schedule tab is open. */
export function topicPageKey(topic: Topic, doc: DocId): string | null {
  if (topic.id === "icu") return doc === "schedule" ? "schedule:2" : "policy:4";
  return topic.at;
}
