import { redirect } from "next/navigation";

export const metadata = { title: "Add a cover" };

/** The one add-a-cover journey lives at /covers/add. */
export default function Page(): never {
  redirect("/covers/add");
}
