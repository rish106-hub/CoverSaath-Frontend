/** Grouping and naming for the people shown on policy cards. */

export type Person = { name: string; relation?: string };
export type PersonGroup = { label: string; count: number };

export function capitalise(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** Mother and father together become one "Parents" group. Names are capitalised. */
export function groupPeople(people: Person[]): PersonGroup[] {
  const rel = (p: Person) => (p.relation ?? p.name).toLowerCase();
  const parents = people.filter((p) => rel(p) === "mother" || rel(p) === "father");
  const both = parents.some((p) => rel(p) === "mother") && parents.some((p) => rel(p) === "father");
  const out: PersonGroup[] = [];
  let placed = false;
  for (const p of people) {
    const isParent = parents.includes(p);
    if (both && isParent) {
      if (!placed) out.push({ label: "Parents", count: 2 });
      placed = true;
    } else out.push({ label: capitalise(p.name), count: 1 });
  }
  return out;
}

export function headCount(groups: PersonGroup[]): number {
  return groups.reduce((n, g) => n + g.count, 0);
}
