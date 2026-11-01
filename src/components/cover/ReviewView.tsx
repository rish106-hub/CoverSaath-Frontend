"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Kicker, PageTitle, Recommended, SectionHeading } from "@/components/type";
import { decisions, lookItems, reviewTotal } from "@/data/mock/review";
import { accept, acceptAll, emptyReview, flag, nextLook, pick, summarize, tick, type ReviewState } from "./review-logic";
import s from "./ReviewView.module.css";
import { usePageShortcuts } from "@/lib/shortcuts";

/** Things to check (board Audit). Only items that need the owner are listed; auto-resolved ones never appear. */
export function ReviewView() {
  const [st, setSt] = useState<ReviewState>(emptyReview);
  const [open, setOpen] = useState(-1);
  const [went, setWent] = useState(false);
  const stRef = useRef(st);
  useEffect(() => {
    stRef.current = st;
  }, [st]);

  // A accepts / C flags the next look item.
  const act = (accept: boolean) => () => {
    const n = nextLook(stRef.current, lookItems.length);
    if (n >= 0) setSt((p) => (accept ? tick(p, n) : flag(p, n)));
  };
  usePageShortcuts({ accept: act(true), change: act(false) });

  const sum = summarize(st, reviewTotal, decisions.length, lookItems.length);

  return (
    <>
      <div className={s.top}>
        <div className={s.titleBlock}>
          <Kicker>Review, 1 Nov 2026</Kicker>
          <PageTitle>{sum.headline}</PageTitle>
        </div>
        <div className={s.panel}>
          <div className={s.ring} style={{ background: `conic-gradient(#f4dc8a 0 ${sum.pct}%, rgba(247,245,240,.16) ${sum.pct}% 100%)` }}>
            <div className={s.ringIn}>
              <span>{sum.done}</span>
              <small>of {reviewTotal}</small>
            </div>
          </div>
          <div className={s.panelText}>
            <b>Knowvia handled {sum.done} of {reviewTotal} requests.</b>
          </div>
        </div>
      </div>

      <div className={s.cols}>
        <SectionHeading
          title="Decisions"
          actions={sum.open ? <button type="button" className="k-btn k-btn--primary k-btn--sm" onClick={() => setSt((p) => acceptAll(p, decisions.length))}>Accept all {sum.open}</button> : null}
        >
          <div className={s.stack}>
            {decisions.map((d, i) => {
              const has = st.dec[i] !== undefined;
              const chosen = has ? st.dec[i] : 0;
              const card = (
                <>
                  <div className={s.head}>
                    <span className={`${s.mark} ${has ? s.markDone : ""}`} aria-hidden>{has ? "✓" : i + 1}</span>
                    <span className={s.q}>
                      <b>{d.q}</b>
                      <span className={s.cur}>{has ? "Chosen: " : "Recommended: "}{d.options[chosen]}</span>
                    </span>
                    {has ? (
                      <button type="button" className="k-btn k-btn--secondary k-btn--sm" onClick={() => setOpen(open === i ? -1 : i)}>Change</button>
                    ) : (
                      <>
                        <button type="button" className="k-btn k-btn--primary k-btn--sm" onClick={() => { setSt((p) => accept(p, i)); setOpen(-1); }}>Accept</button>
                        <button type="button" className="k-btn k-btn--secondary k-btn--sm" onClick={() => setOpen(open === i ? -1 : i)}>Edit</button>
                      </>
                    )}
                  </div>
                  {open === i ? (
                    <div className={s.opts}>
                      {d.options.map((o, j) => (
                        <button key={o} type="button" aria-pressed={has && chosen === j} className={has && chosen === j ? s.optOn : s.opt} onClick={() => { setSt((p) => pick(p, i, j)); setOpen(-1); }}>
                          <span>{o}</span>
                          {j === 0 ? <span className={s.recTag}>Recommended</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              );
              return has ? (
                <div key={d.q} className={s.item}>{card}</div>
              ) : (
                <Recommended key={d.q} label="Recommended">{card}</Recommended>
              );
            })}
          </div>
        </SectionHeading>

        <div className={s.right}>
          <SectionHeading title="To check">
            <div className={s.stack}>
              {lookItems.map((l, i) => {
                const ok = !!st.ok[i];
                const ch = !!st.ch[i];
                const isNext = i === sum.next;
                return (
                  <div key={l.t} className={`${s.look} ${isNext ? s.lookNext : ""} ${ok ? s.lookOk : ""} ${ch ? s.lookCh : ""}`}>
                    <span className={`${s.mark} ${ok ? s.markDone : ch ? s.markCh : isNext ? s.markNext : ""}`} aria-hidden>{ok ? "✓" : ch ? "!" : i + 1}</span>
                    <span className={s.q}>
                      <b>{l.t}</b>
                      <span className={s.where}>{l.where}</span>
                    </span>
                    <span className={s.acts}>
                      <Link href={l.href} className="k-btn k-btn--secondary k-btn--sm">Open</Link>
                      <button type="button" className={`k-btn k-btn--secondary k-btn--sm ${s.tickBtn}`} aria-pressed={ok} aria-label={`Mark ${l.t} as checked`} onClick={() => setSt((p) => tick(p, i))}>{ok ? "Checked" : "Mark checked"}</button>
                      <button type="button" className={`k-btn k-btn--secondary k-btn--sm ${s.danger}`} onClick={() => setSt((p) => flag(p, i))}>Needs change</button>
                    </span>
                  </div>
                );
              })}
              <div className={s.go}>
                <span className={s.orb} aria-hidden />
                <span className={s.goText}>Everything checked? Continue.</span>
                <button type="button" className="k-btn k-btn--primary" onClick={() => setWent(true)}>{went ? "Confirmed" : "Continue"}</button>
              </div>
            </div>
          </SectionHeading>
        </div>
      </div>
    </>
  );
}
