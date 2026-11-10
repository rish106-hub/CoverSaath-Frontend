import { blobInfo, issueBlobToken, withDocuments } from "@/server/backend/documents";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** The folder a large PDF must be uploaded into. Refused for the demo, without a Blob store or without the reading go-ahead. */
export const GET = (req: Request) => withDocuments(req, async (ctx) => blobInfo(ctx));

/** Token request from the Blob client (`upload()` in the browser): PDF only, up to 15 MB, five minutes, inside the household's folder. */
export const POST = (req: Request) => withDocuments(req, (ctx) => issueBlobToken(ctx, req));
