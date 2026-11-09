import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { CardsPage } from "@/components/wallet/CardsPage";

export const metadata = { title: "Cards and wallet" };

export default function Page() {
  return <DemoGate empty={<EmptyState title="No cards yet" body="Upload your policy and Knowvia reads it for you. Your insurance e-cards are made from it." />}><CardsPage /></DemoGate>;
}
