import "server-only";
import { AppError } from "./errors";
import type { AppErrorCode } from "./errors";

/**
 * Reads a request body with a hard byte cap BEFORE it is buffered whole. Content-Length must be present and within the cap (a missing or
 * non-numeric header is refused), and the stream is read with a running counter that aborts as soon as the cap is crossed, so a lying
 * header or a chunked body cannot make the server hold more than `max` bytes.
 */
export async function readCappedBody(req: Request, max: number, tooLarge: AppErrorCode = "INVALID_INPUT"): Promise<Uint8Array> {
  const raw = req.headers.get("content-length");
  const declared = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
  if (!Number.isFinite(declared) || declared < 0) throw new AppError(411, "INVALID_INPUT");
  if (declared > max) throw new AppError(413, tooLarge);
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => undefined);
        throw new AppError(413, tooLarge);
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}
