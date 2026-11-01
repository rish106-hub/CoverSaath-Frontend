import { withData } from "@/server/backend/data-routes";
import { parseRevision, scenarioService } from "@/server/backend/scenarios";

export const dynamic = "force-dynamic";

/** GET ?tool=x reads one saved scenario, GET with no tool lists them. PUT ?tool=x replaces one; If-Match carries the revision last seen. */
export async function GET(req: Request) {
  const tool = new URL(req.url).searchParams.get("tool");
  return withData(req, async ({ send, session }) => {
    const svc = scenarioService(send, session);
    return tool ? { scenario: await svc.get(tool) } : { scenarios: await svc.list() };
  });
}

export async function PUT(req: Request) {
  const tool = new URL(req.url).searchParams.get("tool");
  const body: unknown = await req.json().catch(() => null);
  return withData(req, async ({ send, session }) => ({ scenario: await scenarioService(send, session).put(tool, body, parseRevision(req.headers.get("if-match"))) }));
}
