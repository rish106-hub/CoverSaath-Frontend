<task id="W5" branch="feat/help" base="W0 commit on main" model="sonnet-5.5" effort="medium">
Build the "Help" group plus Shortcuts and Settings.

<boards>Desk, Emergency, Assistant, Shortcuts.</boards>

<build>
1. `/desk` from `design/Desk.dc.html`: scoreboard, case list (J/K), case steps, thread with "Tell me when this case moves" RemindRow, escalation ladder, who we're talking to, live feed. `DeskAdapter`.
2. `/emergency` from `design/Emergency.dc.html`, **light theme** (the board's current light version; its earlier dark version is wrong). Person pills, Call 112 / 108 (real `tel:` links) / Call TPA / Share location, e-card (white, Harbour top edge, Show QR, Send to WhatsApp with logo), desk checklist, best hospital now (allow location → progress → ranked list + stylised map, cashless vs best treatment toggle, Google Maps directions links), blood near you (group grid + banks). `HospitalAdapter`, `BloodAdapter`. Must pass contrast in both themes.
3. `/assistant` from `design/Assistant.dc.html`: "How Knowvia understands you" in plain words (no intent names), try-saying list wired to the Ask Knowvia card.
4. `/shortcuts` from `design/Shortcuts.dc.html`: full key map from `src/lib/shortcuts.ts` (import if W1 merged; else copy the table and leave `// W6: use shortcuts.ts`), single-input paths.
5. `/settings`: connected sources (Gmail, DigiLocker, ABHA) connect/disconnect, notifications (WhatsApp, email, calendar), sharing, voice language, reduced motion, theme.
6. Register page contexts. Use `SectionHeading` for every section.
</build>

<owns>src/app/(app)/desk/**, src/app/(app)/emergency/**, src/app/(app)/assistant/**, src/app/(app)/shortcuts/**, src/app/(app)/settings/**, src/components/help/**.</owns>
</task>
