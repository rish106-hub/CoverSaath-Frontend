"use client";

import { useState } from "react";
import Link from "next/link";
import { planInflation, formatLakh, formatRs, RATES_PCT, DEFAULT_RATE_PCT, YEAR_CHOICES, START_YEAR } from "@/lib/inflation";
import { planWho, planCases } from "@/data/mock";
import { Recommended } from "@/components/type";
import styles from "./money.module.css";

const W = 680;
const PLOT_TOP = 12;
const BASE_Y = 196;
const PLOT_H = BASE_Y - PLOT_TOP;

function Chips<T extends string | number>({ legend, options, value, onPick, grid }: { legend: string; options: { key: T; label: string }[]; value: T; onPick: (k: T) => void; grid?: boolean }) {
  return (
    <fieldset className={styles.field}>
      <legend>{legend}</legend>
      <div className={grid ? styles.chipsGrid : styles.chips}>
        {options.map((o) => (
          <button key={String(o.key)} type="button" aria-pressed={o.key === value} className={`${styles.chip} ${o.key === value ? styles.chipOn : ""}`} onClick={() => onPick(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function InflationPlanner() {
  const [who, setWho] = useState(1);
  const [kase, setKase] = useState(0);
  const [rate, setRate] = useState<number>(DEFAULT_RATE_PCT);
  const [years, setYears] = useState<number>(10);

  const w = planWho[who]!;
  const c = planCases[kase]!;
  const plan = planInflation({ coverLakh: w.coverLakh, costTodayLakh: c.lakh, ratePct: rate, years, premiumRs: w.premiumRs, premiumGrowth: w.growth + (who === 1 ? 0.02 : 0) });
  const endYear = START_YEAR + years;
  const max = Math.max(plan.costAtEndLakh, w.coverLakh) * 1.05;
  const px = (l: number) => Math.round((l / max) * (PLOT_H - 10));
  const coverY = BASE_Y - px(w.coverLakh);
  const n = plan.points.length;
  const slot = W / n;
  const barW = Math.min(26, (slot - 8) / 2);

  const head = !plan.outOfDate
    ? `A ${c.label.toLowerCase()} stays inside ${w.label}’s ${formatLakh(w.coverLakh)} cover for the next ${years} years.`
    : `A ${c.label.toLowerCase()} that costs ${formatLakh(c.lakh)} today will cost about ${formatLakh(plan.costAtEndLakh)} in ${endYear}. ${plan.crossOffset === 0 ? "It is already above" : `From ${plan.crossYear} it is above`} the ${formatLakh(w.coverLakh)} cover.`;
  const rec = plan.outOfDate
    ? `Raise ${w.label}’s cover to about ${formatLakh(plan.needLakh)}${(plan.crossOffset ?? 0) <= 0 ? " now" : ` before ${plan.crossYear}`}.`
    : "Cover keeps pace for this case.";

  const kpis = [
    { k: "Cost today", v: formatLakh(c.lakh), d: c.label, cls: "" },
    { k: `Cost in ${endYear}`, v: formatLakh(plan.costAtEndLakh), d: `at ${rate}% a year`, cls: plan.costAtEndLakh > w.coverLakh ? styles.kpiBad : styles.kpiOk },
    { k: `Premium in ${endYear}`, v: formatRs(plan.premiumAtEndRs), d: `today ${formatRs(w.premiumRs)} a year`, cls: styles.kpiWarm },
    { k: "Premiums paid by then", v: formatLakh(plan.premiumsPaidRs / 100000), d: `over ${years} years`, cls: styles.kpiDark },
  ];

  return (
    <div className={`${styles.card} ${styles.plan}`}>
      <div className={styles.planIn}>
        <div className={styles.planTitle}>Will your cover keep up?</div>
        <Chips legend="Whose cover" value={who} onPick={setWho} options={planWho.map((x, k) => ({ key: k, label: x.label }))} />
        <Chips legend="Treatment to plan for" value={kase} onPick={setKase} options={planCases.map((x, k) => ({ key: k, label: x.label }))} />
        <Chips grid legend="Medical inflation a year" value={rate} onPick={setRate} options={RATES_PCT.map((r) => ({ key: r as number, label: `${r}%` }))} />
        <Chips grid legend="Look ahead" value={years} onPick={setYears} options={YEAR_CHOICES.map((y) => ({ key: y as number, label: `${y} yrs` }))} />
      </div>
      <div className={styles.planOut}>
        <div className={styles.head2} aria-live="polite">{head}</div>
        <div className={styles.kpis}>
          {kpis.map((k) => (
            <div key={k.k} className={`${styles.kpi} ${k.cls}`}>
              <span className={styles.kpiK}>{k.k}</span>
              <span className={styles.kpiV}>{k.v}</span>
              <span className={styles.kpiD}>{k.d}</span>
            </div>
          ))}
        </div>
        <div className={styles.chartWrap}>
          <svg className={styles.chart} viewBox={`0 0 ${W} 222`} role="img" aria-label={`Treatment cost by year against a ${formatLakh(w.coverLakh)} cover`}>
            <line x1="0" x2={W} y1={BASE_Y} y2={BASE_Y} style={{ stroke: "var(--line)" }} strokeWidth="1" />
            {plan.points.map((p, i) => {
              const x = i * slot + slot / 2;
              const h = px(p.costLakh);
              const ph = Math.max(3, px((p.premiumRs * 10) / 100000));
              return (
                <g key={p.offset}>
                  <rect x={x - barW - 1} y={BASE_Y - h} width={barW} height={h} rx="4" style={{ fill: p.aboveCover ? "var(--signal)" : "var(--harbour)", transition: "all 400ms cubic-bezier(.2,.7,.2,1)" }} />
                  <rect x={x + 1} y={BASE_Y - ph} width={barW} height={ph} rx="4" style={{ fill: "var(--ochre)", transition: "all 400ms cubic-bezier(.2,.7,.2,1)" }} />
                  <text x={x} y={BASE_Y + 20} textAnchor="middle" style={{ fill: "var(--graphite)", font: "500 13px var(--font-mono)" }}>{String(p.year).slice(2)}</text>
                </g>
              );
            })}
            <line x1="0" x2={W} y1={coverY} y2={coverY} strokeDasharray="6 5" strokeWidth="2" style={{ stroke: "var(--harbour)" }} />
            <text x={W - 4} y={coverY - 6} textAnchor="end" style={{ fill: "var(--harbour)", font: "600 13px var(--font-sans)", stroke: "var(--sheet)", strokeWidth: 4, paintOrder: "stroke" }}>
              Your cover {formatLakh(w.coverLakh)}
            </text>
          </svg>
        </div>
        <div className={styles.legendRow}>
          <span><span className={styles.sw} style={{ background: "var(--harbour)" }} />Treatment cost, within cover</span>
          <span><span className={styles.sw} style={{ background: "var(--signal)" }} />Above your cover</span>
          <span><span className={styles.sw} style={{ background: "var(--ochre)" }} />Premium that year (10x scale)</span>
        </div>
        <Recommended>
          <span style={{ font: "400 15px var(--font-sans)" }}>{rec}</span>
          <Link href="/tools#top-up-finder" className="k-btn k-btn--primary k-btn--sm">Top-up finder</Link>
        </Recommended>
      </div>
    </div>
  );
}
