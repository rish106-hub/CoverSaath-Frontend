"use client";

import { useState } from "react";
import { SectionHeading, SubHeading } from "@/components/type";
import { inputPaths, paletteDemo } from "@/data/mock/help-pages";
import { shortcutGroups } from "@/lib/shortcuts";
import ui from "./ui.module.css";
import s from "./Shortcuts.module.css";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");
const QUERIES = ["room", "father", "tax"] as const;

function Path({ mode }: { mode: keyof typeof inputPaths }) {
  const path = inputPaths[mode];
  return (
    <ol className={s.path} style={{ margin: 0, padding: 0, listStyle: "none" }} aria-label={`${path.title}: sign-up to emergency`}>
      {path.steps.map(([t, how], i) => (
        <li key={t} className={s.step}>
          <span className={s.n}>{i + 1}</span>
          <span style={{ flex: 1 }}>{t}</span>
          <span className={s.how}>{how}</span>
        </li>
      ))}
    </ol>
  );
}

export function ShortcutsView() {
  const [q, setQ] = useState(0);
  const query = QUERIES[q];
  return (
    <div className={s.layout}>
      <div className={s.col}>
        <SectionHeading title="Keyboard">
          <div className={s.keys}>
            {shortcutGroups().map((g) => (
              <div key={g.title} className={s.kgroup}>
                <SubHeading>{g.title}</SubHeading>
                {g.rows.map((r) => (
                  <div key={g.title + r.label} className={s.krow}>
                    <span className={s.kcaps}>
                      {r.keys.map((k) => <kbd key={k} className={ui.key}>{k}</kbd>)}
                    </span>
                    {r.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <Path mode="key" />
        </SectionHeading>
      </div>
      <div className={s.col}>
        <SectionHeading title="Mouse">
          <Path mode="mouse" />
        </SectionHeading>
        <SectionHeading title="Voice">
          <Path mode="voice" />
        </SectionHeading>
        <div className={s.palette}>
          <div className={s.search}>
            <span aria-hidden>⌕</span>
            <span style={{ flex: 1 }}>{query}</span>
            <kbd className={ui.key}>⌘K</kbd>
          </div>
          <ul className={s.results} style={{ margin: 0, listStyle: "none" }}>
            {paletteDemo[query].map(([icon, t, g, k], i) => (
              <li key={t} className={cx(s.res, i === 0 && s.resOn)}>
                <span className={s.icon} aria-hidden>{icon}</span>
                <span style={{ flex: 1 }}>{t}</span>
                <span className={s.group}>{g}</span>
                {k ? <kbd className={ui.key}>{k}</kbd> : null}
              </li>
            ))}
          </ul>
          <div className={s.queries}>
            {QUERIES.map((x, k) => (
              <button key={x} type="button" className={cx(ui.chip, k === q && ui.chipOn)} aria-pressed={k === q} onClick={() => setQ(k)}>Try “{x}”</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
