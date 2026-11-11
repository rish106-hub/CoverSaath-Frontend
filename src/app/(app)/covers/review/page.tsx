import { CoverReviewView } from "@/components/covers/CoverReviewView";

export const metadata = { title: "What we found" };

export default async function Page({ searchParams }: { searchParams?: Promise<{ holding?: string }> }) {
  return <CoverReviewView holding={(await searchParams)?.holding} />;
}
