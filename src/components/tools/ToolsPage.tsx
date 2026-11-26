"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { features } from "@/adapters";
import { SectionHeading } from "@/components/type";
import { SoonButton } from "@/components/ui/SoonButton";
import { SaveState } from "@/components/ui/SaveState";
import { DemoGate } from "@/components/shell/EmptyState";
import { useScenario } from "@/lib/use-scenario";
import { roomCodec, taxCodec, type RoomState, type TaxState } from "@/lib/scenario-codecs";
import { section80D, roomRent, type Regime } from "@/lib/calculators";
import { advisors, advisorTags, exitAsks, toolWins, moreTools, readNext } from "@/data/mock";
import styles from "./tools.module.css";

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");

function Num({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className={styles.field}>
      {label}
      <input type="number" inputMode="numeric" min={0} step={step} placeholder="0" value={value || ""} onChange={(e) => { const v = Number(e.target.value); onChange(Number.isFinite(v) && v >= 0 ? v : 0); }} />
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
function Tax() {
  const [regime, setRegime] = useState<Regime>("old");
  const [self, setSelf] = useState(0);
  const [par, setPar] = useState(0);
  const [senior, setSenior] = useState(true);
  const r = useMemo(() => section80D({ regime, selfRs: self, parentsRs: par, senior }), [regime, self, par, senior]);
  const taxEmpty = self === 0 && par === 0;
  const value = useMemo<TaxState>(() => ({ regime, self, par, senior }), [regime, self, par, senior]);
  const { status, retry, flush } = useScenario<TaxState>({
    tool: "tax", value, codec: taxCodec,
    apply: (p) => { if (p.regime) setRegime(p.regime); if (p.self !== undefined) setSelf(p.self); if (p.par !== undefined) setPar(p.par); if (p.senior !== undefined) setSenior(p.senior); },
  });
  return (
    <div className={styles.two}>
      <div className={styles.card} onBlur={flush}>
        <Seg label="Your tax regime" value={regime} onPick={(k) => setRegime(k as Regime)} options={[{ key: "old", label: "Old regime" }, { key: "new", label: "New regime" }]} />
        <Num label="Premium for you, spouse and children (Rs)" value={self} onChange={setSelf} />
        <Num label="Premium for your parents (Rs)" value={par} onChange={setPar} />
        <Seg label="Is a parent 60 or older?" value={senior ? "y" : "n"} onPick={(k) => setSenior(k === "y")} options={[{ key: "y", label: "Yes" }, { key: "n", label: "No" }]} />
        <div className={styles.note}>Premiums your employer paid do not count.</div>
        <SaveState status={status} onRetry={retry} />
      </div>
      <div className={styles.card} aria-live="polite">
        <div className={styles.note}>You can declare under 80D</div>
        <div className={styles.big}>{taxEmpty ? "—" : `Rs ${inr(r.total)}`}</div>
        <div className={styles.resRow}><span>Self, spouse, children (limit Rs 25,000)</span><span>{taxEmpty ? "—" : `Rs ${inr(r.self)}`}</span></div>
        <div className={styles.resRow}><span>Parents (limit Rs {inr(r.parentCap)})</span><span>{taxEmpty ? "—" : `Rs ${inr(r.parents)}`}</span></div>
        {!r.available ? <div className={styles.note}>Section 80D is not available under the new tax regime.</div> : null}
                <Link href="/money" className="k-btn k-btn--primary">Add receipts</Link>
      </div>
    </div>
  );
}

function Room() {
  const [cover, setCover] = useState(0);
  const [pct, setPct] = useState(1);
  const [room, setRoom] = useState(0);
  const [other, setOther] = useState(0);
  const r = useMemo(() => roomRent({ coverRs: cover, limitPct: pct, roomPerDayRs: room, otherRs: other }), [cover, pct, room, other]);
  const roomEmpty = cover === 0 && room === 0 && other === 0;
  const value = useMemo<RoomState>(() => ({ cover, pct, room, other }), [cover, pct, room, other]);
  const { status, retry, flush } = useScenario<RoomState>({
    tool: "hospital_bill", value, codec: roomCodec,
    apply: (p) => { if (p.cover !== undefined) setCover(p.cover); if (p.pct !== undefined) setPct(p.pct); if (p.room !== undefined) setRoom(p.room); if (p.other !== undefined) setOther(p.other); },
  });
  return (
    <div className={styles.two}>
      <div className={styles.card} onBlur={flush}>
        <Num label="Cover amount (Rs)" value={cover} onChange={setCover} />
        <Num label="Room limit (% of cover per day)" value={pct} onChange={setPct} step={0.5} />
        <Num label="Hospital room (Rs per day)" value={room} onChange={setRoom} />
        <Num label="Other charges on the bill (Rs)" value={other} onChange={setOther} />
        <SaveState status={status} onRetry={retry} />
      </div>
      <div className={styles.card} aria-live="polite">
                <div className={styles.head}>{roomEmpty ? "Enter your cover and the room to see the result." : r.over ? "This room is above your limit. Other charges may be cut." : "This room is within your limit."}</div>
        <div className={styles.resRow}><span>Room limit per day</span><span>{roomEmpty ? "—" : `Rs ${inr(r.eligible)}`}</span></div>
        <div className={styles.resRow}><span>Room offered per day</span><span>{roomEmpty ? "—" : `Rs ${inr(room)}`}</span></div>
        <div className={styles.resRow}><span>Share of other charges paid</span><span>{roomEmpty ? "—" : `${Math.round(r.ratio * 100)}%`}</span></div>
        <div className={styles.resRow}><span>Other charges you may pay yourself</span><span>{roomEmpty ? "—" : `Rs ${inr(r.youPayOther)}`}</span></div>
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
        <DemoGate empty={null}>
        <div className={styles.quote}>
          <div className={styles.note}>GROUP POLICY · PAGE 14</div>
          11.2 <strong>Cover for a member and dependants ceases on the date the member leaves the employment of the policyholder.</strong> Claims for hospitalisation commencing before that date remain payable.
        </div>
        </DemoGate>
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

function TopUp() {
  return (
    <div id="top-up-finder" className={styles.card} style={{ scrollMarginTop: 80 }}>
      <p className={styles.note}>Top-up plans matched to your policy.</p>
      <SoonButton>See top-up plans</SoonButton>
    </div>
  );
}

function Advisors() {
  const [tag, setTag] = useState(0);
  const [sel, setSel] = useState(0);
  const [slot, setSlot] = useState(0);
  const [mode, setMode] = useState(0);
  const [share, setShare] = useState([true, true, false]);
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
            <button key={x.name} type="button" aria-pressed={sel === k} className={`${styles.adv} ${sel === k ? styles.advOn : ""}`} style={{ opacity: tag === 0 || x.tags.includes(tag) ? 1 : 0.5 }} onClick={() => { setSel(k); }}>
              <span className={styles.advTop}>
                <span className={styles.ini} style={{ background: x.tint }} aria-hidden>{x.ini}</span>
                <span><span className={styles.advName}>{x.name}</span><span className={styles.advRole}>{x.role}</span></span>
                <span style={{ font: "500 var(--fs-14) var(--font-mono)" }}>★ {x.rating}</span>
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
        <div><span className={styles.bookLbl}>Pick a time</span><div className={styles.bookChips}>{slots.map((t, k) => <button key={t} type="button" aria-pressed={slot === k} className={`${styles.bchip} ${slot === k ? styles.bchipOn : ""}`} onClick={() => { setSlot(k); }}>{t}</button>)}</div></div>
        <div><span className={styles.bookLbl}>How</span><div className={styles.bookChips}>{["Call", "Video", "WhatsApp"].map((t, k) => <button key={t} type="button" aria-pressed={mode === k} className={`${styles.bchip} ${mode === k ? styles.bchipOn : ""}`} onClick={() => setMode(k)}>{t}</button>)}</div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className={styles.bookLbl}>Shared with your OK</span>
          {shares.map((t, k) => (
            <button key={t} type="button" role="checkbox" aria-checked={share[k]} className={styles.share} onClick={() => setShare((s) => s.map((v, i) => (i === k ? !v : v)))}>
              <span className={`${styles.tick} ${share[k] ? styles.tickOn : ""}`} aria-hidden>{share[k] ? "✓" : ""}</span>{t}
            </button>
          ))}
        </div>
        <SoonButton>Book a call</SoonButton>
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
      {features.advisorBooking ? <SectionHeading title="Advisors"><Advisors /></SectionHeading> : null}
      {/* Savings figures are sample data: demo sessions only, never shown to a signed-in person. */}
      <DemoGate empty={null}><SectionHeading title="What these tools save"><Wins /></SectionHeading></DemoGate>
      {/* Static sample reading list: demo sessions only. */}
      <DemoGate empty={null}>
        <SectionHeading title="Read next">
          <div className={styles.reads}>
            {readNext.map((r) => <div key={r.title} className={styles.read}><span className={styles.readK}>{r.kind}</span><span className={styles.readT}>{r.title}</span></div>)}
          </div>
        </SectionHeading>
      </DemoGate>
    </>
  );
}
