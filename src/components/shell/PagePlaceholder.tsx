import { PageTitle, SectionHeading } from "@/components/type";
import { pageFor } from "@/lib/ia";

/** Route content stub: page title and board section headings. W1-W5 replace the body. */
export function PagePlaceholder({ route }: { route: string }) {
  const page = pageFor(route);
  if (!page) return null;
  return (
    <>
      <div>
        <PageTitle>{page.title}</PageTitle>
      </div>
      {page.sections.map((s) => (
        <SectionHeading key={s.heading} title={s.heading} description={s.description} />
      ))}
    </>
  );
}
