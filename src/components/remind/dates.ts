const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** ISO date for the next occurrence of "13 MAR" on or after `today` (YYYY-MM-DD). */
export function nextIso(day: string | number, month: string, today = "2026-11-01"): string {
  const m = MONTHS.indexOf(month.slice(0, 3).toUpperCase());
  const d = Number(day);
  let y = Number(today.slice(0, 4));
  const pad = (n: number) => String(n).padStart(2, "0");
  if (`${y}-${pad(m + 1)}-${pad(d)}` < today) y += 1;
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
