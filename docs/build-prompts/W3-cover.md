<task id="W3" branch="feat/cover" base="W0 commit on main" model="sonnet-5.5" effort="medium">
Build the "My cover" group.

<boards>Home, Reading, Policy (stress test), Compare, Audit.</boards>

<build>
1. `/home` from `design/Home.dc.html`: HomeSidebar, kicker + greeting, Ask Knowvia strip slot (W1 component; render a placeholder slot if not merged), **Cover at a glance** full width (health ring + 6 tiles, counting numbers), then in this order: Needs your attention, Your year (date tiles, ←/→ move, Enter opens, RemindRow under the heading), Your policies by type, Cover per person (amount/share toggle), Claims, Money desk + We're handling previews, stress test + advisor, tools, learn.
2. `/policies` and `/policies/[id]` from `design/Reading.dc.html`: answers next to the clause, marker highlight, documents-disagree in coral, page-ref line 13 px Geist.
3. `/stress-test` from `design/Policy.dc.html`: logic in `src/lib/stress.ts`, port the board's `calc(who, sc, o)` including the top-up rule; unit-test every scenario × person against the board's numbers.
4. `/compare` from `design/Compare.dc.html`: priority weights → fit score (`src/lib/fit.ts`, tested), best fit in `Recommended` style, keys 1–4 pick a plan.
5. `/review` from `design/Audit.dc.html`: header "N things need you. Knowvia handled the rest." + ring; lilac recommendations with Accept / Edit / options and Accept all; "New this round" with Open / ✓ / Change; `A`/`C` keys. Never list auto-resolved items.
6. Register page contexts. Use `SectionHeading` for every section.
</build>

<owns>src/app/(app)/home/**, src/app/(app)/policies/**, src/app/(app)/stress-test/**, src/app/(app)/compare/**, src/app/(app)/review/**, src/components/cover/**, src/lib/stress.ts, src/lib/fit.ts.</owns>
</task>
