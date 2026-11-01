import { HelpHead } from "@/components/help/HelpHead";
import { DeskView } from "@/components/help/DeskView";

export const metadata = { title: "Claims and insurer talks" };

export default function Page() {
  return (
    <>
      <HelpHead route="/desk" />
      <DeskView />
    </>
  );
}
