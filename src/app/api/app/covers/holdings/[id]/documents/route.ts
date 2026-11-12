import { listHoldingDocuments, linkHoldingDocument, withCovers } from "@/server/backend/covers";
import { pathId } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

/** Documents linked to a holding. Backend: GET /api/v1/holdings/{id}/documents. */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withCovers(req, async (ctx) => listHoldingDocuments(ctx, pathId((await params).id)));

/** Links an uploaded document (the terms and conditions) to a holding. Body: { documentId, kind: "wording" | "endorsement" | "other" }. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withCovers(req, async (ctx) => linkHoldingDocument(ctx, pathId((await params).id), await req.json().catch(() => null)));
