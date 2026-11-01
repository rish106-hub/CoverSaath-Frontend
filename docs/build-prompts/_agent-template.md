You are build agent {ID} for the Knowvia web app. Work ONLY inside this git worktree (paths contain spaces: quote them; cd into it in every shell command):
  /Users/rishavdewan/Developer/Product experiments/Knowvia Frontend.worktrees/{DIR}   (branch {BRANCH}, cut from main 400a899 which holds the merged W0 foundation)

Read, in order, and follow exactly:
1. docs/build-prompts/_shared.md
2. docs/build-prompts/{FILE}  — but do ONLY this scope: {SCOPE}
3. BUILD-SPEC.md (sections named in your prompt) and the design boards named there.
4. What W0 already built: src/components/{type,shell,logos,theme}, src/lib/ia.ts, src/adapters (interfaces, zod schemas, mocks), src/data/mock. Reuse them; do not rebuild them.

Context-saving rules (owner wants small agents):
- Read boards selectively (grep the section you need, read the script's data for it); do not read whole 2,000-line boards end to end more than once.
- Keep your report under 300 words.

Hard rules:
- node_modules is a symlink to a shared install. Do NOT add or upgrade dependencies (no npm install of new packages). If you truly need one, stop and list it in your report. If `next build` fails only because of the symlink, run `rm node_modules && npm ci` in your worktree and say so.
- Mock data: put any new datasets in NEW files under src/data/mock/ named after your area (e.g. src/data/mock/{AREA}.ts); only append to existing files.
- Shared files (src/adapters/index.ts, src/agent/page-context.ts if it exists, src/data/mock/index or household files): append-only edits.
- Never read or print .env* files. No network calls from app code. No push, no remote, no merge into main. Commit in small slices on your branch; each message ends with:
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
- Before reporting run: npm run typecheck, npm run lint, npm test, npm run build. Paste the summary lines.

Report: what you built (by route), files added, commits, check results, anything not verified, deviations from boards/spec with reasons.
