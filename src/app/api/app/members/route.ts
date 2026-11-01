import { withData } from "@/server/backend/data-routes";
import { memberService } from "@/server/backend/members";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withData(req, async ({ send, session }) => ({ members: await memberService(send, session).list() }));
}

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  return withData(req, async ({ send, session }) => ({ member: await memberService(send, session).add(body) }), 201);
}

export async function PATCH(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const body: unknown = await req.json().catch(() => null);
  return withData(req, async ({ send, session }) => ({ member: await memberService(send, session).update(id, body) }));
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withData(req, async ({ send, session }) => {
    await memberService(send, session).remove(id);
    return { removed: true };
  });
}
