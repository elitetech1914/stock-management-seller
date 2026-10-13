import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { MediaRequestError, mediaErrorResponse, requireMediaAdmin } from "@/lib/media/admin";
import { deleteMediaAsset, parseDescriptiveName, renameMediaAsset } from "@/lib/media/management";
import { assertStorageConfigured, deleteMediaObject } from "@/lib/media/storage";
import { readBoundedBody } from "@/lib/media/upload";
import { UUID_PATTERN } from "@/lib/media/shared";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function refreshMedia() {
  for (const path of ["/", "/products", "/admin/products", "/admin/bulk-images"]) revalidatePath(path);
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/categories/[slug]", "page");
  revalidatePath("/admin/products/[id]/edit", "page");
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireMediaAdmin(request);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new MediaRequestError("Invalid image.", 400);
    let input;
    try { input = JSON.parse((await readBoundedBody(request, 4096)).toString("utf8")); }
    catch { throw new MediaRequestError("Invalid image name request.", 400); }
    if (!input || typeof input !== "object" || !Object.hasOwn(input, "descriptiveName")) throw new MediaRequestError("Enter a descriptive image name.", 400);
    const asset = await renameMediaAsset(db, id, parseDescriptiveName(input.descriptiveName));
    refreshMedia();
    return Response.json({ asset }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireMediaAdmin(request);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new MediaRequestError("Invalid image.", 400);
    assertStorageConfigured();
    await deleteMediaAsset(db, id, deleteMediaObject);
    refreshMedia();
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
