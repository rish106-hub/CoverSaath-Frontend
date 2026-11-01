# Keyboard, mouse and voice walkthrough

The same journey three ways: `/` (beta access) to `/signin` to `/welcome` to `/home` to `/emergency`. Automated in `e2e/walkthrough.spec.ts`.

## Keyboard only

1. On `/`, `Tab` to the name field, type a name, `Tab` to email, type it, `Tab` to "Get access", `Enter`. Success reads "You're in, {name}" with a Continue link; `Enter` follows it to `/welcome`. (Continue with Google is the first `Tab` stop.)
2. `/signin` is reachable by its link on the landing page; its 6 code boxes accept a pasted code, `Tab` moves between sign-in methods.
3. On `/welcome`, `Tab` to the start link, `Enter`. Step pages `/welcome/add`, `/reading`, `/people`, `/ready` have a Back and a Continue button in tab order; "Skip to home" is the first stop.
4. On `/home` (no field focused): `G` then `H` stays on Home, `V` held opens Ask Knowvia, `Esc` closes it, `T` flips light and dark, `?` lists every shortcut.
5. `E` goes straight to `/emergency`. There, `1` to `5` pick the person, `Tab` reaches Call 112, 108, TPA, Share location, then the e-card buttons and the desk checklist (`Space` toggles a step).

Keys are ignored while a text box is focused, so typing never triggers a shortcut. `Esc` closes whichever layer is on top: shortcut overlay, palette, then the Ask Knowvia card.

## Mouse only

Every action has a visible control with a target of at least 44 px: the landing access card, the left sidebar groups (My cover, My family, My money, Help), the red Emergency link at the bottom of the sidebar, person pills, Call buttons, Show QR and Send to WhatsApp. The dock at the bottom centre and the Home strip open Ask Knowvia by click; its example chips can be clicked instead of typed. The theme toggle is bottom-left.

## Voice only

Hold `V` (or click the orb) and say it, in English, Hindi or both: "Papa ko chest pain hai" routes to Emergency at once; "Open Home", "Show my open cases", "Nearest cashless hospital". The card shows what it heard, three steps ticking, and a green "Go to ..." button when the answer lives on another page. Where the browser has no speech recognition the card falls back to a text box and says so. Release `V` to send.
