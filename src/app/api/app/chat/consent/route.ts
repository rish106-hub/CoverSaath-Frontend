import { AppError } from "@/server/backend";
import { chatConsentState, grantChatConsent, revokeChatConsent, withDocuments } from "@/server/backend/documents";
import { consentPut } from "@/adapters/documents-contract";

export const dynamic = "force-dynamic";

// Legal review: the wording shown with this go-ahead, and the providers it names, are not final.

/** Whether the go-ahead for answering questions with the language and search providers is in place. */
export const GET = (req: Request) => withDocuments(req, async (ctx) => chatConsentState(ctx));

/** The person's go-ahead. Replay-safe: the same requestId returns the same grant. */
export const POST = (req: Request) =>
  withDocuments(req, async (ctx) => {
    const parsed = consentPut.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "INVALID_INPUT");
    return grantChatConsent(ctx, parsed.data.requestId);
  });

/** Withdraws it. Questions stop being answered until it is given again. */
export const DELETE = (req: Request) => withDocuments(req, (ctx) => revokeChatConsent(ctx));
