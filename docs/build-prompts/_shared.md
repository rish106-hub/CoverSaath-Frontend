<context>
You are building part of the Knowvia web app (health insurance helper for Indian families) in
`/Users/rishavdewan/Developer/Product experiments/CoverSaath frontend`.
The product name is Knowvia; the assistant is "Ask Knowvia". Never show "CoverSaath" or "Saath" on screen.
</context>

<read_first>
1. `BUILD-SPEC.md` (wins over everything else).
2. The `design/*.dc.html` boards named in your task. They are HTML templates with `{{holes}}`, `<sc-for>` and `<sc-if>`; the data and behaviour live in the `<script>` at the bottom (`__rv()`). Copy layout, copy text and data from them exactly; ignore the canvas-only bits (`.cs.dark` invert filter, `themebtn` markup, `__voice()` plumbing: those are rebuilt properly in W0/W1).
3. `src/` as it exists on your branch.
</read_first>

<rules>
- Phase 1: no network calls, no backend. Everything external goes through `src/adapters` (mock implementations).
- Screens import from `src/adapters`, `src/components`, `src/lib`, `src/agent`, never from `src/adapters/mock/*` directly.
- Typography and segmentation exactly as BUILD-SPEC section 3: no pill/circle eyebrow labels, no text under 13 px except key caps, section headings 20/600 with a 1 px rule, page header from the shell component.
- No shortcut hint text on pages. No banned words (BUILD-SPEC section 10).
- Light theme default, dark via tokens; check both. Never put light text on a light surface.
- Synthetic data only (the Meera Rao household). No real people, policies, phone numbers or keys.
- Do not add runtime dependencies beyond BUILD-SPEC section 2 without a line in `docs/decisions.md`.
- Do not touch files outside your ownership list except by appending to the shared files named in `docs/build-prompts/README.md`.
- Do not push, do not create GitHub repos, do not change git config. Commit on your branch only.
</rules>

<done_when>
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` pass on your branch.
- Every route you own renders at 1280×800 and 1440×900 without horizontal scroll (state how you checked; if you could not render, say "not visually verified").
- Your report lists: files added/changed, tests added, what you could not verify, any deviation from the boards and why.
</done_when>
