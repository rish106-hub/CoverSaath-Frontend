"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Kicker, PageTitle, Recommended, SectionHeading } from "@/components/type";
import { decisions, lookItems, reviewTotal } from "@/data/mock/review";
import { accept, acceptAll, emptyReview, flag, nextLook, pick, summarize, tick, type ReviewState } from "./review-logic";
import s from "./ReviewView.module.css";

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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "a" && k !== "c") return;
      const n = nextLook(stRef.current, lookItems.length);
      if (n < 0) return;
      setSt((p) => (k === "a" ? tick(p, n) : flag(p, n)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sum = summarize(st, reviewTotal, decisions.length, lookItems.length);

  return (
    <>
      <div className={s.top}>
        <div className={s.titleBlock}>
          <Kicker>Your review · 1 Nov 2026</Kicker>
          <PageTitle>{sum.headline}</PageTitle>
          <p className={s.lede}>Nothing gets built until you say go.</p>
        </div>
        <div className={s.panel}>
          <div className={s.ring} style={{ background: `conic-gradient(#f4dc8a 0 ${sum.pct}%, rgba(247,245,240,.16) ${sum.pct}% 100%)` }}>
            <div className={s.ringIn}>
              <span>{sum.done}</span>
              <small>of {reviewTotal}</small>
            </div>
          </div>
          <div className={s.panelText}>
            <b>Knowvia handled {sum.done} of your {reviewTotal} requests on its own.</b>
            <span>Gaps it found along the way were fixed too. Nothing there needs you.</span>
          </div>
        </div>
      </div>

      <div className={s.cols}>
        <SectionHeading
          title="Recommended, check and edit"
          actions={sum.open ? <button type="button" className={s.btn} onClick={() => setSt((p) => acceptAll(p, decisions.length))}>Accept all {sum.open}</button> : null}
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
                      <span className={s.cur}>{has ? "✓ " : "Knowvia recommends: "}{d.options[chosen]}</span>
                    </span>
                    {has ? (
                      <button type="button" className={s.btn} onClick={() => setOpen(open === i ? -1 : i)}>Change</button>
                    ) : (
                      <>
                        <button type="button" className={s.cta} onClick={() => { setSt((p) => accept(p, i)); setOpen(-1); }}>Accept</button>
                        <button type="button" className={s.btn} onClick={() => setOpen(open === i ? -1 : i)}>Edit</button>
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
          <SectionHeading title="New this round" description="Have a look">
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
                      <span className={s.where}>⌖ {l.where}</span>
                    </span>
                    <span className={s.acts}>
                      <Link href={l.href} className={s.btn}>Open</Link>
                      <button type="button" className={s.btn} aria-pressed={ok} aria-label={`Mark ${l.t} as checked`} onClick={() => setSt((p) => tick(p, i))}>✓</button>
                      <button type="button" className={`${s.btn} ${s.danger}`} onClick={() => setSt((p) => flag(p, i))}>Change</button>
                    </span>
                  </div>
                );
              })}
              <div className={s.go}>
                <span className={s.orb} aria-hidden />
                <span className={s.goText}>When everything here is ticked, say “go”. Knowvia writes the build plan and the prompts for you to read first.</span>
                <button type="button" className={s.cta} onClick={() => setWent(true)}>{went ? "Noted ✓" : "Go"}</button>
              </div>
            </div>
          </SectionHeading>
        </div>
      </div>
    </>
  );
}
