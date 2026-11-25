# T12: numbers first, no hairline text

Owner rule: opening screens and every app screen lead with numbers; no unnecessary text; no small faint ("hairline") lines.

## A. Remove these elements (delete the element, keep its siblings)
| File | Element |
|---|---|
| src/components/public/Landing.tsx | the `styles.pointD` span inside each point (keep `pointT`) |
| src/components/public/Landing.tsx | the `styles.rowS` span "20-second tour" |
| src/components/public/Landing.tsx | the `styles.statM` span under each stat (month caption) |
| src/components/public/Landing.tsx | the whole `styles.story` div under the stats |
| src/components/public/SignIn.tsx | the `styles.whyD` span inside each why card (keep icon and `whyT`) |
| src/components/access/AccessCard.tsx | the "No card needed. Leave any time." span (keep the Privacy link) |
| src/components/cover-real/parts.tsx FactItem | the quote: render only the citation. Line becomes: `{f.citation ? <p className={s.src}>{f.citation}</p> : null}` |
| src/components/cover-real/parts.tsx FactItem | the `s.status` span when `f.status` is "extracted_unverified" (still shown for "conflicting", "unknown", "user_confirmed", "reviewed_reference") |
| src/components/cover-real/RealHome.tsx | the `caption` prop on the "Policies", "Sum insured" and "Next renewal" tiles (keep caption on "Next step") |
| src/components/soon/SoonBento.tsx usage | no captions are passed (already true); SoonTile caption on Home "Cover per person" is removed |

## B. Keep (do not remove)
The trial note in AccessCard ("Trial: starts fresh each visit...") because it tells people their data is not kept. Legal links. The citation ("Your document, Page 3"). Error and empty-state bodies. Form field labels.

## C. Type floor (CSS only, no token change)
In the CSS modules of the files in section A plus src/components/ui/tiles.module.css and src/components/covers/covers.module.css: any `font-size` below 13px (or `var(--fs-12)`) becomes `var(--fs-13)`; any `font-weight` below 400 becomes 400. The `.k-soon` chip in src/styles/buttons.css changes from `var(--fs-12)` to `var(--fs-13)`.

## D. Stats on the opening page
Landing stat tiles stay exactly as they are (value + label), now without the month caption. No new numbers are invented.
