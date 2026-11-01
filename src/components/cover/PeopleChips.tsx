import { groupPeople, headCount, type Person } from "./people";
import s from "./PeopleChips.module.css";

const MAX = 4;

/** Stacked avatars plus a head count. The names stay available to screen readers and on hover. */
export function PeopleChips({ people }: { people: Person[] }) {
  const groups = groupPeople(people);
  const n = headCount(groups);
  const names = groups.map((g) => g.label).join(", ");
  const shown = groups.slice(0, MAX);
  const extra = groups.length - shown.length;
  return (
    <span className={s.row} title={names}>
      <span className={s.stack} aria-hidden>
        {shown.map((g, i) => (
          <span key={g.label} className={`${s.av} ${s["t" + (i % 4)]}`}>{g.label[0]}</span>
        ))}
        {extra > 0 ? <span className={`${s.av} ${s.more}`}>+{extra}</span> : null}
      </span>
      <span className={s.count}>{n} {n === 1 ? "person" : "people"}</span>
      <span className="sr-only">{names}</span>
    </span>
  );
}
