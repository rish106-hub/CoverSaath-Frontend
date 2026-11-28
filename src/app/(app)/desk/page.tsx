import { EmptyState, DemoGate } from "@/components/shell/EmptyState";
import { HelpHead } from "@/components/help/HelpHead";
import { DeskView } from "@/components/help/DeskView";

export const metadata = { title: "Claims and insurer talks" };

export default function Page() {
  return (
    <>
      <HelpHead route="/desk" />
      <DemoGate empty={<EmptyState title="This page is not available." cta="Go to Home" href="/home" />}><DeskView /></DemoGate>
    </>
  );
}
