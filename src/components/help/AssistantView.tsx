"use client";

import { useState } from "react";
import { SectionHeading } from "@/components/type";
import { utterances, understanding } from "@/data/mock/help-pages";
import ui from "./ui.module.css";
import s from "./Assistant.module.css";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");
const toneClass = { urgent: s.factUrgent, cover: s.factCover, number: s.factNumber, word: s.factWord } as const;

/** Asks the global Ask Knowvia card (W1) to open with this text. */
function askKnowvia(text: string) {
  window.dispatchEvent(new CustomEvent("knowvia:ask", { detail: { text } }));
}

export function AssistantView() {
  const [i, setI] = useState(0);
  const u = utterances[i];
  return (
    <div className={s.layout}>
      <div className={s.col}>
        <SectionHeading title="Try saying">
          <div className={s.tries}>
            {utterances.map((x, k) => (
              <button key={x.say} type="button" className={cx(ui.chip, k === i && ui.chipOn)} aria-pressed={k === i} onClick={() => { setI(k); askKnowvia(x.say); }}>
                {x.say}
              </button>
            ))}
          </div>
          <p className={s.say}>“{u.say}”</p>
          <div className={s.facts}>
            <span className={cx(s.fact, toneClass[u.tone])}><b>Request:</b> {u.label}</span>
            <span className={s.fact}><b>For:</b> {u.person}</span>
            <span className={s.fact}><b>Confidence:</b> {u.conf}</span>
            <span className={s.fact}><b>Next:</b> {u.route}</span>
          </div>
          <div className={cx(s.answer, u.tone === "urgent" && s.answerUrgent)} aria-live="polite">
            <div className={s.kick}>{u.kicker}</div>
            <div className={s.answerText}>{u.answer}</div>
            {u.ref ? <span className={s.ref}>{u.ref}</span> : null}
            <div className={s.acts}>
              {u.acts.map((a) => (
                <a key={a.text} href={a.href} className={cx("k-btn", a.primary && "k-btn--primary")} style={u.tone === "urgent" ? { background: a.primary ? "#e9785d" : "#f7f5f0", color: "#16130f", borderColor: "transparent" } : undefined}>
                  {a.text}
                </a>
              ))}
            </div>
          </div>
        </SectionHeading>
      </div>
      <div className={s.col}>
        <SectionHeading title="What Knowvia understands">
          <div className={s.grid}>
            {understanding.map((x) => {
              const on = x.on === i;
              return (
                <div key={x.title} className={cx(s.item, on && s.itemOn)}>
                  <span className={cx(s.glyph, on && s.glyphOn)} aria-hidden>{x.glyph}</span>
                  <span>
                    <span className={ui.strong} style={{ display: "block", fontSize: 14 }}>{x.title}</span>
                    <span className={ui.small}>{x.detail}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className={s.instant}>
            <span aria-hidden style={{ fontSize: 24 }}>⚡</span>
            <span>Words like <b>chest pain</b> or <b>accident</b> open Emergency straight away.</span>
          </div>
        </SectionHeading>
      </div>
    </div>
  );
}
