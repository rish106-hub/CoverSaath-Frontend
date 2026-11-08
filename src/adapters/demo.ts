/** Browser side of the demo session: a readable marker cookie set by /api/app/demo. Not a credential; the server decides what a demo session may do. */
export const DEMO_MARKER = "kv_demo";

export function isDemoSession(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim() === `${DEMO_MARKER}=1`);
}
