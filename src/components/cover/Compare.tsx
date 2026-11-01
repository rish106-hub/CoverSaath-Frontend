"use client";

import { useEffect, useState } from "react";
import { Kicker, PageTitle, Recommended, SectionHeading } from "@/components/type";
import { InsurerTile } from "./InsurerTile";
import {
  BANDS, DEFAULT_WEIGHTS, PRIORITIES, SCENARIOS, WEIGHT_LABELS, bestIndex, cycleWeight, fitScores, lakh, plans, rows, verdictText, youPaysL,
  type Band, type Dot, type Kind,
} from "@/lib/fit";
import styles from "./Compare.module.css";
import { usePageShortcuts } from "@/lib/shortcuts";

const DOT: Record<Dot, string> = { good: "var(--harbour)", okay: "var(--ochre)", watch: "var(--signal)" };
const DOT_LABEL: Record<Dot, string> = { good: "Good for you", okay: "Okay", watch: "Watch out" };
const DIRECT = [{ logo: "KG", name: "Kaveri General" }, { logo: "MC", name: "Meridian Care" }, { logo: "IS", name: "Indus Shield Health" }];

export function Compare() {
  const [kind, setKind] = useState<Kind>("top");
  const [band, setBand] = useState<Band>(10);
  const [sel, setSel] = useState(-1);
  const [scen, setScen] = useState(0);
  const [weights, setWeights] = useState<Record<number, number>>(DEFAULT_WEIGHTS);

  usePageShortcuts(Object.fromEntries([0, 1, 2, 3].map((i) => [`plan-${i + 1}`, () => setSel(i)])));

  const list = plans(kind, band);
  const table = rows(band);
  const scores = fitScores(table, weights, list.length);
  const best = bestIndex(scores);
  const cur = sel >= 0 ? sel : best;
  const billL = SCENARIOS[scen].billL;
  const youL = list.map((p, i) => youPaysL(p, i, billL, kind));
  const insPct = (i: number) => Math.max(0, Math.min(100, Math.round(((billL - youL[i]) / billL) * 100)));

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <Kicker>Compare plans</Kicker>
          <PageTitle>Which plan fits your family, not the brochure.</PageTitle>
        </div>
        <div className={styles.segs}>
          <div className={styles.seg} role="group" aria-label="Kind of plan">
            {([["top", "Top-ups"], ["base", "New base plan"]] as const).map(([k, t]) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{t}</button>
            ))}
          </div>
          <div className={styles.seg} role="group" aria-label="Cover amount">
            {BANDS.map((b) => (
              <button key={b} type="button" aria-pressed={band === b} onClick={() => setBand(b)}>Rs {b}L</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.two}>
        <SectionHeading title="What matters to you" description="Knowvia picked these from your policies">
          <div className={styles.prios}>
            {PRIORITIES.map((p) => {
              const w = weights[p.id] || 0;
              return (
                <button key={p.id} type="button" className={`${styles.prio} ${w >= 2 ? styles.prioOn : ""}`} onClick={() => setWeights({ ...weights, [p.id]: cycleWeight(w) })} aria-label={`${p.title}, ${WEIGHT_LABELS[w]}. Press to change.`}>
                  <span className={styles.ic} aria-hidden>{p.icon}</span>
                  <span className={styles.grow}>
                    <span className={styles.name}>{p.title}</span>
                    <span className={styles.sub}>{p.why}</span>
                  </span>
                  <span className={styles.weight} style={{ color: w >= 3 ? "var(--harbour)" : "var(--graphite)" }}>{WEIGHT_LABELS[w]}</span>
                </button>
              );
            })}
          </div>
        </SectionHeading>

        <SectionHeading title="Fit for Meera’s family" description="Changes as you pick">
          <div className={styles.fit} role="group" aria-label="Fit scores">
            {list.map((p, i) => (
              <button key={p.name} type="button" className={styles.fitRow} aria-pressed={cur === i} onClick={() => setSel(i)}>
                <InsurerTile code={p.logo} size={40} />
                <span className={styles.fitMid}>
                  <span className={styles.name}>{p.name}</span>
                  <span className={styles.fitTrack} aria-hidden><span style={{ width: `${scores[i]}%`, background: i === best ? "var(--marker)" : "rgba(247,245,240,.55)" }} /></span>
                </span>
                <span className={styles.fitScore}>{scores[i]}%</span>
              </button>
            ))}
            <div className={styles.verdict} aria-live="polite">{verdictText(cur, list, scores, scen, kind)}</div>
          </div>
        </SectionHeading>
      </div>

      <div className={styles.plans} role="group" aria-label="Plans">
        {list.map((p, i) => {
          const card = (
            <>
              <span className={styles.planTop}>
                <InsurerTile code={p.logo} size={40} />
                <span className={`${styles.tag} ${i === 0 ? styles.tagToday : i === best ? styles.tagBest : ""}`}>{i === 0 ? "Today" : `${scores[i]}% fit`}</span>
              </span>
              <span>
                <span className={styles.planName}>{p.name}</span>
                <span className={styles.sub}>{p.plan}</span>
              </span>
              <span><span className={styles.price}>{p.price}</span> <span className={styles.sub}>{p.per}</span></span>
              <span className={styles.youBlock}>
                <span className={styles.youRow}><span>You’d pay on {SCENARIOS[scen].name.toLowerCase()}</span><span className={styles.mono} style={{ color: youL[i] > 1 ? "var(--signal-ink)" : "var(--harbour)" }}>{lakh(youL[i])}</span></span>
                <span className={styles.split} aria-hidden><span style={{ width: `${insPct(i)}%`, background: "var(--harbour)" }} /><span style={{ width: `${100 - insPct(i)}%`, background: "var(--signal)" }} /></span>
              </span>
            </>
          );
          return i === best ? (
            <div key={p.name} className={styles.recWrap}>
              <Recommended>
                <button type="button" className={`${styles.plan} ${styles.planRec}`} aria-pressed={cur === i} aria-keyshortcuts={String(i + 1)} onClick={() => setSel(i)}>{card}</button>
              </Recommended>
            </div>
          ) : (
            <button key={p.name} type="button" className={styles.plan} aria-pressed={cur === i} aria-keyshortcuts={String(i + 1)} onClick={() => setSel(i)}>{card}</button>
          );
        })}
      </div>

      <SectionHeading
        title="Section by section"
        actions={<span className={styles.legend}>{(Object.keys(DOT) as Dot[]).map((d) => <span key={d}><i style={{ background: DOT[d] }} aria-hidden />{DOT_LABEL[d]}</span>)}</span>}
      >
        <div className={styles.table} role="table" aria-label="Plans side by side">
          {table.map((r) => {
            const w = r.priority === 0 ? 1 : weights[r.priority] || 0;
            return (
              <div key={r.title} className={styles.trow} role="row">
                <div className={`${styles.rowHead} ${w >= 2 ? styles.rowHot : ""}`} role="rowheader">
                  <span className={styles.ic} aria-hidden>{r.icon}</span>
                  <span><span className={styles.name}>{r.title}</span><span className={styles.sub}>{r.hint}</span></span>
                </div>
                {r.cells.map((c, i) => (
                  <div key={i} className={`${styles.cell} ${cur === i ? styles.cellSel : ""}`} role="cell">
                    <i className={styles.dot} style={{ background: DOT[r.dots[i]] }} role="img" aria-label={DOT_LABEL[r.dots[i]]} />
                    {c}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </SectionHeading>

      <div className={styles.two}>
        <SectionHeading
          title="Same bill, four plans"
          actions={
            <div className={styles.chips} role="group" aria-label="Typical bill">
              {SCENARIOS.map((x, k) => <button key={x.name} type="button" aria-pressed={scen === k} onClick={() => setScen(k)}>{x.name}</button>)}
            </div>
          }
        >
          <div className={styles.card}>
            <p className={styles.sub}>Typical bill in Pune: <strong className={styles.strong}>{lakh(billL)}</strong></p>
            {list.map((p, i) => (
              <div key={p.name} className={styles.billRow}>
                <span className={styles.name} style={{ fontWeight: cur === i ? 600 : 400 }}>{p.name}</span>
                <span className={styles.billBar} aria-hidden><span style={{ width: `${insPct(i)}%`, background: "var(--harbour)" }} /><span style={{ width: `${100 - insPct(i)}%`, background: "var(--signal)" }} /></span>
                <span className={styles.mono} style={{ textAlign: "right", color: youL[i] > 1 ? "var(--signal-ink)" : "var(--harbour)" }}>{lakh(youL[i])}</span>
              </div>
            ))}
            <div className={styles.keyline}><span><i style={{ background: "var(--harbour)" }} aria-hidden />Plans pay</span><span><i style={{ background: "var(--signal)" }} aria-hidden />You pay</span></div>
          </div>
        </SectionHeading>

        <div className={styles.rightCol}>
          <SectionHeading title="Registered advisor">
            <div className={`${styles.card} ${styles.advisor}`}>
              <span className={styles.adv} aria-hidden>AK</span>
              <span className={styles.grow}>
                <span className={styles.name}>Talk this comparison through, first 15 minutes free</span>
                <span className={styles.sub}>Knowvia sends them this table, with your OK.</span>
              </span>
              <a className={styles.cta} href="/tools">Book</a>
            </div>
          </SectionHeading>
          <SectionHeading title="Buy direct from the insurer">
            <div className={styles.direct}>
              {DIRECT.map((d) => (
                <a key={d.logo} href="#direct" className={styles.dcard}>
                  <InsurerTile code={d.logo} size={32} />
                  <span className={styles.name}>{d.name}</span>
                  <span className={styles.link}>Insurer site ↗</span>
                </a>
              ))}
            </div>
          </SectionHeading>
        </div>
      </div>
    </>
  );
}
