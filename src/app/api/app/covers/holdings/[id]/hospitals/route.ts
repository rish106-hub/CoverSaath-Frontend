import { withCovers } from "@/server/backend/covers";
import { listHospitals } from "@/server/backend/chat-v1";
import { pathId } from "@/server/backend/evidence";
import { AppError } from "@/server/backend";
import { PINCODE } from "@/adapters/chat-contract";

export const dynamic = "force-dynamic";

/** Network hospitals of one cover for a six-digit pincode. Backend: GET /api/v1/holdings/{id}/hospitals (CoverSaath #105). */
export const GET = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  withCovers(req, async (ctx) => {
    const holdingId = pathId((await params).id);
    const pincode = new URL(req.url).searchParams.get("pincode") ?? "";
    if (!PINCODE.test(pincode)) throw new AppError(400, "INVALID_INPUT");
    return listHospitals(ctx, holdingId, pincode);
  });
