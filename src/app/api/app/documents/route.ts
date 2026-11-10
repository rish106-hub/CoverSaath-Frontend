import { AppError } from "@/server/backend";
import { checkPdfUpload, listDocuments, uploadDocument, withDocuments } from "@/server/backend/documents";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = (req: Request) => withDocuments(req, (ctx) => listDocuments(ctx));

/**
 * Upload one PDF as the raw request body (content-type application/pdf). Name, kind and a retry-safe key travel in headers:
 * x-filename (URI encoded), x-document-kind, x-policy-type (required), idempotency-key. Up to 4 MB: the Vercel request body limit is 4.5 MB.
 */
export async function POST(req: Request): Promise<Response> {
  return withDocuments(req, async (ctx) => {
    const declared = req.headers.get("content-length");
    const declaredLength = declared !== null && /^\d+$/.test(declared) ? Number(declared) : null;
    // Type and declared size are refused before the body is read.
    checkPdfUpload({ contentType: req.headers.get("content-type"), declaredLength });
    const bytes = new Uint8Array(await req.arrayBuffer());
    checkPdfUpload({ contentType: req.headers.get("content-type"), declaredLength: null, bytes });
    let filename = "policy.pdf";
    try {
      filename = decodeURIComponent(req.headers.get("x-filename") ?? "").trim().slice(0, 200) || filename;
    } catch {
      throw new AppError(400, "INVALID_INPUT");
    }
    const document = await uploadDocument(ctx, {
      kind: req.headers.get("x-document-kind") ?? "policy_wording",
      policyType: req.headers.get("x-policy-type") ?? "",
      filename,
      key: req.headers.get("idempotency-key") ?? "",
      bytes,
    });
    return { document };
  }, 201);
}
