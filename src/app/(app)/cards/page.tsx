import { SoonBento } from "@/components/soon/SoonBento";
import { DemoGate } from "@/components/shell/EmptyState";
import { CardsPage } from "@/components/wallet/CardsPage";

export const metadata = { title: "Cards and wallet" };

export default function Page() {
  return <DemoGate empty={<SoonBento tiles={[{ label: "E-cards" }, { label: "Add to wallet" }, { label: "Share a card" }]} />}><CardsPage /></DemoGate>;
}
