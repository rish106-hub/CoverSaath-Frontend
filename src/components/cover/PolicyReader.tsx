"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adapters, type Finding, type Policy } from "@/adapters";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";
import { DOCS, PAGES, READING_POLICY_ID, TOPICS, guidesFor, topicPageKey, type DocId, type Topic } from "@/data/mock/policy";
import styles from "./PolicyReader.module.css";

const WHO = [{ id: "self", label: "You" }, { id: "spouse", label: "Spouse" }, { id: "child", label: "Child" }];

function findingsToTopics(fs: Finding[]): Topic[] {
  return fs.map((f, i) => ({ id: `f${i}` as Topic["id"], label: f.label, value: f.answer, plain: f.disagrees ? "Details differ between documents. Ask the insurer which applies." : "Read from your policy.", ref: f.pageRef, at: null, state: f.disagrees ? "Needs review" : "Read from the policy", disagrees: f.disagrees }));
}

export function PolicyReader({ id }: { id: string }) {
  const [policy, setPolicy] = useState<Policy | null | undefined>(undefined);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [topicId, setTopicId] = useState<string>("room");
  const [doc, setDoc] = useState<DocId>("policy");
  const [who, setWho] = useState("self");

  useEffect(() => {
    let live = true;
    Promise.all([adapters.policy.get(id), adapters.reading.findings(id)]).then(([p, f]) => {
      if (!live) return;
      setPolicy(p);
      setFindings(f);
    }).catch(() => live && setPolicy(null));
    return () => {
      live = false;
    };
  }, [id]);

  if (policy === undefined) return <p className={styles.quiet} role="status">Opening your policy...</p>;
  if (policy === null) {
    return (
      <>
        <PageTitle>Policy not found</PageTitle>
        <p className={styles.quiet}><Link href="/policies">Back to My policies</Link></p>
      </>
    );
  }

  const full = id === READING_POLICY_ID;
  const topics = full ? TOPICS : findingsToTopics(findings);
  const cur = topics.find((t) => t.id === topicId) ?? topics[1] ?? topics[0];
  const key = full && cur ? topicPageKey(cur, doc) ?? (doc === "schedule" ? "schedule:1" : "policy:4") : null;
  const page = key ? PAGES[key] : null;
  const activeDoc = key ? (key.split(":")[0] as DocId) : doc;
  const pick = (t: Topic) => {
    setTopicId(t.id);
    if (full && t.at) setDoc(t.at.split(":")[0] as DocId);
  };
  const disagreeing = topics.filter((t) => t.disagrees);

  return (
    <>
      <div>
        <Kicker>Answers for {who === "self" ? "you" : WHO.find((w) => w.id === who)?.label.toLowerCase()}</Kicker>
        <PageTitle>{policy.name}</PageTitle>
        <p className={styles.sub}>{policy.insurer} · renews {policy.renewsOn}</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.left}>
          {full && page ? (
            <SectionHeading
              title="Answers from your policy"
              description={cur?.at ? `Showing: ${cur.label}` : "Not found on the pages read"}
              actions={
                <div className={styles.tabs} role="group" aria-label="Document">
                  {DOCS.map((d) => <button key={d.id} type="button" aria-pressed={activeDoc === d.id} onClick={() => { setDoc(d.id); setTopicId(d.id === "schedule" ? "sum" : "room"); }}>{d.name}</button>)}
                </div>
              }
            >
              <article className={styles.paper} aria-label="Policy page">
                <div className={styles.phead}><span>{page.head}</span><span>{page.no}</span></div>
                <h3 className={styles.ptitle}>{page.title}</h3>
                {page.paras.map((p, i) => {
                  const on = p.topic === cur?.id;
                  const mark = !p.mark ? "" : p.topic === "icu" ? styles.markCoral : on ? styles.markOn : styles.markSoft;
                  return (
                    <p key={i} className={on ? styles.pOn : undefined}>
                      {p.before}
                      {p.mark ? <mark className={`${styles.mark} ${mark}`}>{p.mark}</mark> : null}
                      {p.after}
                    </p>
                  );
                })}
              </article>
            </SectionHeading>
          ) : (
            <SectionHeading title="Answers from your policy" description="Page view is not ready for this policy yet." />
          )}

          <div className={styles.extras}>
            <div className={styles.explain}>
              <span className={styles.orb} aria-hidden />
              <span className={styles.grow}>Hear this clause in plain words</span>
              <Link href="/assistant" className="k-btn k-btn--primary k-btn--sm">Explain it</Link>
              <Link href="/assistant" className="k-btn k-btn--secondary k-btn--sm">Listen</Link>
            </div>
            {cur ? guidesFor(cur.id).map((g) => (
              <Link key={g.title} href="/home" className={styles.guide}>
                <span className={`${styles.thumb} ${styles[g.tone]}`} aria-hidden>{g.icon}</span>
                <span>
                  <span className={styles.gkind}>{g.kind}</span>
                  <span className={styles.gtitle}>{g.title}</span>
                  <span className={`k-btn k-btn--secondary k-btn--sm ${styles.glink}`}>Read guide</span>
                </span>
              </Link>
            )) : null}
          </div>
        </div>

        <aside className={styles.answers} aria-label="Answers">
          <div className={styles.who} role="group" aria-label="Answers for">
            {WHO.map((w) => <button key={w.id} type="button" aria-pressed={who === w.id} onClick={() => setWho(w.id)}>{w.label}</button>)}
          </div>
          {topics.length === 0 ? <p className={styles.quiet}>Nothing read from this policy yet.</p> : null}
          {topics.map((t) => (
            <button key={t.id} type="button" className={styles.ans} aria-pressed={cur?.id === t.id} onClick={() => pick(t)}>
              <span className={styles.arow}><span className={styles.alabel}>{t.label}</span><span className={styles.aref}>{t.ref}</span></span>
              <span className={styles.aval}><span className={t.disagrees ? styles.vCoral : t.at ? styles.vMark : undefined}>{t.value}</span></span>
              <span className={styles.aplain}>{t.plain}</span>
              <span className={`${styles.astate} ${t.disagrees ? styles.astateBad : ""}`}>{t.state}</span>
            </button>
          ))}
        </aside>
      </div>

      {disagreeing.length ? (
        <SectionHeading title="Needs review">
          <ul className={styles.dis}>
            {disagreeing.map((t) => (
              <li key={t.id}><b>{t.label}</b> <span>{t.plain}</span> <span className={styles.aref}>{t.ref}</span></li>
            ))}
          </ul>
        </SectionHeading>
      ) : null}
    </>
  );
}
