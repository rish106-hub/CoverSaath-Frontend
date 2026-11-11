import { HospitalsView } from "@/components/chat/HospitalsView";

export const metadata = { title: "Network hospitals" };

export default async function Page({ searchParams }: { searchParams?: Promise<{ holding?: string; pincode?: string }> }) {
  const q = await searchParams;
  return <HospitalsView holding={q?.holding} pincode={q?.pincode} />;
}
