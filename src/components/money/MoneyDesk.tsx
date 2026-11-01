"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { adapters } from "@/adapters";
import { BrandLogo } from "@/components/logos/BrandLogo";
import { SectionHeading } from "@/components/type";
import { reconcileReceipts } from "@/lib/reconcile";
import { formatRs } from "@/lib/inflation";
import { inbox, expectedRows, months, renewals, byPerson, inFlight, weekLog } from "@/data/mock";
import { InflationPlanner } from "./InflationPlanner";
import { RemindRowSlot } from "./slots";
import styles from "./money.module.css";

const TOTAL = inbox.length;
const MAX_MONTH = Math.max(...months.map((m) => m.amountRs));
const ONE_LINE = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;

export function MoneyDesk() {
  const [scan, setScan] = useState(0);
  const [sel, setSel] = useState(1);
  const [manual, setManual] = useState<string[]>([]);
  const [mon, setMon] = useState(2);
  const [err, setErr] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTicker() {
    if (timer.current) clearInterval(timer.current);
    adapters.email
      .scan()
      .then(() => {
        timer.current = setInterval(() => {
          setScan((s) => {
            if (s >= TOTAL) {
              if (timer.current) clearInterval(timer.current);
              return s;
            }
            return s + 1;
          });
        }, 450);
      })
      .catch(() => setErr(true));
  }
  function runScan(from: number) {
    setErr(false);
    setScan(from);
    startTicker();
  }
  useEffect(() => {
    startTicker();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const shown = inbox.slice(0, scan);
  const done = scan >= TOTAL;
  const report = useMemo(
    () =>
      reconcileReceipts(
        shown.map((r) => ({ id: r.id, amountRs: r.amountRs, date: r.isoDate, policyNumber: r.policyNumber })),
        expectedRows.map((e) => ({ id: e.id, amountRs: e.amountRs, dueDate: e.dueIso, policyNumber: e.policyNumber })),
      ),
    [shown],
  );
  const matchedIds = new Set([...report.matches.map((m) => m.expectedId), ...manual]);
  const dup = report.duplicates[0];
  const selected = shown[sel];

  function matchSelected() {
    if (!selected) return;
    const target = expectedRows.find((e) => !matchedIds.has(e.id) && Math.abs(e.amountRs - selected.amountRs) <= 1);
    if (target) setManual((m) => [...m, target.id]);
  }

  const donut = `conic-gradient(var(--harbour) 0 38%, var(--sea-glass) 38% 50%, var(--ochre) 50% 100%)`;
  const cur = months[mon]!;

  return (
    <>
      <div className={styles.head}>
        <div className={styles.tools}>
          <span className={styles.connected}><BrandLogo id="gmail" size={22} />Gmail connected</span>
          <button type="button" className={styles.btn}>+ Outlook</button>
          <button type="button" className={styles.cta} onClick={() => runScan(done ? 3 : scan)} disabled={!done}>{done ? "Scan again" : "Scanning…"}</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.stats} aria-live="polite">
          <div><div className={styles.statLabel}>Emails scanned</div><div className={styles.stat}>{done ? "1,240" : "612"}</div></div>
          <div><div className={styles.statLabel}>Receipts found</div><div className={styles.stat}>{scan}</div></div>
          <div><div className={styles.statLabel}>Premiums this year</div><div className={styles.stat}>Rs 63,700</div></div>
          <div><div className={styles.statLabel}>80D-ready total</div><div className={`${styles.stat} ${styles.statGood}`}>Rs 63,700</div></div>
          <div className={styles.bar} role="progressbar" aria-label="Inbox scan" aria-valuenow={Math.round((scan / TOTAL) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.barFill} style={{ width: `${Math.round((scan / TOTAL) * 100)}%` }} />
          </div>
        </div>
        {err ? <span role="alert" className={styles.statLabel}>Could not read the inbox just now. Try again.</span> : null}
      </div>

      <div className={styles.cols}>
        <SectionHeading title="Found in your inbox">
          <div className={styles.col}>
            {shown.map((r, k) => (
              <button key={r.id} type="button" aria-pressed={sel === k} className={`${styles.rc} ${sel === k ? styles.rcOn : ""}`} onClick={() => setSel(k)}>
                <span className={styles.logoTile} aria-hidden>{r.logo}</span>
                <span>
                  <span className={styles.rcTitle}>{r.title}</span>
                  <span className={styles.rcSub}>{r.date} · {r.from}</span>
                </span>
                <span className={styles.mono}>{ONE_LINE(r.amountRs)}</span>
              </button>
            ))}
            <div className={styles.dash}>
              <b>Paid in cash or by cheque?</b>
              <span>Snap the receipt or forward it to <span className={styles.mono} style={{ color: "var(--harbour)" }}>meera@in.knowvia.com</span>. Knowvia files it under the right person.</span>
            </div>
          </div>
        </SectionHeading>

        <SectionHeading title="Expected this year">
          <div className={styles.col}>
            {expectedRows.map((e, i) => {
              const ok = matchedIds.has(e.id);
              return (
                <div key={e.id} style={{ display: "contents" }}>
                  <div className={`${styles.exp} ${ok ? styles.expOk : ""}`}>
                    <div className={styles.row2}><b>{e.title}</b><span className={styles.mono}>{ONE_LINE(e.amountRs)}</span></div>
                    <div className={styles.row2}><span>{e.due}</span><span className={`${styles.state} ${ok ? styles.stateOk : ""}`}>{ok ? "Matched" : "Missing"}</span></div>
                  </div>
                  {i === 0 && dup ? (
                    <div className={`${styles.exp} ${styles.expDup}`}>
                      <div className={styles.row2}><b>Second payment, same policy</b><span className={styles.mono}>{ONE_LINE(dup.amountRs)}</span></div>
                      <div className={styles.row2}><span>Not expected</span><span className={`${styles.state} ${styles.stateDup}`}>Duplicate</span></div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <button type="button" className={styles.cta} onClick={matchSelected} disabled={!selected}>Match selected</button>
          </div>
        </SectionHeading>

        <SectionHeading title="Coming up" description="Knowvia reminds you 15 days before">
          <div className={styles.card} style={{ padding: 18 }}>
            <RemindRowSlot label="Renewals" subject="Policy renewals" />
            {renewals.map((n) => (
              <div key={n.title} className={styles.due}>
                <span className={`${styles.days} ${n.soon ? styles.daysSoon : ""}`}><span className={styles.daysN}>{n.days}</span><span className={styles.daysL}>DAYS</span></span>
                <span><span className={styles.rcTitle}>{n.title}</span><span className={styles.rcSub}>{n.detail}</span></span>
                <span className={styles.mono}>{n.amount}</span>
              </div>
            ))}
          </div>
        </SectionHeading>
      </div>

      <div className={styles.midGrid}>
        <SectionHeading title="By person">
          <div className={styles.card}>
            <div className={styles.donutRow}>
              <div className={styles.donut} style={{ background: donut }} role="img" aria-label="Premiums by person: 38% family, 12% top-up, 50% parents"><div className={styles.donutHole}>63.7k</div></div>
              <div className={styles.legend}>
                {byPerson.map((p) => (
                  <span key={p.label}><span className={styles.sw} style={{ background: p.color }} />{p.label} · {formatRs(p.amountRs)}</span>
                ))}
              </div>
            </div>
            <button type="button" className={styles.btn} style={{ alignSelf: "flex-start" }}>Download 80D proof pack</button>
          </div>
        </SectionHeading>
        <SectionHeading title="Hospital bill vs paid">
          <div className={styles.card}>
            <b style={{ font: "500 14px var(--font-sans)" }}>Father · Kothrud Care · Aug</b>
            <div className={styles.split} role="img" aria-label="Paid 78 percent, gap 22 percent"><span style={{ width: "78%", background: "var(--harbour)" }} /><span style={{ width: "22%", background: "var(--signal)" }} /></div>
            <div className={styles.row2}><span>Paid Rs 1,48,200</span><span>Gap Rs 41,800</span></div>
            <Link href="/desk" className={styles.link}>We’re taking the gap up with the TPA →</Link>
          </div>
        </SectionHeading>
      </div>

      <div className={styles.lowGrid}>
        <SectionHeading title="Your year, month by month">
          <div className={styles.card}>
            <div className={styles.months} role="group" aria-label="Months">
              {months.map((m, k) => {
                const on = k === mon;
                return (
                  <button key={m.name} type="button" className={styles.month} aria-pressed={on} aria-label={`${m.name}${m.amountRs ? ` ${ONE_LINE(m.amountRs)}` : ""}`} onClick={() => setMon(k)}>
                    <span className={`${styles.monthBar} ${on ? styles.monthBarOn : m.amountRs ? styles.monthBarHas : ""}`} style={{ height: m.amountRs ? Math.max(10, Math.round((m.amountRs / MAX_MONTH) * 120)) : 4 }} />
                    <span className={`${styles.monthL} ${on ? styles.monthLOn : ""}`}>{m.name.slice(0, 1)}</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.monthNow}><span><strong style={{ fontWeight: 600 }}>{cur.name}</strong> · {cur.note || "Nothing paid this month"}</span><span className={styles.mono}>{cur.amountRs ? ONE_LINE(cur.amountRs) : "—"}</span></div>
          </div>
        </SectionHeading>
        <SectionHeading title="Money on its way back" actions={<span className={styles.big}>Rs 60,890</span>}>
          <div className={styles.card}>
            {inFlight.map((f) => (
              <Link key={f.title} href="/desk" className={styles.flight}>
                <span className={styles.row2}><b>{f.title}</b><span className={styles.mono}>{f.amount}</span></span>
                <span className={styles.track}><span className={`${styles.trackFill} ${f.done ? styles.trackDone : ""}`} style={{ width: `${f.pct}%` }} /></span>
                <span className={styles.rcSub}>{f.status}</span>
              </Link>
            ))}
          </div>
        </SectionHeading>
        <SectionHeading title="What Knowvia did this week">
          <div className={styles.dark}>
            <div className={styles.darkHead}><span>This week</span><span className={styles.live} aria-hidden /></div>
            {weekLog.map((l) => (
              <div key={l.text} className={styles.logRow}><span className={styles.logAt}>{l.at}</span><span>{l.text}</span></div>
            ))}
          </div>
        </SectionHeading>
      </div>

      <SectionHeading title="Premium and cover, years ahead">
        <InflationPlanner />
      </SectionHeading>
    </>
  );
}
