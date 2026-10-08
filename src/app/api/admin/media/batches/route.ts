import { and, desc, eq, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { importBatches } from "@/db/schema";
import { MediaRequestError, mediaErrorResponse, requireMediaAdmin } from "@/lib/media/admin";
import { UUID_PATTERN } from "@/lib/media/shared";
import { readBoundedBody } from "@/lib/media/upload";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireMediaAdmin(request);
    const beforeId = new URL(request.url).searchParams.get("beforeId");
    let cursor;
    if (beforeId) {
      if (!UUID_PATTERN.test(beforeId)) throw new MediaRequestError("Invalid batch cursor.", 400);
      [cursor] = await db.select({ id: importBatches.id, createdAt: importBatches.createdAt }).from(importBatches)
        .where(eq(importBatches.id, beforeId)).limit(1);
      if (!cursor) throw new MediaRequestError("Batch cursor no longer exists. Reload the library.", 400);
    }
    const batches = await db.select().from(importBatches)
      .where(cursor ? or(lt(importBatches.createdAt, cursor.createdAt), and(eq(importBatches.createdAt, cursor.createdAt), lt(importBatches.id, cursor.id))) : undefined)
      .orderBy(desc(importBatches.createdAt), desc(importBatches.id)).limit(101);
    return Response.json({ batches: batches.slice(0, 100), nextCursor: batches.length > 100 ? batches[99].id : null }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) { return mediaErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await requireMediaAdmin(request);
    const input = await readBoundedBody(request, 1024);
    let body;
    try { body = JSON.parse(input.toString("utf8")); }
    catch { throw new MediaRequestError("Invalid batch request.", 400); }
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 150 || /[\x00-\x1f\x7f]/.test(name)) {
      throw new MediaRequestError("Enter a batch name between 1 and 150 characters.", 400);
    }
    const [batch] = await db.insert(importBatches).values({ name }).returning();
    return Response.json({ batch }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
