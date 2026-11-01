import { PolicyReader } from "@/components/cover/PolicyReader";

export const metadata = { title: "Your policy" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PolicyReader id={id} />;
}
