import Link from "next/link";
import { groupById, pagesIn, pageFor, type GroupId } from "@/lib/ia";
import styles from "./PageHeader.module.css";

/** Header at the top of every app page except /home (board Compare: .phead). */
export function PageHeader({ pathname }: { pathname: string }) {
  const page = pageFor(pathname);
  const groupId: GroupId | null = page?.group ?? null;
  const group = groupId ? groupById(groupId) : null;
  const tabs = groupId ? pagesIn(groupId) : [];
  return (
    <header className={styles.phead}>
      <div className={styles.prow}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/home">Knowvia</Link>
          {group ? (
            <>
              <span aria-hidden>/</span>
              <span className={styles.dot} style={{ background: group.color }} aria-hidden />
              <Link href={group.home}>{group.label}</Link>
            </>
          ) : null}
          <span aria-hidden>/</span>
          <b aria-current="page">{page?.tab ?? "Knowvia"}</b>
        </nav>
      </div>
      {group ? (
        <nav className={styles.ptabs} aria-label={group.label}>
          {tabs.map((t) => {
            const on = t.tab === page?.tab;
            return (
              <Link key={t.route} href={t.href} className={on ? styles.tabOn : undefined} style={on ? { borderColor: group.color } : undefined} aria-current={on ? "page" : undefined}>
                {t.tab}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
