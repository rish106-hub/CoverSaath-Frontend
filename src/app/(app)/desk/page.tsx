import { SoonBento } from "@/components/soon/SoonBento";
import { DemoGate } from "@/components/shell/EmptyState";
import { HelpHead } from "@/components/help/HelpHead";
import { DeskView } from "@/components/help/DeskView";

export const metadata = { title: "Claims and insurer talks" };

export default function Page() {
  return (
    <>
      <HelpHead route="/desk" />
      <DemoGate empty={<SoonBento tiles={[{ label: "Open claims" }, { label: "Insurer conversations" }, { label: "Documents to sign" }]} />}><DeskView /></DemoGate>
    </>
  );
}
