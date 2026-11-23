import Link from "next/link";
import type { ReactNode } from "react";

/** Plain page for Privacy, Terms and Contact. Wording is a first version and needs legal review before real users (owner action). */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px", display: "flex", flexDirection: "column", gap: 16, lineHeight: 1.6 }}>
      <Link href="/">Knowvia</Link>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
