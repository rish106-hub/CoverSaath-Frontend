import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { EmergencyView } from "@/components/help/EmergencyView";

export const metadata = { title: "Emergency" };

export default function Page() {
  return <DemoGate empty={<EmptyState title="Emergency help needs your policy" body="Upload your policy and Knowvia reads it for you. Then we can show cashless hospitals on your plan." />}><EmergencyView /></DemoGate>;
}
