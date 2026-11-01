<task id="W4" branch="feat/family-money" base="W0 commit on main" model="sonnet-5.5" effort="medium">
Build the "My family" and "My money" groups (except Cards, which is W2).

<boards>Family, Money, Tools.</boards>

<build>
1. `/family` from `design/Family.dc.html`: person cards (1–5 keys), **Family on Knowvia** invite statuses, add-member sheet (step 1 relation chips, name, +91 mobile with validation; step 2 what happens next, send on WhatsApp / SMS via `InviteAdapter`; Enter / Esc), policy by person, at a glance, gaps, Dates the documents give + RemindRow, who sees what switches.
2. `/money` from `design/Money.dc.html`: Gmail scan (animated, `EmailAdapter`), receipts, expected, Coming up + RemindRow, by person, hospital bill vs paid, month chart, money on its way back, what Knowvia did this week, and **Premium and cover, years ahead**: inputs who / treatment / inflation (10, 12, 14, 16 %, default 12, labelled as editable) / years (5–20); SVG bars with dashed cover line (bars above cover in Signal), premium bars, 4 KPIs, lilac recommendation. Logic in `src/lib/inflation.ts` and `src/lib/reconcile.ts` (match by amount ± Rs 1, date window, policy number), both unit-tested against the board's numbers.
3. `/tools` from `design/Tools.dc.html`: 80D (old regime caps), room rent, exit-papers checklist, **top-up finder** (case by case, best in `Recommended` style), **registered advisors**.
4. Register page contexts. Use `SectionHeading` for every section.
</build>

<owns>src/app/(app)/family/**, src/app/(app)/money/**, src/app/(app)/tools/**, src/components/family/**, src/components/money/**, src/components/tools/**, src/lib/inflation.ts, src/lib/reconcile.ts, src/lib/calculators.ts.</owns>
</task>
