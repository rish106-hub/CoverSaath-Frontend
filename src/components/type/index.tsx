import type { ReactNode } from "react";
import styles from "./type.module.css";

export function PageTitle({ children, id }: { children: ReactNode; id?: string }) {
  return <h1 id={id} className={styles.title}>{children}</h1>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <div className={styles.kicker}>{children}</div>;
}

export function SectionHeading({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description ? <p className={styles.desc}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className={styles.sub}>{children}</h3>;
}

/** Anything Knowvia recommends: lilac block with a "Recommended" label. */
export function Recommended({ children, label = "Recommended" }: { children: ReactNode; label?: string }) {
  return (
    <div className={styles.rec}>
      <span className={styles.chip}>{label}</span>
      {children}
    </div>
  );
}
