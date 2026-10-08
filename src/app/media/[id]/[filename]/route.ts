import { eq } from "drizzle-orm";

import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { UUID_PATTERN } from "@/lib/media/shared";
import { getMediaObject } from "@/lib/media/storage";

export const runtime = "nodejs";

async function serve(request: Request, context: { params: Promise<{ id: string; filename: string }> }, head: boolean) {
  const { id, filename } = await context.params;
  // Only registered images are readable; callers cannot select a bucket or key.
  if (!UUID_PATTERN.test(id) || !/^[a-z0-9][a-z0-9-]{0,119}\.webp$/.test(filename)) {
    return new Response(null, { status: 404 });
  }
  try {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!asset) return new Response(null, { status: 404 });
    const etag = `"${asset.id}"`;
    const headers = {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(asset.sizeBytes),
      ETag: etag,
    };
    if (request.headers.get("if-none-match")?.split(",").map((tag) => tag.trim()).includes(etag)) {
      return new Response(null, { status: 304, headers: { "Cache-Control": headers["Cache-Control"], ETag: etag } });
    }
    if (head) return new Response(null, { headers });
    const object = await getMediaObject(asset.objectKey);
    if (!object.Body) return new Response(null, { status: 404 });
    return new Response(object.Body.transformToWebStream(), { headers });
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? error.name : "";
    return new Response(null, { status: name === "NoSuchKey" ? 404 : 503, headers: { "Cache-Control": "no-store" } });
  }
}

export function GET(request: Request, context: { params: Promise<{ id: string; filename: string }> }) {
  return serve(request, context, false);
}

export function HEAD(request: Request, context: { params: Promise<{ id: string; filename: string }> }) {
  return serve(request, context, true);
}
