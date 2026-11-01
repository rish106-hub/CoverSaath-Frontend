"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { SectionHeading, SubHeading } from "@/components/type";
import * as d from "@/data/mock/home";
import { CountUp } from "./CountUp";
import { PeopleChips } from "./PeopleChips";
import { AskKnowviaStripSlot, RemindRowSlot } from "./slots";
import s from "./HomeView.module.css";

function Glance() {
  return (
    <section className={s.glance} aria-label="Your cover at a glance">
      <div className={s.health}>
        <div className={s.ring} style={{ background: `conic-gradient(var(--marker) 0 ${d.healthScore}%, rgba(247,245,240,.14) ${d.healthScore}% 100%)` }}>
          <div className={s.ringIn}>
            <span className={s.ringNum}>{d.healthScore}</span>
            <span className={s.ringSub}>of 100</span>
          </div>
        </div>
        <div className={s.healthText}>
          <b>Cover health: good</b>
          <span>Fix 3 gaps to reach 90</span>
        </div>
        <div className={s.gaps}>
          {d.healthGaps.map((g) => (
            <Link key={g.t} href={g.href} className={s.gap}><span>{g.t}</span><b>+{g.p}</b></Link>
          ))}
        </div>
      </div>
      <div className={s.tiles}>
        {d.glanceTiles.map((k) => (
          <Link key={k.label} href={k.href} className={`${s.tile} ${k.tone === "light" ? s.tileLight : k.tone === "marker" ? s.tileMarker : ""}`}>
            <span className={s.tileHead}><span className={s.dot} aria-hidden>{k.icon}</span><b>{k.label}</b></span>
            <span className={s.tileValue}>{k.stat ? <CountUp stat={k.stat} /> : k.text}</span>
            <span className={s.tileDetail}>{k.detail}</span>
            <span className={s.track} style={{ visibility: k.progress ? "visible" : "hidden" }}><span style={{ width: `${k.progress}%` }} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Attention() {
  return (
    <SectionHeading title="Needs your attention" actions={<span className={s.count}>3</span>}>
      <div className={s.list}>
        {d.alerts.map((a) => (
          <div key={a.t} className={s.alert}>
            <span className={s.bar} style={{ background: a.c }} aria-hidden />
            <div className={s.alertBody}>
              <b>{a.t}</b>
              <span>{a.d}</span>
              <Link href={a.href} className={`k-btn k-btn--secondary k-btn--sm ${s.alertBtn}`}>{a.cta}</Link>
            </div>
          </div>
        ))}
      </div>
    </SectionHeading>
  );
}

function Year() {
  const router = useRouter();
  const [sel, setSel] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const marked = new Set(d.yearTiles.map((t) => t.m));
  const move = (to: number) => {
    const n = (to + d.yearTiles.length) % d.yearTiles.length;
    setSel(n);
    refs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowRight") { e.preventDefault(); move(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); move(i - 1); }
    else if (e.key === "Enter") { e.preventDefault(); router.push(d.yearTiles[i].href); }
  };
  return (
    <SectionHeading title="Your year">
      <RemindRowSlot count={d.yearTiles.length} />
      <div className={s.months} aria-hidden>
        {d.monthStrip.map((m, k) => (
          <div key={m} className={s.month}>
            <span style={{ color: marked.has(m) ? "var(--ink)" : "var(--graphite)" }}>{m}</span>
            <i style={{ background: k === 0 ? "var(--ink)" : marked.has(m) ? "var(--ochre)" : "var(--sunken)" }} />
          </div>
        ))}
      </div>
      <div className={s.dates} role="listbox" aria-label="Dates this year">
        {d.yearTiles.map((t, i) => (
          <button
            key={t.t}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="option"
            aria-selected={sel === i}
            tabIndex={sel === i ? 0 : -1}
            className={`${s.date} ${sel === i ? s.dateOn : ""}`}
            onClick={() => setSel(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className={s.dateTop}>
              <span className={s.cal}><span style={{ background: t.band }}>{t.m}</span><b>{t.d}</b></span>
              <span className={s.in}>in {t.in}</span>
            </span>
            <b className={s.dateTitle}>{t.t}</b>
            <span className={s.muted}>{t.s}</span>
            {sel === i ? <span className={`k-btn k-btn--primary k-btn--sm ${s.open}`}>{t.cta}</span> : null}
          </button>
        ))}
      </div>
    </SectionHeading>
  );
}

function Policies() {
  return (
    <SectionHeading title="Your policies" actions={<Link href="/policies" className="k-btn k-btn--secondary k-btn--sm">All policies</Link>}>
      <div className={s.grid3}>
        {d.policyCards.map((q) => (
          <Link key={q.type} href="/policies" className={s.card} style={{ borderTop: `4px solid ${q.c}` }}>
            <span className={s.row}>
              <span className={s.rowL}>
                <span className={s.badge} style={{ background: q.c, color: q.ink }} aria-hidden>{q.icon}</span>
                <span><SubHeading>{q.type}</SubHeading><span className={s.muted}>{q.ins}</span></span>
              </span>
              <span className={s.mark} aria-hidden>{q.mark}</span>
            </span>
            <span className={s.two}>
              <span><span className={s.muted}>Cover</span><span className={s.serif}>{q.cover}</span></span>
              <span><span className={s.muted}>Monthly premium</span><span className={s.serif}>{q.pm}</span></span>
            </span>
            <span className={s.used}>
              <span className={s.rowBetween}><span>Used this year</span><span>{q.used}</span></span>
              <span className={s.meter}><span style={{ width: `${q.up}%`, background: q.c }} /></span>
            </span>
            <span className={`${s.rowBetween} ${s.foot}`}><PeopleChips people={q.who.map((name) => ({ name }))} /><b>Renews {q.ren}</b></span>
          </Link>
        ))}
      </div>
    </SectionHeading>
  );
}

function PerPerson() {
  const [view, setView] = useState<"amt" | "pct">("amt");
  const pct = view === "pct";
  return (
    <SectionHeading
      title="Cover per person"
      actions={
        <div className={s.toggle} role="group" aria-label="Show cover as">
          {(["amt", "pct"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} className={view === v ? s.chipOn : s.chip} onClick={() => setView(v)}>
              {v === "amt" ? "Amount" : "Share of a Rs 10L bill"}
            </button>
          ))}
        </div>
      }
    >
      <div className={s.cardBox}>
        {d.personBars.map((b) => (
          <div key={b.name} className={s.person}>
            <div><b>{b.name}</b><div className={s.muted}>{b.rel}</div></div>
            <div className={s.stack}>
              <span style={{ width: `${pct ? b.groupPct : b.group}%`, background: "var(--harbour)" }} />
              <span style={{ width: `${pct ? b.topupPct : b.topup}%`, background: "var(--sea-glass)" }} />
              <span style={{ width: `${pct ? b.seniorPct : b.senior}%`, background: "var(--ochre)" }} />
            </div>
            <span className={s.mono}>{pct ? b.share : b.amount}</span>
          </div>
        ))}
        <div className={s.legend}>
          <span><i style={{ background: "var(--harbour)" }} />Group, Northstar</span>
          <span><i style={{ background: "var(--sea-glass)" }} />Top-up, Kaveri</span>
          <span><i style={{ background: "var(--ochre)" }} />Senior plan, Meridian</span>
        </div>
      </div>
    </SectionHeading>
  );
}

function Claims() {
  return (
    <SectionHeading title="Claims" actions={<Link href="/desk" className="k-btn k-btn--secondary k-btn--sm">Open claims</Link>}>
      <div className={s.list}>
        {d.claims.map((c) => (
          <div key={c.t} className={s.claim}>
            <span className={`${s.badge} ${s["tone_" + c.tone]}`} aria-hidden>{c.icon}</span>
            <span><b>{c.t}</b><span className={s.muted} style={{ display: "block" }}>{c.d}</span></span>
            <span className={`${s.status} ${s["tone_" + c.tone]}`}>{c.s}</span>
          </div>
        ))}
      </div>
      <div className={s.grid3}>
        {d.claimsLeft.map((x) => (
          <div key={x.k} className={s.dashed}><span className={s.muted}>{x.k}</span><b>{x.v}</b></div>
        ))}
      </div>
    </SectionHeading>
  );
}

function MoneyAndHandling() {
  return (
    <div className={s.grid2}>
      <SectionHeading title="Money desk" actions={<span className={s.ok}>Gmail connected</span>}>
        <Link href="/money" className={s.card}>
          <span className={s.big}>{d.moneyDesk.headline}</span>
          <span className={s.seg}><i style={{ width: "66%", background: "var(--harbour)" }} /><i style={{ width: "17%", background: "var(--ochre)" }} /><i style={{ width: "17%", background: "var(--signal)" }} /></span>
          <span className={s.stats}><span>{d.moneyDesk.matched} matched</span><span>{d.moneyDesk.missing} missing</span><span>{d.moneyDesk.duplicate} duplicate</span></span>
        </Link>
      </SectionHeading>
      <SectionHeading title="In progress" actions={<span className={s.muted}>2 open</span>}>
        <Link href="/desk" className={s.card}>
          <span className={s.big}>{d.handling.headline}</span>
          <span className={s.steps}>{[0, 1, 2, 3].map((k) => <i key={k} style={{ background: k < d.handling.done ? "var(--harbour)" : "var(--line)" }} />)}</span>
          <span className={s.muted}>{d.handling.steps}</span>
        </Link>
      </SectionHeading>
    </div>
  );
}

function StressAndAdvisor() {
  return (
    <div className={s.grid2}>
      <SectionHeading title="Stress test">
        <div className={`${s.card} ${s.dark}`}>
          <span className={s.big}>{d.stressTeaser.headline}</span>
          <span className={s.onDarkSub}>{d.stressTeaser.note}</span>
          <Link href="/stress-test" className={`k-btn ${s.lightBtn}`}>See the breakdown</Link>
        </div>
      </SectionHeading>
      <SectionHeading title="Talk to an advisor">
        <div className={`${s.card} ${s.advisor}`}>
          <span className={s.mark} aria-hidden>{d.advisor.mark}</span>
          <b className={s.advLine}>{d.advisor.line}</b>
          <Link href="/tools" className="k-btn k-btn--primary">Book a call</Link>
        </div>
      </SectionHeading>
    </div>
  );
}

function Tools() {
  return (
    <SectionHeading title="Tools">
      <div className={s.grid4}>
        {d.calcs.map((c) => (
          <Link key={c.t} href="/tools" className={s.card}>
            <span className={s.rowBetween}><span className={s.badge} aria-hidden>{c.icon}</span><span className={s.muted}>{c.when}</span></span>
            <span className={s.serifSm}>{c.t}</span>
            <span className={`${s.rowBetween} ${s.foot}`}><span>{c.k}</span><b className={s.mono}>{c.v}</b></span>
          </Link>
        ))}
      </div>
    </SectionHeading>
  );
}

function Learn() {
  const [tab, setTab] = useState<string>("all");
  const items = tab === "all" ? d.feed : d.feed.filter((x) => x.tag === tab);
  return (
    <SectionHeading
      title="Learn"
      actions={
        <div className={s.toggle} role="group" aria-label="Filter">
          {d.feedTabs.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={tab === k} className={tab === k ? s.chipOn : s.chip} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
      }
    >
      <div className={s.grid3}>
        {items.map((x) => (
          <Link key={x.t} href="/home" className={s.post}>
            <span className={s.postArt}><span aria-hidden>{x.glyph}</span><em>{x.kind}</em><b className={s.mono}>{x.len}</b></span>
            <span className={s.postBody}><b>{x.t}</b><span className={s.why}>{x.why}</span></span>
          </Link>
        ))}
      </div>
    </SectionHeading>
  );
}

/** Body of /home below the greeting (board Home). */
export function HomeView() {
  return (
    <div className={s.page}>
      <AskKnowviaStripSlot />
      <SectionHeading title="Your cover at a glance" actions={<span className={s.muted}>Updated 2 hours ago</span>}>
        <Glance />
      </SectionHeading>
      <Attention />
      <Year />
      <Policies />
      <PerPerson />
      <Claims />
      <MoneyAndHandling />
      <StressAndAdvisor />
      <Tools />
      <Learn />
    </div>
  );
}
