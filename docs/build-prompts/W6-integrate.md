<task id="W6" branch="main" model="sonnet-5.5" effort="medium">
Merge W1–W5 into `main`, finish the cross-cutting checks, publish the private repo.

<build>
1. Merge `feat/agent`, `feat/public`, `feat/cover`, `feat/family-money`, `feat/help` in that order (no fast-forward). Resolve conflicts in shared append-only files by keeping both sides. Replace every `// W6:` note.
2. Every route registers its Ask Knowvia page context; the dock, palette, `?` overlay and theme toggle appear on every app route.
3. Tests: banned-words test over rendered text of every route (BUILD-SPEC section 10), contrast test for both themes, route smoke test (each route renders without throwing).
4. `docs/keyboard-walkthrough.md`: keyboard-only walk `/` → `/signin` → `/welcome` → `/home` → `/emergency`, plus mouse-only and voice-only notes.
5. Playwright specs for the same walk (run only if browsers are already installed; else report "not run").
6. README: routes by group, shortcuts, adapters, how to swap mocks for real APIs, phase-2 BFF note.
7. `npm run typecheck && npm run lint && npm run test && npm run build` all pass.
8. Do not create a GitHub repo or push. The owner will ask for `knowvia-frontend` (private) later.
</build>

<report>Merge notes, conflicts and how they were resolved, check output, what was not verified (visual, Playwright).</report>
</task>
