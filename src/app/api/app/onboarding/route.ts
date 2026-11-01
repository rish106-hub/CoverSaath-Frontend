import { userDataRoute, readBody, schemas } from "@/server/backend/user-data";

export const dynamic = "force-dynamic";

export const GET = userDataRoute(({ client, session }) => client.getOnboarding(session.t, session.h));

export const PUT = userDataRoute(async ({ req, client, session }) => client.setOnboarding(session.t, session.h, await readBody(req, schemas.onboardingPut)));
