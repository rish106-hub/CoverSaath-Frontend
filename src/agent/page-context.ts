"use client";

import { usePathname } from "next/navigation";
import { contextFor, type PageContext } from "./page-registry";

export { PAGE_CONTEXT, contextFor } from "./page-registry";
export type { PageContext, VoiceExample } from "./page-registry";

/** The page context for the current route. Pages "register" by having an entry above. */
export function usePageContext(): PageContext {
  return contextFor(usePathname() ?? "/home");
}
