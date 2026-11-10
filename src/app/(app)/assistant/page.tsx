import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { HelpHead } from "@/components/help/HelpHead";
import { AssistantView } from "@/components/help/AssistantView";

export const metadata = { title: "Ask Knowvia" };

export default function Page() {
  return (
    <>
      <HelpHead route="/assistant" />
      <DemoGate empty={<EmptyState title="Nothing to ask about yet" body="Upload your policy and Knowvia reads it for you. Then you can ask questions about your cover." />}><AssistantView /></DemoGate>
    </>
  );
}
