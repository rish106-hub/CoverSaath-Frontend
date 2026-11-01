# Decisions

Short log of choices that go beyond BUILD-SPEC.

- 2026-11-01 W0: `motion` resolved to v14 (npm latest); spec said v12. API used later is the same (`motion/react`). Revisit if W1 hits a break.
- `server-only`: marks BFF modules so they cannot reach client bundles. Tiny, official.
- `tsx` (dev): runs `scripts/dry-run.ts` with the real BFF modules via `--conditions=react-server`.
- `@vitejs/plugin-react` (dev): JSX transform for Vitest.
- Group colour My family adjusted from #B4553D to #AE503A so it clears 4.5:1 on Paper (was 4.47). Muted #8C867C stays as a decorative token only; readable text uses Graphite. Signal and Coral get separate `-ink` text tokens.
- Slack is not in simple-icons any more: it renders as a neutral name tile via `OfficialLogo` until the owner supplies a file.
- Adapter selection: Access and Household use the BFF unless `NEXT_PUBLIC_ADAPTERS=mock` or under test; every other adapter is mock until the backend has tables (`// backend gap`).
- Session cookie `kv_session`: AES-256-GCM sealed (key = sha256 of SESSION_COOKIE_SECRET), httpOnly, SameSite=Lax, 7-day cap. State-changing BFF routes need header `x-knowvia-app: 1` and a matching Origin.
