// W6: use shortcuts.ts (src/lib/shortcuts.ts is owned by W1; this copy follows BUILD-SPEC 5.2).
export type KeyRow = { keys: string[]; label: string };
export type KeyGroup = { title: string; rows: KeyRow[] };

export const KEY_GROUPS: KeyGroup[] = [
  {
    title: "Go to",
    rows: [
      { keys: ["G", "H"], label: "Home" },
      { keys: ["G", "P"], label: "My policies" },
      { keys: ["G", "S"], label: "Stress test" },
      { keys: ["G", "C"], label: "Compare" },
      { keys: ["G", "M"], label: "Money" },
      { keys: ["G", "D"], label: "Claims and insurer talks" },
      { keys: ["G", "F"], label: "Family" },
      { keys: ["E"], label: "Emergency" },
    ],
  },
  {
    title: "Ask Knowvia",
    rows: [
      { keys: ["V"], label: "Hold to speak" },
      { keys: ["/"], label: "Type to Knowvia" },
      { keys: ["⌘K"], label: "Search and actions" },
    ],
  },
  {
    title: "On any page",
    rows: [
      { keys: ["N"], label: "Add a document" },
      { keys: ["T"], label: "Switch light or dark" },
      { keys: ["?"], label: "All shortcuts" },
      { keys: ["Esc"], label: "Close" },
    ],
  },
  {
    title: "Lists and people",
    rows: [
      { keys: ["J"], label: "Next card" },
      { keys: ["K"], label: "Previous card" },
      { keys: ["Enter"], label: "Open" },
      { keys: ["1–5"], label: "Switch person" },
      { keys: ["1–4"], label: "Pick a plan on Compare" },
      { keys: ["A"], label: "Accept a thing to check" },
      { keys: ["C"], label: "Change a thing to check" },
    ],
  },
];

export const ALL_COMBOS = KEY_GROUPS.flatMap((g) => g.rows.map((r) => r.keys.join(" ")));
