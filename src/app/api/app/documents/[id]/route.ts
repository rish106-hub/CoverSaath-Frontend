import { AppError } from "@/server/backend";
import { deleteDocument, getDocument, withDocuments } from "@/server/backend/documents";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };
const safeId = async (p: P["params"]) => {
  const { id } = await p;
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(id)) throw new AppError(404, "NOT_FOUND");
  return id;
};

export const GET = (req: Request, { params }: P) => withDocuments(req, async (ctx) => ({ document: await getDocument(ctx, await safeId(params)) }));

export const DELETE = (req: Request, { params }: P) =>
  withDocuments(req, async (ctx) => {
    await deleteDocument(ctx, await safeId(params));
    return {};
  });
