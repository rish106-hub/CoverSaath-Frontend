import { DeclarationsView } from "@/components/covers/DeclarationsView";

export const metadata = { title: "Declarations and money" };

export default async function Page({ searchParams }: { searchParams?: Promise<{ holding?: string }> }) {
  return <DeclarationsView holding={(await searchParams)?.holding} />;
}
