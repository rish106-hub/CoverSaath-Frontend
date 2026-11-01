import { HelpHead } from "@/components/help/HelpHead";
import { ShortcutsView } from "@/components/help/ShortcutsView";

export const metadata = { title: "Shortcuts" };

export default function Page() {
  return (
    <>
      <HelpHead route="/shortcuts" />
      <ShortcutsView />
    </>
  );
}
