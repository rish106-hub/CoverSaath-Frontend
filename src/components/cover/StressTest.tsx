"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { InsurerTile } from "./InsurerTile";
import {
  PEOPLE, SCENARIOS, SCENARIO_KEYS, NO_LEVERS, calc, familyRow, inr, leverSaving, policyFor, prosCons, rs, sectionBars, shortBill, verdict, waterfall, youNote,
  type Levers, type Person, type Quality, type Scenario,
} from "@/lib/stress";
import { SaveState } from "@/components/ui/SaveState";
import { useScenario } from "@/lib/use-scenario";
import { stressCodec, type StressState } from "@/lib/scenario-codecs";
import styles from "./StressTest.module.css";
import { usePageShortcuts } from "@/lib/shortcuts";

const LEVER_DEFS: { key: keyof Levers; icon: string; title: string; desc: (parent: boolean) => string }[] = [
  { key: "top", icon: "↗", title: "Add a Rs 10L top-up", desc: () => "Pays after the base plan" },
  { key: "net", icon: "✚", title: "Choose a cashless hospital", desc: () => "Fewer bills at the desk" },
  { key: "room", icon: "▣", title: "Choose a room within the limit", desc: (p) => (p ? "Up to Rs 3,000 a day" : "Up to Rs 5,000 a day") },
];

const BAR_TONE: Record<Quality, string> = { Strong: "var(--harbour)", Okay: "var(--ochre)", Weak: "var(--signal)", None: "var(--signal)" };
const RATING_INK: Record<Quality, string> = { Strong: "var(--harbour)", Okay: "var(--graphite)", Weak: "var(--signal-ink)", None: "var(--signal-ink)" };
const STEP_TONE = { bill: "var(--ink)", cut: "var(--signal)", pay: "var(--harbour)", top: "var(--sea-glass)" } as const;

export function StressTest() {
  const [who, setWho] = useState<Person>("Father");
  const [sc, setSc] = useState<Scenario>("knee");
  const [levers, setLevers] = useState<Levers>(NO_LEVERS);

  usePageShortcuts(Object.fromEntries(PEOPLE.map((p, i) => [`person-${i + 1}`, () => setWho(p.name)])));

  const value = useMemo<StressState>(() => ({ who, sc, levers }), [who, sc, levers]);
  const { status, retry, flush } = useScenario<StressState>({
    tool: "stress_levers", value, codec: stressCodec,
    apply: (p) => { if (p.who) setWho(p.who); if (p.sc) setSc(p.sc); if (p.levers) setLevers(p.levers); },
  });

  const r = useMemo(() => calc(who, sc, levers), [who, sc, levers]);
  const pc = (n: number) => Math.max(0, Math.round((n / r.bill) * 100));
  const v = verdict(r.you);
  const pol = policyFor(r.parent);
  const steps = useMemo(() => waterfall(who, r, levers), [who, r, levers]);
  const { pros, cons } = useMemo(() => prosCons(r.parent), [r.parent]);
  const insPct = pc(r.ins);
  const topPct = pc(r.topPays);

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <Kicker>Stress test</Kicker>
          <PageTitle>Who pays if {who} needs this?</PageTitle>
        </div>
        <div className={styles.persons} role="group" aria-label="Who is it for">
          {PEOPLE.map((p, i) => (
            <button key={p.name} type="button" className={styles.person} aria-pressed={who === p.name} aria-keyshortcuts={String(i + 1)} onClick={() => setWho(p.name)}>
              <span className={styles.avatar}>{p.ini}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scenarios} role="group" aria-label="Treatment">
        {SCENARIO_KEYS.map((k) => (
          <button key={k} type="button" className={styles.scenario} aria-pressed={sc === k} onClick={() => setSc(k)}>
            <span className={styles.ic} aria-hidden>{SCENARIOS[k].icon}</span>
            <span className={styles.scTitle}>{SCENARIOS[k].title}</span>
            <span className={styles.scBill}>Bill {shortBill(calc(who, k, levers).bill)}</span>
          </button>
        ))}
      </div>

      <div className={styles.two}>
        <SectionHeading title="Bill step by step" actions={<span className={styles.policy}><InsurerTile code={pol.logo} size={30} />{pol.name}</span>}>
          <div className={`${styles.card} ${styles.steps}`}>
            {steps.map((s) => (
              <div key={s.title} className={styles.step}>
                <span className={`${styles.ic} ${s.tone === "cut" ? styles.icCut : s.tone === "bill" ? "" : styles.icPay}`} aria-hidden>{s.icon}</span>
                <span>
                  <span className={styles.stepTitle}>{s.title}</span>
                  {s.ref ? <span className={styles.stepRef}>{s.ref}</span> : null}
                </span>
                <span className={styles.track} aria-hidden>
                  <span className={styles.fill} style={{ left: `${s.x}%`, width: `${s.w}%`, background: STEP_TONE[s.tone] }} />
                </span>
                <span className={styles.stepVal} style={{ color: s.zero ? "var(--graphite)" : s.tone === "cut" ? "var(--signal-ink)" : "var(--ink)", fontWeight: s.tone === "bill" || s.tone === "pay" ? 600 : 400 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </SectionHeading>

        <div className={styles.right}>
          <div className={styles.pays} role="status" aria-live="polite">
            <div className={styles.paysTop}>
              <span>{who} pays</span>
              <span className={`${styles.verdict} ${styles[v.tone]}`}>{v.label}</span>
            </div>
            <div className={styles.big}>Rs {inr(r.you)}</div>
            <div className={styles.split} aria-hidden>
              <span style={{ width: `${insPct}%`, background: "var(--sea-glass)" }} />
              <span style={{ width: `${topPct}%`, background: "var(--mist)" }} />
              <span style={{ width: `${Math.max(0, 100 - insPct - topPct)}%`, background: "var(--signal)" }} />
            </div>
            <div className={styles.note}>{youNote(r)}</div>
          </div>
          <SectionHeading title="What could change it" actions={<><SaveState status={status} onRetry={retry} /><Link href="/compare" className="k-btn k-btn--secondary k-btn--sm">Compare top-ups</Link></>}>
            <div className={`${styles.card} ${styles.levers}`} onBlur={flush}>
              {LEVER_DEFS.map((l) => {
                const on = levers[l.key];
                const sv = leverSaving(who, sc, levers, l.key);
                return (
                  <div key={l.key} className={`${styles.lever} ${on ? styles.leverOn : ""}`}>
                    <span className={styles.ic} aria-hidden>{l.icon}</span>
                    <span className={styles.leverText}>
                      <span className={styles.stepTitle}>{l.title}</span>
                      <span className={styles.stepRef}>{l.desc(r.parent)}</span>
                    </span>
                    <span className={styles.save}>{on ? "On" : sv ? `Saves Rs ${inr(sv)}` : "No change"}</span>
                    <button type="button" role="switch" aria-checked={on} aria-label={l.title} className={styles.sw} onClick={() => setLevers({ ...levers, [l.key]: !on })}>
                      <span />
                    </button>
                  </div>
                );
              })}
            </div>
          </SectionHeading>
        </div>
      </div>

      <SectionHeading title="Same treatment, whole family">
        <div className={styles.family}>
          {PEOPLE.map((p) => {
            const f = familyRow(p.name, sc, levers);
            return (
              <button key={p.name} type="button" className={styles.fcard} aria-pressed={who === p.name} onClick={() => setWho(p.name)}>
                <span className={styles.fname}><span className={styles.avatar}>{p.ini}</span>{p.name}</span>
                <span className={styles.fval} style={{ color: f.you > 100000 ? "var(--signal-ink)" : "var(--ink)" }}>Rs {inr(f.you)}</span>
                <span className={styles.mini} aria-hidden>
                  <span style={{ width: `${f.insPct}%`, background: "var(--harbour)" }} />
                  <span style={{ width: `${f.youPct}%`, background: "var(--signal)" }} />
                </span>
                <span className={styles.stepRef}>{f.why}</span>
              </button>
            );
          })}
        </div>
      </SectionHeading>

      <div className={styles.two}>
        <SectionHeading title="Section by section" actions={<span className={styles.score} style={{ color: pol.good ? "var(--harbour)" : "var(--signal-ink)" }}>{pol.score}<small>/10</small></span>}>
          <div className={`${styles.card} ${styles.bars}`}>
            {sectionBars(r.parent).map((b) => (
              <div key={b.title} className={styles.bar}>
                <span className={styles.barName}>{b.title}</span>
                <span className={styles.barTrack} role="img" aria-label={`${b.title}: ${b.rating}`}><span style={{ width: `${b.pct}%`, background: BAR_TONE[b.rating] }} /></span>
                <span className={styles.rating} style={{ color: RATING_INK[b.rating] }}>{b.rating}</span>
              </div>
            ))}
          </div>
        </SectionHeading>
        <div className={styles.right}>
          <SectionHeading title="Strengths">
            <ul className={`${styles.list} ${styles.good}`}>{pros.map((p) => <li key={p}><span className={`${styles.mark} ${styles.markGood}`} aria-hidden>＋</span>{p}</li>)}</ul>
          </SectionHeading>
          <SectionHeading title="Things to watch">
            <ul className={`${styles.list} ${styles.watch}`}>{cons.map((p) => <li key={p}><span className={`${styles.mark} ${styles.markWatch}`} aria-hidden>−</span>{p}</li>)}</ul>
          </SectionHeading>
        </div>
      </div>
    </>
  );
}
