import { ThemeToggle } from "@/components/theme";
import { Kicker, PageTitle, SectionHeading } from "@/components/type";

export const metadata = { title: "Sign in" };

export default function SignIn() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 48px", display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <Kicker>Welcome to Knowvia</Kicker>
        <PageTitle>Sign in</PageTitle>
      </div>
      <SectionHeading title="Enter the code" />
      <SectionHeading title="Check your inbox" />
      <ThemeToggle />
    </main>
  );
}
