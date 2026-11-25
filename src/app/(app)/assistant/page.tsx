import { redirect } from "next/navigation";

export const metadata = { title: "Ask Knowvia" };

export default function Page() {
  redirect("/chat");
}
