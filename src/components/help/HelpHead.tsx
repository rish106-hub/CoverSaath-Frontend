import { PageTitle } from "@/components/type";
import { pageFor } from "@/lib/ia";

export function HelpHead({ route, title }: { route: string; title?: string }) {
  const page = pageFor(route);
  if (!page) return null;
  return (
    <div>
      <PageTitle>{title ?? page.title}</PageTitle>
    </div>
  );
}
