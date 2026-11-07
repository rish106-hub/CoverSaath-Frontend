# Cookie inventory

Status: FOR LEGAL REVIEW. This file is an engineering record, not legal advice. The classification (essential or not), the
retention wording and any notice or consent text shown to people must be reviewed by counsel before launch. Nothing here is final.

Source of truth for the flags: `src/server/backend/cookie-policy.ts`. Tests asserting the exact `Set-Cookie` attributes:
`tests/server/cookies.test.ts`.

## Cookies set by this app

| Name | Purpose | Flags | TTL | Essential |
| --- | --- | --- | --- | --- |
| `__Host-kv_session` (plain `kv_session` on loopback http only) | Signed-in session. Holds the backend session token, household id and member id, sealed (AES-256-GCM, key id bound as authenticated data). The browser never sees the token in the clear. | `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain` (host-only; required by the `__Host-` prefix) | `Max-Age` = time to expiry, at most 7 days and at least 60 seconds. The sealed expiry is capped at 7 days too. Cleared on sign-out (`Max-Age=0`, epoch `Expires`, same attributes). | Yes: strictly necessary to provide the service the person asked for. |
| `__Secure-kv_oauth` (plain `kv_oauth` on loopback http only) | Google sign-in only. Holds `state`, `nonce` and the PKCE verifier between the redirect to Google and the callback. Sealed with a key domain-separated from the session key. | `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/api/app/auth/google`, no `Domain` (path-scoped, so `__Secure-` rather than `__Host-`) | 600 seconds. Cleared at the start of every callback, whatever the outcome (single use). | Yes: strictly necessary for the sign-in the person requested. Only set when Google sign-in is switched on. |

`SameSite=Lax` is kept (not `Strict`) for both: the app is opened from outside links, and the Google callback is a top-level
navigation from `accounts.google.com`, which `Strict` would drop. Cross-site request forgery on state-changing routes is
handled separately by the same-origin guard (`src/server/backend/guard.ts`).

### Name prefixes

When the cookie is Secure the browser enforces the prefix: `__Host-kv_session` can only be set by a secure origin with `Path=/` and
no `Domain`, so a sibling subdomain or a plain-http page cannot plant or overwrite it. Plain names are used only for loopback http
development. Everything that reads or clears the cookie (`readSession`, `writeSession`, `clearSession`, `src/proxy.ts`, the Google
routes) picks the name from the same Secure decision.

### When `Secure` is off

`Secure` is on for every request except a plain-http request to a loopback host (`localhost`, `*.localhost`, `127.0.0.1`,
`::1`), so local development works. The decision uses the request host and `x-forwarded-proto`, not `NODE_ENV`. A request that
arrived over https (`x-forwarded-proto: https`) is always `Secure`, and an unknown host fails closed to `Secure`. Secure is also never dropped when `COOKIE_SECURE=always`, when `VERCEL` is set, or when `APP_ORIGIN` is an https origin, whatever `Host` arrives.

## Key rotation (`kv_session`)

The sealed value is `kid.iv.tag.ciphertext`. `kid` is a short public fingerprint of the secret that sealed it.

| Variable | Role |
| --- | --- |
| `SESSION_COOKIE_SECRET` | Current secret. Every cookie is sealed with it. |
| `SESSION_COOKIE_SECRET_PREVIOUS` | Optional. Read-only: cookies sealed with it are still accepted, then re-sealed with the current secret (same expiry, not extended). Ignored if shorter than 32 characters or equal to the current secret. |
| `SESSION_COOKIE_ACCEPT_LEGACY` | Set to `0` to close the transition below. |

Rotation steps (nobody is signed out):
1. Copy the current `SESSION_COOKIE_SECRET` value into `SESSION_COOKIE_SECRET_PREVIOUS`.
2. Set a new `SESSION_COOKIE_SECRET`. Deploy.
3. Wait at least 7 days (the maximum session life), then remove `SESSION_COOKIE_SECRET_PREVIOUS`. Remaining old cookies stop working and those people sign in again.

To force everyone out at once (suspected leak): rotate the secret and do not set a previous one.

A cookie that fails the tag check, carries an unknown key id, is malformed, expired, or expires more than 7 days ahead is
rejected (the person is treated as signed out). Re-sealing happens where cookies are writable (route handlers); a Server
Component read leaves the old value until the next route call.

### One-time transition for the old plain cookie name

Before the prefix change the session cookie was plain `kv_session`. Over https, while `SESSION_COOKIE_ACCEPT_LEGACY` is not `0`,
`readSession` falls back to a plain `kv_session` when no `__Host-kv_session` is present. If it is valid it is re-sealed under
`__Host-kv_session` (same expiry) and the plain one is cleared. Sign-in and sign-out also clear any plain `kv_session`. People
keep their session across the deploy. Closing the transition (`SESSION_COOKIE_ACCEPT_LEGACY=0`) after 7 days makes the plain name
ignored. `kv_oauth` has no transition: it lives 10 minutes, so an in-flight Google sign-in at deploy time just starts again.

### One-time transition for cookies without a key id

Cookies sealed before this change have three parts and no key id. They are accepted once with the current key only (never the
previous key), then re-sealed in the new format. This window closes by itself in 7 days, when every old cookie has expired. After
that, set `SESSION_COOKIE_ACCEPT_LEGACY=0` and the compatibility path is refused. If the secret was rotated in the same deploy, old
cookies are simply rejected (people sign in again).

## Not cookies

Browser `localStorage` is used for interface preferences only (theme cache, collapsed navigation groups, how many times the
voice coach intro was shown). No personal data, no identifiers sent to a server. Listed here so the notice can describe it;
legal to decide whether it needs mention.

## Future (not built)

A non-essential consent cookie (remembering a person's analytics or marketing choice) is planned under F5. It does not exist yet.
When added it needs its own row here (name, purpose, flags, TTL, non-essential), must be set only after a choice is made, and the
wording shown to people needs legal review. The app currently sets no analytics, advertising or tracking cookies of its own.

## Google sign-in feature flag

The Google flow is off unless `NEXT_PUBLIC_GOOGLE_SIGNIN=1` is set. The button needs the flag at build; the routes also refuse
(`/signin?error=google_unavailable`, no cookie set) without it, and without `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
`KNOWVIA_IDENTITY_TOKEN`. Keep it unset in Production until the owner has an OAuth client and has approved it.

## Follow-ups (not done here)

- Content-Security-Policy still allows `script-src 'unsafe-inline'` (Next inline bootstrap scripts). Moving to nonces or hashes
  would remove it; it needs per-request nonce plumbing and is tracked as a follow-up, not part of the cookie work.
- HSTS has no `preload`; see `docs/deploy.md` for the owner decision.
