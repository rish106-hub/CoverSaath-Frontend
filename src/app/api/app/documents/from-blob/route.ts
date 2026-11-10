import { AppError } from "@/server/backend";
import { uploadFromBlob, withDocuments } from "@/server/backend/documents";
import { fromBlobIn } from "@/adapters/documents-contract";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Adds a PDF the browser already put in Blob. Body: { pathname, filename, kind, key }. The blob is deleted whether or not this succeeds. */
export async function POST(req: Request): Promise<Response> {
  return withDocuments(req, async (ctx) => {
    const parsed = fromBlobIn.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    const filename = parsed.data.filename.trim() || "policy.pdf";
    return { document: await uploadFromBlob(ctx, { ...parsed.data, filename }) };
  }, 201);
}
