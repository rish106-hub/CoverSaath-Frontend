import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { HelpHead } from "@/components/help/HelpHead";
import { ShortcutsView } from "@/components/help/ShortcutsView";

export const metadata = { title: "Shortcuts" };

export default function Page() {
  return (
    <>
      <HelpHead route="/shortcuts" />
      <DemoGate empty={<EmptyState title="Shortcuts start from your policy" body="Upload your policy and Knowvia reads it for you." />}><ShortcutsView /></DemoGate>
    </>
  );
}
