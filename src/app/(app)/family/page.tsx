import { FamilyOwner } from "@/components/shell";
import { PageTitle, Kicker, SectionHeading } from "@/components/type";
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
      {page.sections.map((s) => (
        <SectionHeading key={s.heading} title={s.heading} description={s.description}>
          {s.heading === "People" ? <FamilyOwner /> : null}
        </SectionHeading>
      ))}
    </>
  );
}
