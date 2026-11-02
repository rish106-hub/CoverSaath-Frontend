import "server-only";

export type AppErrorCode =
  | "CONFIG_MISSING" | "BACKEND_UNREACHABLE" | "BACKEND_TIMEOUT" | "BACKEND_BAD_RESPONSE"
  | "BACKEND_REJECTED" | "UNAUTHENTICATED" | "INVALID_INPUT" | "FORBIDDEN_ORIGIN"
  | "REVISION_CONFLICT" | "LOCATION_PERMISSION_REQUIRED" | "RATE_LIMITED" | "NOT_FOUND" | "FORBIDDEN" | "BACKEND_BUSY";

/** Client-safe error: code and status only, never backend bodies or tokens. `retryAfter` is seconds, sent as Retry-After. */
export class AppError extends Error {
  constructor(public status: number, public code: AppErrorCode, public retryable = false, public retryAfter?: number) {
    super(code);
    this.name = "AppError";
  }
}

export const errorBody = (e: AppError) => ({ ok: false as const, code: e.code, retryable: e.retryable });
