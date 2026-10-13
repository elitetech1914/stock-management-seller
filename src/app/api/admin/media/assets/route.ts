import { db } from "@/db";
import { MediaRequestError, mediaErrorResponse, requireMediaAdmin } from "@/lib/media/admin";
import { UUID_PATTERN } from "@/lib/media/shared";
import { findMediaAssets } from "@/lib/media/management";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireMediaAdmin(request);
    const query = new URL(request.url).searchParams;
    const allBatches = query.get("scope") === "all";
    const batchId = allBatches ? undefined : query.get("batchId") || "";
    if (!allBatches && !UUID_PATTERN.test(batchId!)) throw new MediaRequestError("Select a valid import batch.", 400);
    const beforeId = query.get("beforeId") || undefined;
    if (beforeId && !UUID_PATTERN.test(beforeId)) throw new MediaRequestError("Invalid asset cursor.", 400);
    const q = (query.get("q") || "").trim();
    if (q.length > 200) throw new MediaRequestError("Use a search of up to 200 characters.", 400);
    return Response.json(await findMediaAssets(db, { batchId, beforeId, q }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
