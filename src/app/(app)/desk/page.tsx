import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { HelpHead } from "@/components/help/HelpHead";
import { DeskView } from "@/components/help/DeskView";

export const metadata = { title: "Claims and insurer talks" };

export default function Page() {
  return (
    <>
      <HelpHead route="/desk" />
      <DemoGate empty={<EmptyState title="No claims or insurer talks yet" body="Claims and insurer conversations appear here once you have a policy on Knowvia." />}><DeskView /></DemoGate>
    </>
  );
}
