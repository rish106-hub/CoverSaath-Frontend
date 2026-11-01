import Link from "next/link";
import { GROUPS, pagesIn } from "@/lib/ia";
import { readingList } from "@/data/mock/learn";
import { UserChip } from "./UserChip";
import styles from "./HomeSidebar.module.css";

/** Left sidebar for /home (board Home: <aside>). */
export function HomeSidebar({ pathname = "/home" }: { pathname?: string }) {
  return (
    <aside className={styles.aside}>
      <Link href="/home" className={styles.brand}>Knowvia</Link>
      <nav className={styles.groups} aria-label="Knowvia sections">
        {GROUPS.map((g) => (
          <div key={g.id} className={styles.group}>
            <span className={styles.gname}>
              <i style={{ background: g.color }} aria-hidden />
              {g.label}
            </span>
            {pagesIn(g.id)
              .filter((p) => p.route !== "/emergency")
              .map((p) => (
                <Link key={p.route} href={p.href} className={p.href === pathname ? styles.on : styles.item} aria-current={p.href === pathname ? "page" : undefined}>
                  {p.tab}
                </Link>
              ))}
          </div>
        ))}
      </nav>
      <Link href="/emergency" className={styles.emergency}>
        <span aria-hidden>●</span> Emergency
      </Link>
      <hr className={styles.rule} />
      <div className={styles.block}>
        <div className={styles.label}>Today</div>
        <div className={styles.text}>Father’s senior plan renews in <b>132 days</b>.</div>
        <Link href="/compare" className={styles.link}>Review it →</Link>
      </div>
      <hr className={styles.rule} />
      <div className={styles.block}>
        <div className={styles.label}>Reading list</div>
        {readingList.map((r) => (
          <Link key={r.title} href="/home" className={styles.read}>
            <span>{r.title}</span>
            <span className={styles.meta}>{r.minutes} min</span>
          </Link>
        ))}
      </div>
      <UserChip />
    </aside>
  );
}
