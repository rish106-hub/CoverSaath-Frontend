export type RemindItem = { title: string; /** YYYY-MM-DD */ date: string; detail?: string };

const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (d: string) => d.replace(/-/g, "");

function nextDay(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + 1));
  return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, "0")}${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** RFC 5545 calendar with one all-day event per item. Lines end in CRLF. */
export function buildIcs(items: RemindItem[], stamp = "20261101T000000Z"): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Knowvia//Reminders//EN", "CALSCALE:GREGORIAN"];
  items.forEach((it, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:knowvia-${compact(it.date)}-${i}@knowvia.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(it.date)}`,
      `DTEND;VALUE=DATE:${nextDay(it.date)}`,
      `SUMMARY:${esc(it.title)}`,
      ...(it.detail ? [`DESCRIPTION:${esc(it.detail)}`] : []),
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Prefilled Google Calendar event for one item. */
export function googleCalendarUrl(it: RemindItem): string {
  const q = new URLSearchParams({ action: "TEMPLATE", text: it.title, dates: `${compact(it.date)}/${nextDay(it.date)}`, details: it.detail ?? "" });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
