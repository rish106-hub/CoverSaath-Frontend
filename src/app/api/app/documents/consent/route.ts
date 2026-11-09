import { AppError } from "@/server/backend";
import { grantReadingConsent, revokeReadingConsent, withDocuments } from "@/server/backend/documents";
import { consentPut } from "@/adapters/documents-contract";

export const dynamic = "force-dynamic";

/** The person's go-ahead for storing and reading their policy documents. */
export const POST = (req: Request) =>
  withDocuments(req, async (ctx) => {
    const parsed = consentPut.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return grantReadingConsent(ctx, parsed.data.requestId);
  });

/** Withdraws the go-ahead. The backend erases what it read from the documents. */
export const DELETE = (req: Request) => withDocuments(req, (ctx) => revokeReadingConsent(ctx));
