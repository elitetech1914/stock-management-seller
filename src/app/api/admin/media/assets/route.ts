import { and, desc, eq, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { MediaRequestError, mediaErrorResponse, requireMediaAdmin } from "@/lib/media/admin";
import { mediaUrl, UUID_PATTERN } from "@/lib/media/shared";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireMediaAdmin(request);
    const query = new URL(request.url).searchParams;
    const batchId = query.get("batchId") ?? "";
    if (!UUID_PATTERN.test(batchId)) throw new MediaRequestError("Select a valid import batch.", 400);
    const beforeId = query.get("beforeId");
    let cursor;
    if (beforeId) {
      if (!UUID_PATTERN.test(beforeId)) throw new MediaRequestError("Invalid asset cursor.", 400);
      [cursor] = await db.select({ id: mediaAssets.id, createdAt: mediaAssets.createdAt })
        .from(mediaAssets).where(and(eq(mediaAssets.id, beforeId), eq(mediaAssets.batchId, batchId))).limit(1);
      if (!cursor) throw new MediaRequestError("Asset cursor no longer exists. Reload the library.", 400);
    }
    const assets = await db.select().from(mediaAssets).where(and(
      eq(mediaAssets.batchId, batchId),
      cursor ? or(lt(mediaAssets.createdAt, cursor.createdAt), and(eq(mediaAssets.createdAt, cursor.createdAt), lt(mediaAssets.id, cursor.id))) : undefined,
    )).orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id)).limit(101);
    return Response.json({
      assets: assets.slice(0, 100).map((asset) => ({
        id: asset.id, originalFilename: asset.originalFilename,
        url: mediaUrl(asset.id, asset.originalFilename), sizeBytes: asset.sizeBytes,
        width: asset.width, height: asset.height,
      })),
      nextCursor: assets.length > 100 ? assets[99].id : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
