import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { HelpHead } from "@/components/help/HelpHead";
import { ShortcutsView } from "@/components/help/ShortcutsView";

export const metadata = { title: "Shortcuts" };

export default function Page() {
  return (
    <>
      <HelpHead route="/shortcuts" />
      <DemoGate empty={<EmptyState title="Add a policy to use shortcuts" body="Knowvia reads it, then shortcuts work on your own policy." />}><ShortcutsView /></DemoGate>
    </>
  );
}
