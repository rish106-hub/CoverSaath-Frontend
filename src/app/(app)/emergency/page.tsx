import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { EmergencyView } from "@/components/help/EmergencyView";

export const metadata = { title: "Emergency" };

export default function Page() {
  return <DemoGate empty={<EmptyState title="Find a hospital near you" body="Search network hospitals by pincode." cta="Find network hospitals" href="/hospitals" />}><EmergencyView /></DemoGate>;
}
