import { EmptyState, DemoGate } from "@/components/shell/EmptyState";
import { CardsPage } from "@/components/wallet/CardsPage";

export const metadata = { title: "Cards and wallet" };

export default function Page() {
  return <DemoGate empty={<EmptyState title="This page is not available." cta="Go to Home" href="/home" />}><CardsPage /></DemoGate>;
}
