import { describe, it, expect } from "vitest";
import { classify, INTENTS, type Intent } from "@/agent/classify";
import { holdReducer, initialHold } from "@/agent/hold";
import { respond } from "@/agent/responder";
import { PAGE_CONTEXT, contextFor } from "@/agent/page-registry";
import { PAGES } from "@/lib/ia";
import { SHORTCUTS, createMatcher } from "@/lib/shortcuts";
import { buildIcs, googleCalendarUrl } from "@/components/remind/ics";

const PHRASES: Record<Intent, string[]> = {
  emergency: ["Papa ko chest pain hai", "there was an accident", "Mumma ko dard ho raha hai", "he is in the ICU", "we need blood urgently", "call an ambulance"],
  explain_term: ["What is co-pay?", "explain waiting period", "what does sub-limit mean", "room rent matlab kya hai", "what is a deductible"],
  ask_policy: ["Is Mumma’s cataract covered?", "Is maternity covered in my policy?", "what does page 9 say", "kya cover hai cataract", "which clause covers dental"],
  calculate: ["How much can I claim under 80D?", "what if Papa needs a bypass", "will Rs 3L be enough in 10 years", "kitna lagega surgery me", "calculate my inflation"],
  compare: ["Compare my plans", "which plan is best for my parents", "Northstar vs Meridian", "kaun sa plan better hai", "make no co-pay my top priority"],
  add_document: ["Add my policy", "upload a document", "scan my new policy", "add a receipt", "check my gmail for policies"],
  payment: ["When is my premium due?", "where is my refund", "mere paise kab aayenge", "show my renewal dates", "pay the insurance bill"],
  claim_help: ["Take up Papa’s short claim", "escalate the TPA", "my claim was rejected", "Mumma was admitted yesterday", "is this cashless?"],
  family: ["Add my sister Priya as a member", "who is on the top-up family plan", "invite Rohan", "parivar ke gaps dikhao", "send Father’s e-card"],
  navigate: ["Take me home", "go to settings", "open shortcuts", "home chalo", "take me to the desk"],
  remind: ["remind me before renewal", "add to my calendar", "tell me when this moves", "mujhe yaad dilana", "set a reminder"],
  note: ["note down Papa’s doctor visit", "write down the TPA number", "note this for later", "save this note", "remember that the claim form is due"],
  smalltalk: ["hello", "thank you", "who are you", "what can you do for me", "good morning", "namaste"],
};

describe("classifier", () => {
  for (const intent of INTENTS) {
    it(`${intent}: at least 5 phrasings`, () => {
      expect(PHRASES[intent].length).toBeGreaterThanOrEqual(5);
      for (const p of PHRASES[intent]) expect({ p, intent: classify(p).intent }).toEqual({ p, intent });
    });
  }
  it("emergency words route instantly with high confidence", () => {
    for (const p of PHRASES.emergency) {
      const c = classify(p);
      expect(c.route).toBe("/emergency");
      expect(c.confidence).toBeGreaterThanOrEqual(0.95);
    }
  });
  it("finds the person and returns three steps", () => {
    const c = classify("Papa ko chest pain hai");
    expect(c.person).toBe("Father");
    expect(c.steps).toHaveLength(3);
  });
  it("empty input is low confidence smalltalk", () => {
    expect(classify("  ").confidence).toBeLessThan(0.5);
  });
});

describe("page context", () => {
  it("has 3 examples for every route in the IA", () => {
    for (const p of PAGES) {
      const ctx = contextFor(p.href);
      expect(ctx.examples).toHaveLength(3);
      expect(ctx.page.length).toBeGreaterThan(0);
    }
    expect(Object.keys(PAGE_CONTEXT).length).toBeGreaterThanOrEqual(15);
  });
  it("resolves welcome steps", () => {
    expect(contextFor("/welcome/add").page).toBe("Getting started");
  });
});

describe("responder", () => {
  it("answers a page example with its steps and a Go to action", () => {
    const r = respond("Is Mumma’s cataract covered?", "/home");
    expect(r.steps).toEqual(["Mother · cover question", "Read senior plan p.14", "Yes, up to Rs 40,000 per eye"]);
    expect(r.route).toBe("/policies/meridian-senior");
    expect(r.goLabel).toBe("Open the clause");
  });
  it("answers a free question from household data with a page ref", () => {
    const r = respond("is cataract covered for Mumma", "/policies");
    expect(r.reply).toContain("40,000");
    expect(r.pageRef).toBeTruthy();
    expect(r.steps).toHaveLength(3);
  });
  it("routes emergencies", () => {
    expect(respond("papa ko chest pain", "/money").route).toBe("/emergency");
  });
});

describe("shortcuts", () => {
  it("has no collisions within a scope", () => {
    const seen = new Set<string>();
    for (const s of SHORTCUTS) {
      const k = `${s.scope ?? "*"}|${s.keys.join(" ")}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
    // A global single key must not be shadowed by a scoped one.
    const globals = new Set(SHORTCUTS.filter((s) => !s.scope && s.keys.length === 1).map((s) => s.keys[0]));
    for (const s of SHORTCUTS.filter((x) => x.scope)) expect(globals.has(s.keys[0]), s.id).toBe(false);
  });
  it("G sequences resolve and time out after 1 second", () => {
    let t = 0;
    const m = createMatcher({ now: () => t });
    expect(m.feed("g", "/home")).toBe("pending");
    t = 500;
    expect(m.feed("h", "/home")).toBe("go-home");
    t = 1000;
    expect(m.feed("g", "/home")).toBe("pending");
    t = 2200;
    expect(m.feed("h", "/home")).toBeNull();
  });
  it("scoped keys only fire on their page", () => {
    const m = createMatcher();
    expect(m.feed("a", "/home")).toBeNull();
    expect(m.feed("a", "/review")).toBe("accept");
    expect(m.feed("4", "/compare")).toBe("plan-4");
    expect(m.feed("4", "/home")).toBeNull();
    expect(m.feed("t", "/home")).toBe("theme");
    expect(m.feed("?", "/home")).toBe("help");
  });
});

describe("hold V state machine", () => {
  it("keydown listens, keyup submits, finish completes, escape resets", () => {
    let h = holdReducer(initialHold, { type: "keydown", key: "v" });
    expect(h).toMatchObject({ state: "listening", open: true, held: true });
    h = holdReducer(h, { type: "keydown", key: "v", repeat: true });
    expect(h.state).toBe("listening");
    h = holdReducer(h, { type: "keyup", key: "V" });
    expect(h).toMatchObject({ state: "working", held: false });
    h = holdReducer(h, { type: "finish" });
    expect(h.state).toBe("done");
    expect(holdReducer(h, { type: "escape" })).toEqual(initialHold);
  });
  it("ignores V while an input is focused and ignores other keys", () => {
    expect(holdReducer(initialHold, { type: "keydown", key: "v", inInput: true })).toEqual(initialHold);
    expect(holdReducer(initialHold, { type: "keydown", key: "x" })).toEqual(initialHold);
    expect(holdReducer(initialHold, { type: "keyup", key: "v" })).toEqual(initialHold);
  });
});

describe("ics", () => {
  const ics = buildIcs([{ title: "Meridian renewal, senior plan", date: "2027-03-13", detail: "Pay before this date" }, { title: "Kaveri renewal", date: "2027-06-14" }]);
  it("is a valid VCALENDAR with CRLF lines", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
    expect(ics).not.toMatch(/[^\r]\n/);
  });
  it("uses all-day dates, escapes commas, ends the day after", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20270313");
    expect(ics).toContain("DTEND;VALUE=DATE:20270314");
    expect(ics).toContain("SUMMARY:Meridian renewal\\, senior plan");
    expect(ics).toContain("DTEND;VALUE=DATE:20270615");
  });
  it("builds a prefilled Google Calendar URL", () => {
    const u = new URL(googleCalendarUrl({ title: "Kaveri renewal", date: "2027-06-14" }));
    expect(u.hostname).toBe("calendar.google.com");
    expect(u.searchParams.get("dates")).toBe("20270614/20270615");
    expect(u.searchParams.get("text")).toBe("Kaveri renewal");
  });
});
