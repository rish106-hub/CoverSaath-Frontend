import { userDataRoute, readBody, schemas } from "@/server/backend/user-data";

export const dynamic = "force-dynamic";

export const GET = userDataRoute(({ client, session }) => client.getPreferences(session.t, session.h));

export const PUT = userDataRoute(async ({ req, client, session }) => client.setPreferences(session.t, session.h, await readBody(req, schemas.prefsPut)));
