import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { importBatches, mediaAssets } from "@/db/schema";
import { MediaRequestError, mediaErrorResponse, requireMediaAdmin } from "@/lib/media/admin";
import { optimizeImage, validateOriginalFilename } from "@/lib/media/image";
import { mediaUrl, UUID_PATTERN } from "@/lib/media/shared";
import { assertStorageConfigured, deleteMediaObject, putMediaObject } from "@/lib/media/storage";
import { readBoundedBody, reserveUpload } from "@/lib/media/upload";

export const runtime = "nodejs";

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; cause?: unknown };
  return value.code === "23505" || (value.cause !== error && isUniqueViolation(value.cause));
}

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  let objectKey: string | undefined;
  let persisted = false;
  try {
    await requireMediaAdmin(request);
    release = reserveUpload();
    const batchId = new URL(request.url).searchParams.get("batchId") ?? "";
    if (!UUID_PATTERN.test(batchId)) throw new MediaRequestError("Select a valid import batch.", 400);
    let filename;
    try {
      filename = validateOriginalFilename(decodeURIComponent(request.headers.get("x-file-name") ?? ""));
    } catch {
      throw new MediaRequestError("Use a JPG, PNG or WebP filename without paths (maximum 255 characters).", 400);
    }
    const [batch] = await db.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
    if (!batch) throw new MediaRequestError("This import batch does not exist.", 404);
    const [existing] = await db.select({ id: mediaAssets.id }).from(mediaAssets)
      .where(and(eq(mediaAssets.batchId, batchId), eq(mediaAssets.originalFilename, filename))).limit(1);
    if (existing) throw new MediaRequestError("This filename already exists in this batch. Use another batch for a different image.", 409);
    assertStorageConfigured();
    const input = await readBoundedBody(request);
    let optimized;
    try { optimized = await optimizeImage(input, filename, request.headers.get("content-type") ?? ""); }
    catch (error) { throw new MediaRequestError(error instanceof Error ? error.message : "Invalid image.", 400); }
    const id = randomUUID();
    // Supplier filenames never determine a path or overwrite an existing key.
    objectKey = `media/${batchId}/${id}/image.webp`;
    await putMediaObject(objectKey, optimized.data);
    await db.insert(mediaAssets).values({
      id, batchId, originalFilename: filename, objectKey, mimeType: "image/webp",
      sizeBytes: optimized.data.length, width: optimized.width, height: optimized.height,
    });
    persisted = true;
    return Response.json({ asset: {
      id, originalFilename: filename, url: mediaUrl(id, filename),
      sizeBytes: optimized.data.length, width: optimized.width, height: optimized.height,
    } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (objectKey && !persisted) {
      try { await deleteMediaObject(objectKey); }
      catch {
        // Log only our generated key, never SDK errors, endpoints or credentials.
        console.error("Media cleanup requires attention:", objectKey);
      }
    }
    return mediaErrorResponse(isUniqueViolation(error)
      ? new MediaRequestError("This filename was uploaded to this batch by another request. Reload the library.", 409)
      : error);
  } finally { release?.(); }
}
