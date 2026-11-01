import { AccessCard } from "@/components/access/AccessCard";
import { ThemeToggle } from "@/components/theme";
import { Kicker, PageTitle } from "@/components/type";

export default function Landing() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 48px", display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <Kicker>Private beta · free while in beta</Kicker>
        <PageTitle>Your health cover, explained in rupees.</PageTitle>
      </div>
      <AccessCard />
      <ThemeToggle />
    </main>
  );
}
