"use client";

import { useEffect, useState } from "react";
import { adapters, type RankedHospital } from "@/adapters";
import { SectionHeading, Kicker, PageTitle } from "@/components/type";
import { BrandLogo } from "@/components/logos";
import { emergencyPeople, emergencyIssues } from "@/data/mock/help-pages";
import ui from "./ui.module.css";
import s from "./Emergency.module.css";
import { usePageShortcuts } from "@/lib/shortcuts";
import { useSingleFlight } from "@/lib/use-single-flight";

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");
const QR = Array.from({ length: 81 }, (_, i) => ((i * 7 + (i % 9) * 3 + Math.floor(i / 9) * 5) % 4 !== 0) || [0, 1, 2, 9, 11, 18, 19, 20].includes(i));

export function EmergencyView() {
  const [who, setWho] = useState(4);
  const [done, setDone] = useState<Record<number, boolean>>({ 0: true });
  const [issue, setIssue] = useState("chest");
  const [loc, setLoc] = useState(0);
  const [mode, setMode] = useState<"cashless" | "best">("cashless");
  const [list, setList] = useState<RankedHospital[]>([]);
  const [grp, setGrp] = useState("B+");
  const [stock, setStock] = useState<Record<string, number>>({});
  const [banks, setBanks] = useState<{ name: string; distance: string; units: number }[]>([]);
  const [qr, setQr] = useState(false);
  const [sent, setSent] = useState(false);
  const flight = useSingleFlight();

  const p = emergencyPeople[who];
  const sendCard = () =>
    flight.run(async () => {
      try {
        await adapters.notify.send("whatsapp", `${p.full} e-card`);
        if (flight.alive()) setSent(true);
      } catch {
        /* the button re-enables; nothing was sent */
      }
    });
  const sendRoute = (name: string) =>
    flight.run(async () => {
      try {
        await adapters.notify.send("whatsapp", `Route to ${name}`);
      } catch {
        /* the button re-enables */
      }
    });
  const parent = p.plan === "senior";

  useEffect(() => {
    let live = true;
    adapters.blood.groups().then((g) => live && setStock(g));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    adapters.blood.banks(grp).then((b) => live && setBanks(b));
    return () => {
      live = false;
    };
  }, [grp]);
  useEffect(() => {
    let live = true;
    adapters.hospital.ranked(issue, mode).then((h) => live && setList(h));
    return () => {
      live = false;
    };
  }, [issue, mode]);

  usePageShortcuts(Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`person-${i + 1}`, () => setWho(i)])));

  const steps = [
    { t: "Show the e-card and ask for cashless", d: "Planned stay: before admission. Emergency: within 24 hours.", ref: `${parent ? "Senior plan" : "Group plan"} p.9 §7.2`, warn: false },
    { t: "Ask which room is within your limit", d: parent ? "Up to Rs 3,000 a day. A bigger room cuts other charges." : "Up to Rs 5,000 a day.", ref: parent ? "Schedule p.3 and wording p.12 differ" : "Wording p.12 §4.1", warn: parent },
    { t: parent ? "Expect to pay 20% of the bill" : "No co-pay on this plan", d: parent ? "Your share of every claim." : "The insurer pays the eligible bill.", ref: `${parent ? "Senior plan" : "Group plan"} p.2`, warn: false },
    { t: "Carry and keep", d: "Photo ID, e-card and doctor’s note. Keep every bill.", ref: "", warn: false },
  ];
  const doneCount = Object.values(done).filter(Boolean).length;
  const progress = ["Got your location", `Matched “${emergencyIssues[issue].label}” to the right department`, `Checked ${p.name}’s cashless network`, "Ranked by distance, ICU and expertise"];

  function allow() {
    setLoc(1);
  }
  useEffect(() => {
    if (loc < 1 || loc >= 5) return;
    const id = setTimeout(() => setLoc((l) => l + 1), 700);
    return () => clearTimeout(id);
  }, [loc]);

  return (
    <div className={ui.stack}>
      <div className={s.top}>
        <span className={s.live}>● Emergency</span>
        <div className={s.people} role="group" aria-label="Who needs care">
          {emergencyPeople.map((x, i) => (
            <button key={x.name} type="button" className={cx(ui.pill, i === who && ui.pillOn)} aria-pressed={i === who} onClick={() => setWho(i)}>
              {x.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Kicker>Papers are ready</Kicker>
        <PageTitle>{p.name} needs care. <span style={{ fontStyle: "italic", color: "var(--graphite)" }}>Start here</span></PageTitle>
      </div>

      <div className={s.calls}>
        <a href="tel:112" className={cx(s.big, s.c112)}><span className={s.bigT}>Call 112</span><span className={s.bigS}>Police, fire, ambulance</span></a>
        <a href="tel:108" className={cx(s.big, s.c108)}><span className={s.bigT}>Call 108</span><span className={s.bigS}>Free ambulance</span></a>
        <a href="tel:+912055500100" className={cx(s.big, s.cTpa)}><span className={s.bigT}>Call TPA</span><span className={s.bigS}>{p.tpa}</span></a>
        <button type="button" className={cx(s.big, s.cShare)} onClick={() => navigator.geolocation?.getCurrentPosition(() => {}, () => {})}>
          <span className={s.bigT}>Share location</span><span className={ui.small}>With Rohan and Mother</span>
        </button>
      </div>

      <div className={s.cols}>
        <div className={s.col}>
          <SectionHeading title="Cashless e-card">
            <div className={s.ecard}>
              <div className={s.ecardTop}>
                <span style={{ width: 36, height: 36, borderRadius: 8, background: "#0e4f4a", color: "#f7f5f0", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "600 13px var(--font-sans)" }} aria-hidden>{parent ? "MC" : "NH"}</span>
                <span style={{ font: "600 14px var(--font-sans)", color: "#0e4f4a" }}>Cashless e-card</span>
              </div>
              <div className={s.ecardName}>{p.full}</div>
              <dl className={s.facts}>
                <div><dt>Policy number</dt><dd>{p.policyNo}</dd></div>
                <div><dt>Valid to</dt><dd>{p.valid}</dd></div>
                <div><dt>Cover left this year</dt><dd>{p.left}</dd></div>
                <div><dt>ABHA</dt><dd>{p.abha}</dd></div>
              </dl>
              {qr ? (
                <div className={s.qr} role="img" aria-label={`QR code for ${p.full}’s e-card`}>
                  {QR.map((on, i) => <i key={i} className={on ? undefined : "off"} />)}
                </div>
              ) : null}
              <div className={s.ecardBtns}>
                <button type="button" className={cx(s.ebtn, s.ebtnDark)} onClick={() => setQr((v) => !v)}>{qr ? "Hide QR" : "Show QR"}</button>
                <button type="button" className={s.ebtn} onClick={sendCard} disabled={flight.busy}>
                  <BrandLogo id="whatsapp" size={22} />{sent ? "Sent on WhatsApp" : "Send to WhatsApp"}
                </button>
              </div>
            </div>
          </SectionHeading>

          <SectionHeading title="At the desk" description={`${doneCount} of 4 done`}>
            <div className={s.panel} style={{ padding: "8px 20px" }}>
              {steps.map((st, i) => (
                <button key={st.t} type="button" className={s.chk} style={i === 0 ? { borderTop: 0 } : undefined} role="checkbox" aria-checked={!!done[i]} onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}>
                  <span className={cx(s.box, done[i] && s.boxOn)} aria-hidden>{done[i] ? "✓" : ""}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>{st.t}</span>
                    <span className={ui.small}>{st.d}</span>
                    {st.ref ? <span className={cx(s.ref, st.warn && s.refWarn)}>{st.ref}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </SectionHeading>
        </div>

        <div className={s.col}>
          <SectionHeading title="Nearest hospital" description={loc === 0 ? undefined : "Kothrud, Pune"}>
            <div className={s.panel}>
              <div className={ui.row + " " + ui.wrap}>
                {Object.entries(emergencyIssues).map(([key, v]) => (
                  <button key={key} type="button" className={cx(ui.chip, key === issue && ui.chipOn)} aria-pressed={key === issue} onClick={() => { setIssue(key); if (loc >= 1) setLoc(1); }}>
                    {v.label}
                  </button>
                ))}
              </div>
              {loc === 0 ? (
                <div className={s.loc}>
                  <span className={s.locDot} aria-hidden />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>Allow location to find a hospital</div>
                    <div className={ui.small}>Used for this search only.</div>
                  </div>
                  <button type="button" className="k-btn k-btn--primary" onClick={allow}>Allow location</button>
                </div>
              ) : null}
              {loc >= 1 && loc < 5 ? (
                <div className={s.prog} role="status" aria-live="polite">
                  {progress.map((t, k) => (
                    <div key={t} className={cx(s.progRow, k < loc && s.progOn)}>
                      <span className={cx(s.tick, k < loc && s.tickOn)} aria-hidden>{k < loc ? "✓" : ""}</span>{t}
                    </div>
                  ))}
                </div>
              ) : null}
              {loc >= 5 ? (
                <>
                  <div className={ui.row + " " + ui.wrap}>
                                        <button type="button" className={cx(ui.chip, mode === "cashless" && ui.chipOn)} aria-pressed={mode === "cashless"} onClick={() => setMode("cashless")}>Cashless on {p.name}’s plan</button>
                    <button type="button" className={cx(ui.chip, mode === "best" && ui.chipOn)} aria-pressed={mode === "best"} onClick={() => setMode("best")}>Best treatment</button>
                  </div>
                  <div className={s.map} role="img" aria-label="Map of the hospitals below, relative to you">
                    <span className={s.you} />
                    {list.map((h) => (
                      <span key={h.pin} className={cx(s.pin, h.top && s.pinTop)} style={{ left: `${h.x}%`, top: `${h.y}%` }}>{h.pin}</span>
                    ))}
                  </div>
                  {list.map((h) => (
                    <div key={h.pin} className={cx(s.hosp, h.top && s.hospTop)}>
                      <div className={s.hospHead}>
                        <div>
                          <div className={ui.row}><span className={cx(s.badge, h.top && s.badgeTop)}>{h.pin}</span><span style={{ fontSize: 17, fontWeight: 500 }}>{h.name}</span></div>
                          <div className={ui.small} style={{ marginTop: 4 }}>{h.distance} · {h.why}</div>
                        </div>
                        <span className={s.tag}>{h.tag}</span>
                      </div>
                      <div className={ui.row + " " + ui.wrap}>
                        <a className={cx("k-btn k-btn--sm", h.top && "k-btn--primary")} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(h.name + ", Pune")}`} target="_blank" rel="noopener noreferrer">
                          <BrandLogo id="google-maps" size={20} />Open in Maps
                        </a>
                        <a className="k-btn k-btn--sm" href="tel:+912055500101">Call ER</a>
                        <button type="button" className="k-btn k-btn--sm" onClick={() => sendRoute(h.name)} disabled={flight.busy}>Send route to Rohan</button>
                      </div>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          </SectionHeading>

          <SectionHeading title="Blood nearby" description="Within 10 km">
            <div className={s.panel}>
              <div className={s.groups} role="group" aria-label="Blood group">
                {Object.entries(stock).map(([g, n]) => (
                  <button key={g} type="button" className={cx(s.grp, g === grp && s.grpOn)} aria-pressed={g === grp} onClick={() => setGrp(g)}>
                    <span style={{ fontSize: 18, fontWeight: 600 }}>{g}</span>
                    <span className={cx(s.units, n < 4 && s.low)}>{n} u</span>
                  </button>
                ))}
              </div>
              <div>
                {banks.map((b) => (
                  <div key={b.name} className={s.bank}>
                    <span><b style={{ fontWeight: 500 }}>{b.name}</b> <span className={ui.small}>· {b.distance}</span></span>
                    <span className={s.units} style={{ color: "var(--harbour)", fontWeight: 600 }}>{b.units} units {grp}</span>
                    <a className="k-btn k-btn--sm" href="tel:+912055500102">Call</a>
                  </div>
                ))}
              </div>
              <span className={ui.small}>Source: e-RaktKosh</span>
            </div>
          </SectionHeading>
        </div>
      </div>
    </div>
  );
}
