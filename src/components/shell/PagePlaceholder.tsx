import { PageTitle, Kicker, SectionHeading } from "@/components/type";
import { pageFor } from "@/lib/ia";

/** Route content stub: page title, kicker and board section headings. W1-W5 replace the body. */
export function PagePlaceholder({ route }: { route: string }) {
  const page = pageFor(route);
  if (!page) return null;
  return (
    <>
      <div>
        {page.kicker ? <Kicker>{page.kicker}</Kicker> : null}
        <PageTitle>{page.title}</PageTitle>
      </div>
      {page.sections.map((s) => (
        <SectionHeading key={s.heading} title={s.heading} description={s.description} />
      ))}
    </>
  );
}
