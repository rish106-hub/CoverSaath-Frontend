import { EmergencyLive } from "@/components/soon/EmergencyLive";
import { DemoGate } from "@/components/shell/EmptyState";
import { EmergencyView } from "@/components/help/EmergencyView";

export const metadata = { title: "Emergency" };

export default function Page() {
  return <><EmergencyLive /><DemoGate empty={null}><EmergencyView /></DemoGate></>;
}
