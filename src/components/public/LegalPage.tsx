import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./legal.module.css";

/** Public frame for Privacy, Terms and Contact: header with Back, footer with the other legal links, so no legal page is a dead end. Wording is a first version and needs legal review before real users (owner action). */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link href="/" className={styles.brand}>Knowvia</Link>
        <Link href="/" className="k-btn k-btn--sm">Back</Link>
      </header>
      <main className={styles.main}>
        <h1>{title}</h1>
        {children}
      </main>
      <footer className={styles.foot}>
        <span>© 2026 Knowvia</span>
        <nav>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
