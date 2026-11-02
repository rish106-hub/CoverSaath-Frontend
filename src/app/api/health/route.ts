export const dynamic = "force-dynamic";

/** Liveness only. No backend call, no secrets, so it stays up when the API is down. */
export function GET() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
