"use client";

import { useEffect, useState } from "react";
import { adapters, type DeskBoardCase } from "@/adapters";
import { SectionHeading, SubHeading } from "@/components/type";
import { deskSteps, deskLadder, deskContacts, deskLive, deskRaise, deskScore } from "@/data/mock/help-pages";
import { RemindRowSlot } from "./slots";
import ui from "./ui.module.css";
import s from "./Desk.module.css";
import { usePageShortcuts } from "@/lib/shortcuts";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");

export function DeskView() {
  const [cases, setCases] = useState<DeskBoardCase[]>([]);
  const [sel, setSel] = useState(0);
  const [signed, setSigned] = useState(false);
  const [raise, setRaise] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    adapters.desk.board().then((c) => live && setCases(c));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) return;
    const id = setInterval(() => setTick((t) => t + 1), 2400);
    return () => clearInterval(id);
  }, []);

  usePageShortcuts({
    next: () => { if (cases.length) setSel((i) => (i + 1) % cases.length); },
    prev: () => { if (cases.length) setSel((i) => (i + cases.length - 1) % cases.length); },
  });

  const c = cases[sel];
  if (!c) return <p className={ui.small} role="status">Loading your cases</p>;
  const li = tick % deskLive.length;
  const decision = c.next === "done" ? "the decision" : c.next;

  return (
    <div className={ui.stack}>
      <div className={s.score} aria-label="Scoreboard">
        {deskScore.map((k, i) => (
          <div key={k.label} className={cx(s.stat, i === 0 && s.statDark)}>
            <div className={s.statLabel}>{k.label}</div>
            <div className={s.statValue}>{k.value}</div>
          </div>
        ))}
        <div className={cx(s.stat, signed ? s.statOk : s.statWarn)}>
          <div className={s.statLabel}>Asked of you</div>
          <div className={s.statValue}>{signed ? "0" : "1"}</div>
        </div>
      </div>

      <SectionHeading title="Your cases" description="Pick a case to see where it is and what was said.">
        <div className={s.layout}>
          <div className={s.list}>
            {cases.map((x, k) => (
              <button key={x.id} type="button" className={cx(s.case, k === sel && s.caseOn)} onClick={() => setSel(k)} aria-pressed={k === sel}>
                <span className={s.caseTop}>
                  <span className={s.caseTitle}>{x.title}</span>
                  <span className={s.state}>{x.stateLabel}</span>
                </span>
                <span className={s.bars} aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={cx(s.bar, i <= x.stage && s.barOn)} />
                  ))}
                </span>
                <span className={ui.small}>{x.who} · {x.amount} · next update {x.next}</span>
              </button>
            ))}
            <div className={s.need}>
              <span className={s.needIcon} aria-hidden>✍</span>
              <span style={{ flex: 1 }}>
                <span className={ui.strong} style={{ display: "block", fontSize: 15 }}>{signed ? "Nothing needs you" : "One thing needs you"}</span>
                <span className={ui.small}>{signed ? "Father’s claim form is signed." : "Sign Father’s claim form. We filled the rest."}</span>
              </span>
              <button type="button" className={cx(ui.btn, ui.btnDark, ui.btnSm)} onClick={() => setSigned(true)} disabled={signed}>
                {signed ? "Signed ✓" : "Sign"}
              </button>
            </div>
            <div className={s.raise}>
              <SubHeading>Raise something new</SubHeading>
              <p className={ui.small}>Say it the way you’d tell a friend. We work out who to call.</p>
              {deskRaise.map((r, k) => (
                <button key={r.say} type="button" className={cx(s.say, k === raise && s.sayOn)} onClick={() => setRaise(k)}>
                  <span className={s.orb} aria-hidden />“{r.say}”
                </button>
              ))}
              <div className={s.reply} role="status">{deskRaise[raise].reply}</div>
            </div>
          </div>

          <div className={cx(ui.card, s.detail)}>
            <div className={s.detailHead}>
              <div>
                <div className={ui.small}>{c.who} · {c.ref}</div>
                <h3 className={s.big}>{c.title}</h3>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className={ui.small}>At stake</div>
                <div className={s.big}>{c.amount}</div>
              </div>
            </div>
            <ol className={s.steps} aria-label="Case steps">
              {deskSteps.map((st, i) => (
                <li key={st.name} className={cx(s.step, i === c.stage && s.stepOn)} aria-current={i === c.stage ? "step" : undefined}>
                  <span className={cx(s.dot, i <= c.stage && s.dotOn)}>{i < c.stage || c.stage === 3 ? "✓" : i + 1}</span>
                  <span className={ui.strong}>{st.name}</span>
                  <span className={ui.small}>{st.detail}</span>
                </li>
              ))}
            </ol>
            <SectionHeading title="Thread">
              <RemindRowSlot
                label="Tell me when this case moves"
                items={[
                  { channel: "whatsapp", label: "WhatsApp", logo: "whatsapp", subject: c.title },
                  { channel: "email", label: "Email", logo: "gmail", subject: c.title },
                  { channel: "google-calendar", label: `Add ${decision === "the decision" ? "the decision" : decision + "’s decision"}`, logo: "google-calendar", subject: `${c.title}: decision` },
                ]}
              />
              <div className={s.thread}>
                {c.thread.map((m, i) => (
                  <div key={i} className={cx(s.msg, m.side === "you" && s.msgYou)}>
                    <div className={cx(s.bubble, m.side === "other" && s.bubbleOther, m.side === "you" && s.bubbleYou)}>
                      <div className={s.from}>{m.from} · {m.at}</div>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className={s.docs}>
                {c.docs.map((d) => (
                  <span key={d.name} className={cx(s.doc, d.highlighted && s.docHi)}>{d.name} · attached</span>
                ))}
              </div>
            </SectionHeading>
          </div>
        </div>
      </SectionHeading>

      <div className={s.bottom}>
        <div style={{ gridColumn: "1 / -1" }}>
          <SectionHeading title="If they say no, here is where we go next" description={c.title} />
        </div>
        <div className={cx(ui.card)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ol className={s.ladder} aria-label="Escalation ladder">
            {deskLadder.map((l, i) => (
              <li key={l.name} className={s.rung}>
                <span className={s.rungTop}>
                  <span className={cx(s.rungDot, c.rung < 0 ? s.rungNone : i === c.rung ? s.rungCur : i < c.rung ? s.rungPast : undefined)}>{i + 1}</span>
                  <span className={s.rungLine} aria-hidden />
                </span>
                <span className={ui.strong} style={{ fontSize: 14 }}>{l.name}</span>
                <span className={ui.small}>{l.detail}</span>
                <span className={ui.small} style={{ color: "var(--harbour)" }}>{c.rung < 0 ? "not needed" : l.when}</span>
              </li>
            ))}
          </ol>
          <div className={s.callout}>We move up a step only with your go-ahead. Each step’s letter is prepared from the thread above.</div>
        </div>
        <div className={ui.card}>
          <SubHeading>Who we’re talking to</SubHeading>
          {deskContacts.map((p) => (
            <div key={p.name} className={s.contact}>
              <span>
                <span className={ui.strong} style={{ display: "block", fontSize: 14 }}>{p.name}</span>
                <span className={ui.small}>{p.detail}</span>
              </span>
              <span className={ui.small} style={{ textAlign: "right" }}>reply due<br /><b>{p.due}</b></span>
            </div>
          ))}
        </div>
        <div className={s.live}>
          <h2 style={{ font: "600 20px var(--font-sans)" }}>Knowvia right now</h2>
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className={cx(s.liveRow, k === 0 && s.liveNow)} style={{ opacity: k === 0 ? 1 : 0.8 }}>
              <span className={s.liveDot} aria-hidden />
              <span>{deskLive[(li + k) % deskLive.length]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
