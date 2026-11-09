import { z } from "zod";
import { AppError } from "@/server/backend";
import { advanceDocument, withDocuments } from "@/server/backend/documents";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const body = z.strictObject({ retry: z.boolean().optional() });

/** One step of the pipeline (read, then pull out the cover details). Safe to call repeatedly while a step runs. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withDocuments(req, async (ctx) => {
    const { id } = await params;
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(id)) throw new AppError(404, "NOT_FOUND");
    const raw = await req.text();
    let input: unknown = {};
    try {
      if (raw) input = JSON.parse(raw);
    } catch {
      throw new AppError(400, "INVALID_INPUT");
    }
    const parsed = body.safeParse(input);
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return { document: await advanceDocument(ctx, id, parsed.data.retry === true) };
  });
