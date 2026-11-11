import { getIntegrations, withEvidence } from "@/server/backend/evidence";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => withEvidence(req, (ctx) => getIntegrations(ctx));
