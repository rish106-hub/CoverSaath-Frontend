import "server-only";
import { AppError } from "./errors";

/** Same-origin only: state-changing calls need the app marker header and a matching Origin when sent. */
export function assertSameOrigin(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  if (req.headers.get("x-knowvia-app") !== "1") throw new AppError(403, "FORBIDDEN_ORIGIN");
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) throw new AppError(403, "FORBIDDEN_ORIGIN");
}
