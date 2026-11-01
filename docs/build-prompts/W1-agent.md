<task id="W1" branch="feat/agent" base="W0 commit on main" model="sonnet-5.5" effort="medium">
Build the global layer: Ask Knowvia, shortcuts, command palette, reminders. BUILD-SPEC section 5.

<boards>Home (`vstrip`, `vdock`, `vcard`), any board's `__voice()` data for page context, Assistant, Shortcuts.</boards>

<build>
1. `src/agent/classify.ts`: deterministic classifier (rules + keyword/regex scoring, English + Hinglish). Intents and output shape per BUILD-SPEC 5.1. Emergency phrases ("chest pain", "papa ko dard", "accident", "ICU", "blood") return `route: /emergency` with confidence ≥ 0.95.
2. `src/agent/page-context.ts`: registry `{route → page, reads, examples[3] (say, steps[3], goHref?, goLabel?)}` filled for every route from the boards' `__voice()` data. Pages register via a `usePageContext()` hook.
3. `src/agent/responder.ts` (mock via `AssistantAdapter`): answers from page context + household data, with page refs; 3 steps that tick; a "Go to …" action when the answer lives elsewhere.
4. `src/components/agent/`: `AskDock` (bottom-centre pill), `AskCard` (460 px, opens beside its trigger, states LISTENING → WORKING → DONE, examples, footer), `AskStrip` (Home row). Voice via `VoiceAdapter` (Web Speech API; fallback text field in the same card). Hold `V` keydown = listen, keyup = submit; ignored when an input is focused; `Esc` closes; focus returns to the trigger.
5. `src/lib/shortcuts.ts`: the full key map (BUILD-SPEC 5.2) + `useShortcuts()`; `G` sequences with 1 s timeout; `T` toggles theme; `?` opens `ShortcutsOverlay`; `E` emergency; `/` opens the card in text mode.
6. `CommandPalette` (`cmdk`, `⌘K`/`Ctrl K`): Go to (all routes by group), Ask Knowvia, Tools, People, Documents, Actions.
7. `src/components/remind/RemindRow.tsx`: Google Calendar (prefilled URL), Apple Calendar (`.ics` download), WhatsApp / Email (toast via `NotifyAdapter`), brand logos.
8. Mount `AskDock`, palette and shortcuts in `AppShell` (append-only edit).
9. Tests: classifier (≥ 5 phrasings per intent, Hinglish included), shortcut map has no collisions, hold-V state machine, `.ics` content valid.
</build>

<owns>src/agent/**, src/components/agent/**, src/components/remind/**, src/components/palette/**, src/lib/shortcuts.ts, one append-only mount in AppShell.</owns>
</task>
