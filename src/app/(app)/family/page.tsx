import { DemoGate, EmptyState } from "@/components/shell/EmptyState";
import { PageTitle, Kicker } from "@/components/type";
import { FamilyView } from "@/components/family";
import { FamilyOwner } from "@/components/shell";
import { pageFor } from "@/lib/ia";

export const metadata = { title: "People and invites" };

export default function Page() {
  const page = pageFor("/family");
  if (!page) return null;
  return (
    <>
      <div>
        {page.kicker ? <Kicker>{page.kicker}</Kicker> : null}
        <PageTitle>{page.title}</PageTitle>
      </div>
      <DemoGate empty={<EmptyState title="Only you so far" body="Upload your policy and Knowvia reads it for you. The people it covers are added to your family from there."><FamilyOwner /></EmptyState>}><FamilyView /></DemoGate>
    </>
  );
}
