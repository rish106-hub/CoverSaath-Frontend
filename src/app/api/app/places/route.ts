import { userDataRoute, readBody, readQuery, schemas } from "@/server/backend/user-data";

export const dynamic = "force-dynamic";

export const GET = userDataRoute(({ client, session }) => client.listPlaces(session.t, session.h));

export const PUT = userDataRoute(async ({ req, client, session }) => client.setPlace(session.t, session.h, await readBody(req, schemas.placePut)));

export const DELETE = userDataRoute(({ req, client, session }) => client.deletePlace(session.t, session.h, readQuery(req, schemas.placeDelete)));
