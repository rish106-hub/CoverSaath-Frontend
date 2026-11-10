import "server-only";

export type AppErrorCode =
  | "CONFIG_MISSING" | "BACKEND_UNREACHABLE" | "BACKEND_TIMEOUT" | "BACKEND_BAD_RESPONSE"
  | "BACKEND_REJECTED" | "UNAUTHENTICATED" | "INVALID_INPUT" | "FORBIDDEN_ORIGIN"
  | "REVISION_CONFLICT" | "LOCATION_PERMISSION_REQUIRED" | "RATE_LIMITED" | "NOT_FOUND" | "FORBIDDEN" | "BACKEND_BUSY" | "INVALID_CREDENTIALS" | "DEMO_READ_ONLY"
  | "CONSENT_REQUIRED" | "FILE_TYPE_INVALID" | "FILE_TOO_LARGE" | "FILE_EMPTY" | "DUPLICATE_DOCUMENT" | "PDF_PROTECTED" | "PDF_UNREADABLE"
  | "PDF_ACTIVE_CONTENT" | "PDF_TOO_LONG" | "PDF_TOO_COMPLEX"
  | "UPLOAD_UNAVAILABLE" | "READING_UNAVAILABLE" | "NOT_READY" | "BLOB_MISSING"
  | "CHAT_NOT_CONFIGURED" | "VOICE_NOT_CONFIGURED" | "VOICE_BUSY" | "VOICE_UPSTREAM_FAILED" | "VOICE_TOO_LARGE" | "VOICE_BAD_AUDIO" | "VOICE_RATE_LIMITED";

/** Client-safe error: code and status only, never backend bodies or tokens. `retryAfter` is seconds, sent as Retry-After. */
export class AppError extends Error {
  constructor(public status: number, public code: AppErrorCode, public retryable = false, public retryAfter?: number) {
    super(code);
    this.name = "AppError";
  }
}

export const errorBody = (e: AppError) => ({ ok: false as const, code: e.code, retryable: e.retryable });
