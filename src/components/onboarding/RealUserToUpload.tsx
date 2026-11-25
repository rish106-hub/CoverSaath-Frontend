"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/components/shell/useMe";
import { UPLOAD_HREF } from "@/components/shell/EmptyState";
import { PageSkeleton } from "@/components/shell/ErrorPanel";

/**
 * The welcome steps are a sample walk-through (demo session only). A real account adds its policy in the one real flow,
 * so it goes straight there instead of choosing a method that is then ignored.
 */
export function RealUserToUpload({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state } = useMe();
  const real = state.status === "ready" && state.me.source === "backend";
  useEffect(() => { if (real) router.replace(UPLOAD_HREF); }, [real, router]);
  if (state.status === "loading" || real) return <PageSkeleton />;
  return <>{children}</>;
}
