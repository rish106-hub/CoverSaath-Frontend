import { PageTitle, Kicker } from "@/components/type";
import { FamilyView } from "@/components/family";
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
      <FamilyView />
    </>
  );
}
