import { HelpHead } from "@/components/help/HelpHead";
import { AssistantView } from "@/components/help/AssistantView";

export const metadata = { title: "Ask Knowvia" };

export default function Page() {
  return (
    <>
      <HelpHead route="/assistant" />
      <AssistantView />
    </>
  );
}
