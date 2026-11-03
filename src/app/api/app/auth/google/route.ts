import { startGoogle } from "@/server/backend/google-flow";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return startGoogle(req);
}
