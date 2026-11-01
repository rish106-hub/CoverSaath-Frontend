"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SectionHeading } from "@/components/type";
import { section80D, roomRent, topUpFinder, formatLakhShort, TOPUP_WHO, TOPUP_BASE_LAKH, TOPUP_RISKS, type Regime, type TopUpFit } from "@/lib/calculators";
import { advisors, advisorTags, exitAsks, toolWins, moreTools, readNext } from "@/data/mock";
import styles from "./tools.module.css";

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");
const lakh = (n: number) => (n >= 100 ? `Rs ${(n / 100).toFixed(n % 100 ? 1 : 0)} Cr` : `Rs ${n}L`);

function Num({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className={styles.field}>
      {label}
      <input type="number" inputMode="numeric" min={0} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => { const v = Number(e.target.value); onChange(Number.isFinite(v) && v >= 0 ? v : 0); }} />
    </label>
  );
}
function Seg({ label, options, value, onPick }: { label: string; options: { key: string; label: string }[]; value: string; onPick: (k: string) => void }) {
  return (
    <fieldset className={styles.field}>
      <legend>{label}</legend>
      <div className={styles.seg}>
        {options.map((o) => (
          <button key={o.key} type="button" aria-pressed={o.key === value} className={`${styles.segBtn} ${o.key === value ? styles.segOn : ""}`} onClick={() => onPick(o.key)}>{o.label}</button>
        ))}
      </div>
    </fieldset>
  );
}
function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className={styles.field}>
      <legend>{label}</legend>
      <div className={styles.chips}>{children}</div>
    </fieldset>
  );
}

function Tax() {
  const [regime, setRegime] = useState<Regime>("old");
  const [self, setSelf] = useState(6200);
  const [par, setPar] = useState(38400);
  const [senior, setSenior] = useState(true);
  const r = useMemo(() => section80D({ regime, selfRs: self, parentsRs: par, senior }), [regime, self, par, senior]);
  return (
    <div className={styles.two}>
      <div className={styles.card}>
        <Seg label="Your tax regime" value={regime} onPick={(k) => setRegime(k as Regime)} options={[{ key: "old", label: "Old regime" }, { key: "new", label: "New regime" }]} />
        <Num label="Premium for you, spouse and children (Rs)" value={self} onChange={setSelf} />
        <Num label="Premium for your parents (Rs)" value={par} onChange={setPar} />
        <Seg label="Is a parent 60 or older?" value={senior ? "y" : "n"} onPick={(k) => setSenior(k === "y")} options={[{ key: "y", label: "Yes" }, { key: "n", label: "No" }]} />
        <div className={styles.note}>Premiums your employer paid do not count.</div>
      </div>
      <div className={styles.card} aria-live="polite">
        <div className={styles.note}>You can declare under 80D</div>
        <div className={styles.big}>Rs {inr(r.total)}</div>
        <div className={styles.resRow}><span>Self, spouse, children (limit Rs 25,000)</span><span>Rs {inr(r.self)}</span></div>
        <div className={styles.resRow}><span>Parents (limit Rs {inr(r.parentCap)})</span><span>Rs {inr(r.parents)}</span></div>
        {!r.available ? <div className={styles.note}>Section 80D is not available under the new tax regime.</div> : null}
                <Link href="/money" className="k-btn k-btn--primary">Add receipts</Link>
      </div>
    </div>
  );
}

function Room() {
  const [cover, setCover] = useState(500000);
  const [pct, setPct] = useState(1);
  const [room, setRoom] = useState(8000);
  const [other, setOther] = useState(120000);
  const r = useMemo(() => roomRent({ coverRs: cover, limitPct: pct, roomPerDayRs: room, otherRs: other }), [cover, pct, room, other]);
  return (
    <div className={styles.two}>
      <div className={styles.card}>
        <Num label="Cover amount (Rs)" value={cover} onChange={setCover} />
        <Num label="Room limit (% of cover per day)" value={pct} onChange={setPct} step={0.5} />
        <Num label="Hospital room (Rs per day)" value={room} onChange={setRoom} />
        <Num label="Other charges on the bill (Rs)" value={other} onChange={setOther} />
      </div>
      <div className={styles.card} aria-live="polite">
                <div className={styles.head}>{r.over ? "This room is above your limit. Other charges may be cut." : "This room is within your limit."}</div>
        <div className={styles.resRow}><span>Room limit per day</span><span>Rs {inr(r.eligible)}</span></div>
        <div className={styles.resRow}><span>Room offered per day</span><span>Rs {inr(room)}</span></div>
        <div className={styles.resRow}><span>Share of other charges paid</span><span>{Math.round(r.ratio * 100)}%</span></div>
        <div className={styles.resRow}><span>Other charges you may pay yourself</span><span>Rs {inr(r.youPayOther)}</span></div>
                <Link href="/policies" className="k-btn k-btn--primary">Check my policy</Link>
      </div>
    </div>
  );
}

function Exit() {
  return (
    <div className={styles.two}>
      <div className={styles.card}>
        <h3 className={styles.head}>Group cover usually ends on your last day.</h3>
        <div className={styles.quote}>
          <div className={styles.note}>GROUP POLICY · PAGE 14</div>
          11.2 <strong>Cover for a member and dependants ceases on the date the member leaves the employment of the policyholder.</strong> Claims for hospitalisation commencing before that date remain payable.
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.note}>Ask before you sign the exit papers</div>
        {exitAsks.map((q) => (
          <div key={q.n} className={styles.ask}><span className={styles.askN}>{q.n}</span><span><strong>{q.who}</strong> {q.text}</span></div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { key: "tax", when: "Tax proofs", t: "80D in two minutes", heading: "Section 80D" },
  { key: "room", when: "Before admission", t: "Room rent check", heading: "Room rent" },
  { key: "job", when: "Leaving a job", t: "When does my cover end?", heading: "Exit checklist" },
] as const;

const FIT_LABEL: Record<TopUpFit, string> = { recommended: "Recommended", "also-works": "Also works", "too-small": "Too small" };

function TopUp() {
  const [who, setWho] = useState(1);
  const [base, setBase] = useState(1);
  const [risk, setRisk] = useState(0);
  const [pick, setPick] = useState(-1);
  const bill = TOPUP_RISKS[risk]!.billLakh;
  const baseL = TOPUP_BASE_LAKH[base]!;
  const t = useMemo(() => topUpFinder({ whoIndex: who, baseLakh: baseL, billLakh: bill, pick }), [who, baseL, bill, pick]);
  const worry = TOPUP_RISKS[risk]!.label.toLowerCase();
  const head =
    t.youNow === 0
      ? `Your ${lakh(baseL)} already covers a ${worry} bill.`
      : `A ${worry} bill of about ${formatLakhShort(bill)} leaves ${formatLakhShort(t.youNow)} on you. ${t.youAfter === 0 ? "A top-up takes it to Rs 0." : `A top-up brings it to ${formatLakhShort(t.youAfter)}.`}`;
  const pc = (n: number) => (bill ? (n / bill) * 100 : 0);
  const rows = [
    { t: "Today", a: pc(t.basePays), b: 0, c: pc(t.youNow), you: t.youNow },
    { t: "With top-up", a: pc(t.basePays), b: pc(t.topPays), c: pc(t.youAfter), you: t.youAfter },
  ];
  const reset = (f: () => void) => () => { f(); setPick(-1); };
  return (
    <div id="top-up-finder" className={styles.two} style={{ scrollMarginTop: 80 }}>
      <div className={styles.card}>
                <Chips label="Who is it for">
          {TOPUP_WHO.map((w, k) => <button key={w.label} type="button" aria-pressed={who === k} className={`${styles.chip} ${who === k ? styles.chipOn : ""}`} onClick={reset(() => setWho(k))}>{w.label}</button>)}
        </Chips>
        <Chips label="Cover you have today">
          {TOPUP_BASE_LAKH.map((b, k) => <button key={b} type="button" aria-pressed={base === k} className={`${styles.chip} ${base === k ? styles.chipOn : ""}`} onClick={reset(() => setBase(k))}>{lakh(b)}</button>)}
        </Chips>
        <Chips label="Treatment">
          {TOPUP_RISKS.map((r, k) => (
            <button key={r.label} type="button" aria-pressed={risk === k} className={`${styles.chip} ${risk === k ? styles.chipOn : ""}`} onClick={reset(() => setRisk(k))}>
              {r.label}<span className={styles.chipSub}>About {formatLakhShort(r.billLakh)}</span>
            </button>
          ))}
        </Chips>
      </div>
      <div className={styles.card}>
        <div className={styles.head} aria-live="polite">{head}</div>
        <div className={styles.bars}>
          {rows.map((r) => (
            <div key={r.t} className={styles.barRow}>
              <span>{r.t}</span>
              <span className={styles.stack} role="img" aria-label={`${r.t}: cover pays ${Math.round(r.a)} percent, top-up pays ${Math.round(r.b)} percent, you pay ${Math.round(r.c)} percent`}>
                <span style={{ width: `${r.a}%`, background: "var(--harbour)" }} />
                <span style={{ width: `${r.b}%`, background: "var(--sea-glass)" }} />
                <span style={{ width: `${r.c}%`, background: "var(--signal)" }} />
              </span>
              <span style={{ font: "500 14px var(--font-mono)", color: r.you ? "var(--signal-ink)" : "var(--harbour)" }}>You pay {formatLakhShort(r.you)}</span>
            </div>
          ))}
          <div className={styles.legendRow}>
            <span><span className={styles.sw} style={{ background: "var(--harbour)" }} />Your cover pays</span>
            <span><span className={styles.sw} style={{ background: "var(--sea-glass)" }} />Top-up pays</span>
            <span><span className={styles.sw} style={{ background: "var(--signal)" }} />You pay</span>
          </div>
        </div>
        <div className={styles.opts}>
          {t.options.map((o, k) => (
            <button key={o.name} type="button" aria-pressed={k === t.pick} className={`${styles.opt} ${o.fit === "recommended" ? styles.optRec : ""} ${k === t.pick ? styles.optOn : ""}`} onClick={() => setPick(k)}>
              <span style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}><span className={styles.logo} aria-hidden>{o.logo}</span><span className={styles.badge}>{FIT_LABEL[o.fit]}</span></span>
              <span className={styles.optName}>{o.name}</span>
              <span className={styles.note}>{lakh(o.siLakh)} extra · Rs {inr(o.premiumRs)} a year</span>
              <span className={o.covers ? styles.good : styles.bad}>{o.covers ? "Covers this bill fully" : `Leaves ${formatLakhShort(o.leftOnYouLakh)} on you`}</span>
            </button>
          ))}
        </div>
        <div className={styles.compare}>
          <Link href="/compare" className="k-btn k-btn--primary">Compare top-ups</Link>
        </div>
      </div>
    </div>
  );
}

function Advisors() {
  const [tag, setTag] = useState(0);
  const [sel, setSel] = useState(0);
  const [slot, setSlot] = useState(0);
  const [mode, setMode] = useState(0);
  const [share, setShare] = useState([true, true, false]);
  const [booked, setBooked] = useState(false);
  const a = advisors[sel]!;
  const slots = [a.next, "Tomorrow 7 pm", "Sat 10 am"];
  const shares = ["Policy summary, one page", "This top-up case", "Claim history"];
  return (
    <div className={styles.two}>
      <div className={styles.card}>
        <div className={styles.chips} role="group" aria-label="Filter advisors">
          {advisorTags.map((t, k) => <button key={t} type="button" aria-pressed={tag === k} className={`${styles.chip} ${tag === k ? styles.chipOn : ""}`} onClick={() => setTag(k)}>{t}</button>)}
        </div>
        <div className={styles.advGrid}>
          {advisors.map((x, k) => (
            <button key={x.name} type="button" aria-pressed={sel === k} className={`${styles.adv} ${sel === k ? styles.advOn : ""}`} style={{ opacity: tag === 0 || x.tags.includes(tag) ? 1 : 0.5 }} onClick={() => { setSel(k); setBooked(false); }}>
              <span className={styles.advTop}>
                <span className={styles.ini} style={{ background: x.tint }} aria-hidden>{x.ini}</span>
                <span><span className={styles.advName}>{x.name}</span><span className={styles.advRole}>{x.role}</span></span>
                <span style={{ font: "500 14px var(--font-mono)" }}>★ {x.rating}</span>
              </span>
              <span className={styles.tags}><span className={`${styles.tag} ${styles.tagOk}`}>Licence checked</span>{x.langs.map((l) => <span key={l} className={styles.tag}>{l}</span>)}</span>
              <span className={styles.note}>Next free: <strong>{x.next}</strong></span>
            </button>
          ))}
        </div>
      </div>
      <div className={styles.book}>
        <div className={styles.bookWho}>
          <span className={styles.ini} style={{ background: a.tint }} aria-hidden>{a.ini}</span>
          <span><span className={styles.advName}>{a.name}</span><span className={styles.bookLbl}>First 15 minutes free</span></span>
        </div>
        <div><span className={styles.bookLbl}>Pick a time</span><div className={styles.bookChips}>{slots.map((t, k) => <button key={t} type="button" aria-pressed={slot === k} className={`${styles.bchip} ${slot === k ? styles.bchipOn : ""}`} onClick={() => { setSlot(k); setBooked(false); }}>{t}</button>)}</div></div>
        <div><span className={styles.bookLbl}>How</span><div className={styles.bookChips}>{["Call", "Video", "WhatsApp"].map((t, k) => <button key={t} type="button" aria-pressed={mode === k} className={`${styles.bchip} ${mode === k ? styles.bchipOn : ""}`} onClick={() => setMode(k)}>{t}</button>)}</div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className={styles.bookLbl}>Shared with your OK</span>
          {shares.map((t, k) => (
            <button key={t} type="button" role="checkbox" aria-checked={share[k]} className={styles.share} onClick={() => setShare((s) => s.map((v, i) => (i === k ? !v : v)))}>
              <span className={`${styles.tick} ${share[k] ? styles.tickOn : ""}`} aria-hidden>{share[k] ? "✓" : ""}</span>{t}
            </button>
          ))}
        </div>
        <button type="button" className={`${styles.bookBtn} ${booked ? styles.bookBtnDone : ""}`} onClick={() => setBooked(true)}>
          {booked ? "Booked" : `Book with ${a.name.split(" ")[0]}`}
        </button>
      </div>
    </div>
  );
}

function Wins() {
  const [win, setWin] = useState(0);
  const w = toolWins[win]!;
  return (
    <div className={styles.two}>
      <div className={styles.darkCard}>
        <div className={styles.wins}>
          {toolWins.map((x, k) => (
            <button key={x.key} type="button" aria-pressed={win === k} className={`${styles.win} ${win === k ? styles.winOn : ""}`} onClick={() => setWin(k)}>
              <span className={styles.winK}>{x.key}</span><span className={styles.winV}>{x.value}</span><span className={styles.winD}>{x.detail}</span>
            </button>
          ))}
        </div>
        <div className={styles.say}><span>“{w.say}”</span><Link href="/assistant" className="k-btn k-btn--sm">Ask Knowvia</Link></div>
        <Link href="/signin" className="k-btn k-btn--primary">Use with my policy</Link>
      </div>
      <div className={styles.morePanel}>
        {moreTools.map((m) => (
          <Link key={m.title} href={m.href} className={styles.more}>
            <span className={styles.moreTop}><span aria-hidden>{m.icon}</span><span>{m.time}</span></span>
            <span className={styles.moreT}>{m.title}</span>
            <span className={styles.moreD}>{m.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ToolsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("tax");
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <>
      <nav className={styles.tabs} aria-label="Tools">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} className={`${styles.tab} ${tab === t.key ? styles.tabOn : ""}`} onClick={() => setTab(t.key)}>
            <span className={styles.tabWhen}>{t.when}</span><span className={styles.tabT}>{t.t}</span>
          </button>
        ))}
      </nav>
      <SectionHeading title={cur.heading}>
        {tab === "tax" ? <Tax /> : tab === "room" ? <Room /> : <Exit />}
      </SectionHeading>
      <SectionHeading title="Top-up finder"><TopUp /></SectionHeading>
      <SectionHeading title="Advisors"><Advisors /></SectionHeading>
      <SectionHeading title="What these tools save"><Wins /></SectionHeading>
      <SectionHeading title="Read next">
        <div className={styles.reads}>
          {readNext.map((r) => <div key={r.title} className={styles.read}><span className={styles.readK}>{r.kind}</span><span className={styles.readT}>{r.title}</span></div>)}
        </div>
      </SectionHeading>
    </>
  );
}
