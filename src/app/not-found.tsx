import Link from "next/link";
import { Kicker, PageTitle } from "@/components/type";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div style={{ maxWidth: 520, margin: "20vh auto 0", padding: "0 16px", display: "grid", gap: 12 }}>
      <Kicker>404</Kicker>
      <PageTitle>We could not find that page.</PageTitle>
      <Link href="/home" style={{ color: "var(--harbour)", fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center" }}>Go to home</Link>
    </div>
  );
}
