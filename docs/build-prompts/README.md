# Build prompts: Knowvia app phase 1

Model routing (owner): **Opus** for the hardest work (contracts, BFF and data design, spec, reviews of each run); **Sonnet 5.5, medium effort** for all build and manual work inside the worktrees. Worktrees live in `../Knowvia Frontend.worktrees/`.

## Order

```
W0 Foundation (main, alone)  ──►  W1 Agent + shortcuts ─┐
                                   W2 Public + onboarding│
                                   W3 My cover           ├─►  W6 Integrate, check, push (main)
                                   W4 My family + money  │
                                   W5 Help               ┘
```

- W0 runs first on `main` and commits. W1–W5 then run **in parallel**, each in its own git worktree on its own branch cut from W0's commit. W6 merges them in order W1 → W5 and runs the full checks.
- Each prompt = `_shared.md` + its own file. Paste both, in that order.
- File ownership is strict (listed per prompt) so the parallel branches do not conflict. Shared files (`src/adapters/index.ts`, `src/agent/page-context.ts`, `src/data/mock/*`) are only extended by appending; W6 resolves any overlap.

| Run | Branch | Owns |
|---|---|---|
| W0 | `feat/w0-dry-run` | scaffold, tokens, theme, fonts, app shell, logos, adapters + mocks, mock data |
| W1 | `feat/agent` | Ask Knowvia dock/card/strip, classifier, voice, palette, shortcuts, `?` overlay, RemindRow |
| W2 | `feat/public` | `/`, `/signin`, `/welcome/*`, `/cards` |
| W3 | `feat/cover` | `/home`, `/policies`, `/stress-test`, `/compare`, `/review` |
| W4 | `feat/family-money` | `/family`, `/money`, `/tools` |
| W5 | `feat/help` | `/desk`, `/emergency`, `/assistant`, `/shortcuts`, `/settings` |
| W6 | `main` | merge, full checks, README (GitHub repo `knowvia-frontend` later, on owner say-so) |
