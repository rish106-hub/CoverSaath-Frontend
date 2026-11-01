import { Kicker, PageTitle } from "@/components/type";
import { pageFor } from "@/lib/ia";

export function HelpHead({ route, title }: { route: string; title?: string }) {
  const page = pageFor(route);
  if (!page) return null;
  return (
    <div>
      {page.kicker ? <Kicker>{page.kicker}</Kicker> : null}
      <PageTitle>{title ?? page.title}</PageTitle>
    </div>
  );
}
