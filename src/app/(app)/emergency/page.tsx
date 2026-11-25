import { SoonBento } from "@/components/soon/SoonBento";
import { EmergencyLive } from "@/components/soon/EmergencyLive";
import { DemoGate } from "@/components/shell/EmptyState";
import { EmergencyView } from "@/components/help/EmergencyView";

export const metadata = { title: "Emergency" };

export default function Page() {
  return <><EmergencyLive /><DemoGate empty={<SoonBento tiles={[{ label: "E-card for the desk" }, { label: "Blood availability" }, { label: "Share location with family" }]} />}><EmergencyView /></DemoGate></>;
}
