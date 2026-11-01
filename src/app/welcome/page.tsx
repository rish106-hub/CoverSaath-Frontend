import { WelcomeIntro } from "@/components/access/Welcome";

export const metadata = { title: "Welcome" };

export default function Welcome() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 48px", display: "flex", flexDirection: "column", gap: 24 }}>
      <WelcomeIntro />
    </main>
  );
}
