"use client";

import { useMe } from "@/components/shell/useMe";
import { PageTitle } from "@/components/type";

/** The /family heading. The sample household name is for the demo only; a real account never sees a made-up name. */
export function FamilyTitle({ demo }: { demo: string }) {
  const { state } = useMe();
  if (state.status === "loading") return null;
  const sample = state.status === "ready" && state.me.source !== "backend";
  return <PageTitle>{sample ? demo : "Your household"}</PageTitle>;
}
