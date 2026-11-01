// Tools board data (design/Tools.dc.html). Advisors are invented people.

export const advisorTags = ["All", "Parents and seniors", "Claims and disputes", "Top-ups and porting"] as const;

export const advisors = [
  { ini: "AK", name: "Ananya Kulkarni", role: "Seniors and porting · 11 yrs", rating: "4.9", langs: ["Marathi", "Hindi"], next: "Today 6:30 pm", tint: "var(--marker)", tags: [1, 3] },
  { ini: "RM", name: "Rahul Menon", role: "Claims and disputes · 9 yrs", rating: "4.8", langs: ["English", "Malayalam"], next: "Tomorrow 11 am", tint: "var(--mist)", tags: [2] },
  { ini: "FS", name: "Farah Sheikh", role: "Top-ups and maternity · 7 yrs", rating: "4.9", langs: ["Hindi", "Urdu"], next: "Today 8 pm", tint: "var(--coral)", tags: [3] },
  { ini: "VJ", name: "Vikram Joshi", role: "Group to individual · 12 yrs", rating: "4.7", langs: ["English", "Marathi"], next: "Tue 4 pm", tint: "var(--rec-bg)", tags: [3, 1] },
];

export const exitAsks = [
  { n: "01", who: "HR:", text: "On what date does my group cover end?" },
  { n: "02", who: "HR:", text: "Does the policy allow moving to an individual policy, and by when?" },
  { n: "03", who: "Insurer:", text: "If I move, are waiting periods already served carried over?" },
  { n: "04", who: "Yourself:", text: "Is a planned treatment due before the last day? Claims that start before it stay payable." },
];

export const toolWins = [
  { key: "Tax saved", value: "Rs 75,000", detail: "with 80D, old regime", say: "How much tax can I save on my parents’ premium?" },
  { key: "Room charges kept", value: "Rs 38,400", detail: "by picking the right room", say: "Which room should I pick for a Rs 5 lakh cover?" },
  { key: "Cover kept", value: "0 gap days", detail: "when switching jobs", say: "When does my cover end if I resign on the 15th?" },
];

export const moreTools = [
  { icon: "◐", title: "Stress test a big claim", detail: "Knee, bypass, childbirth: who pays what", time: "1 MIN", href: "/stress-test" },
  { icon: "⇄", title: "Compare top-ups", detail: "Section by section, your cover band", time: "2 MIN", href: "/compare" },
  { icon: "◔", title: "Premium receipts check", detail: "Find premiums paid twice", time: "1 MIN", href: "/money" },
  { icon: "●", title: "Hospital near you", detail: "Cashless or best treatment", time: "20 SEC", href: "/emergency" },
];

export const readNext = [
  { kind: "Guide · 4 min", title: "Room rent, explained with one bill" },
  { kind: "Guide · 3 min", title: "80D for parents over 60" },
  { kind: "Guide · 5 min", title: "Leaving a job without a cover gap" },
  { kind: "Video · 6:12", title: "Cashless at the hospital desk" },
];

export const toolsPageContext = {
  page: "Tools",
  reads: "calculators, top-ups and advisors",
  examples: ["Find a top-up for my parents", "Book a registered advisor", "Test my cover against a big bill"],
};
