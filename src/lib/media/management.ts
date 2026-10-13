import "server-only";

import { and, asc, count, desc, eq, ilike, isNull, lt, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { mediaAssets, productImages, productVariants } from "@/db/schema";
import { MediaRequestError } from "./admin";
import { assetAssociations } from "./associations";
import { descriptiveMediaUrl, managedMediaId, mediaNameUrl, mediaUrl, type MediaAssetView } from "./shared";

type Database = Pick<NodePgDatabase, "select" | "transaction">;

export function parseDescriptiveName(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") throw new MediaRequestError("Enter a descriptive image name.", 400);
  const name = value.trim().replace(/\.(jpe?g|png|webp)$/i, "").trim();
  if (!name || name.length > 255 || /[\\/\x00-\x1f\x7f]/.test(name)) throw new MediaRequestError("Use a name of 1–255 characters without paths or control characters.", 400);
  return name;
}

export async function mediaAssetViews(database: Pick<NodePgDatabase, "select">, assets: (typeof mediaAssets.$inferSelect)[]): Promise<MediaAssetView[]> {
  const associations = await assetAssociations(database, assets.map((asset) => asset.id));
  return assets.map((asset) => {
    const links = associations.filter((association) => association.assetId === asset.id);
    const primary = links.find((link) => link.kind === "gallery") || links[0];
    const effectiveName = asset.descriptiveName || primary?.title || asset.originalFilename.replace(/\.[^.]+$/, "");
    return {
      id: asset.id, originalFilename: asset.originalFilename, descriptiveName: asset.descriptiveName,
      effectiveName, deletionPending: Boolean(asset.deletedAt),
      url: primary?.url || (asset.descriptiveName ? mediaNameUrl(asset.id, asset.descriptiveName) : mediaUrl(asset.id, asset.originalFilename)),
      sizeBytes: asset.sizeBytes, width: asset.width, height: asset.height,
      usageCount: new Set(links.map((link) => link.productId)).size,
      associations: links.slice(0, 20).map(({ productId, title, sku, position, url, kind }) => ({ productId, title, sku, position, url, kind })),
    };
  });
}

export async function findMediaAssets(database: Pick<NodePgDatabase, "select">, options: { batchId?: string; q?: string; beforeId?: string }) {
  const where = [isNull(mediaAssets.storageDeletedAt)];
  if (options.batchId) where.push(eq(mediaAssets.batchId, options.batchId));
  if (options.q) {
    const pattern = "%" + options.q.replace(/[\\%_]/g, "\\$&") + "%";
    const origin = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin + "/media/" : "";
    where.push(or(ilike(mediaAssets.originalFilename, pattern), ilike(mediaAssets.descriptiveName, pattern),
      sql`exists (select 1 from product_images pi join products p on p.id = pi.product_id
        where (pi.media_asset_id = ${mediaAssets.id} or (pi.media_asset_id is null and
          (lower(left(pi.url, length('/media/' || ${mediaAssets.id}::text || '/'))) = '/media/' || ${mediaAssets.id}::text || '/'
            or (${origin} <> '' and lower(left(pi.url, length(${origin} || ${mediaAssets.id}::text || '/'))) = lower(${origin} || ${mediaAssets.id}::text || '/')))))
        and (p.title ilike ${pattern} or p.sku ilike ${pattern} or pi.url ilike ${pattern}))`,
      sql`exists (select 1 from product_variants v join products p on p.id = v.product_id
        where (v.media_asset_id = ${mediaAssets.id} or (v.media_asset_id is null and
          (lower(left(v.image_url, length('/media/' || ${mediaAssets.id}::text || '/'))) = '/media/' || ${mediaAssets.id}::text || '/'
            or (${origin} <> '' and lower(left(v.image_url, length(${origin} || ${mediaAssets.id}::text || '/'))) = lower(${origin} || ${mediaAssets.id}::text || '/')))))
        and (p.title ilike ${pattern} or p.sku ilike ${pattern} or v.sku ilike ${pattern} or v.image_url ilike ${pattern}))`)!);
  }
  const baseWhere = and(...where);
  const [{ total }] = await database.select({ total: count() }).from(mediaAssets).where(baseWhere);
  if (options.beforeId) {
    // Keep PostgreSQL's microseconds; a JavaScript Date truncates them and can
    // skip images uploaded within the same millisecond between pages.
    const [cursor] = await database.select({ id: mediaAssets.id, createdAt: sql<string>`${mediaAssets.createdAt}::text` }).from(mediaAssets).where(and(eq(mediaAssets.id, options.beforeId), baseWhere)).limit(1);
    if (!cursor) throw new MediaRequestError("The image list changed. Refresh the library and search again.", 400);
    where.push(or(sql`${mediaAssets.createdAt} < ${cursor.createdAt}::timestamptz`, and(sql`${mediaAssets.createdAt} = ${cursor.createdAt}::timestamptz`, lt(mediaAssets.id, cursor.id)))!);
  }
  const rows = await database.select().from(mediaAssets).where(and(...where)).orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id)).limit(101);
  return { assets: await mediaAssetViews(database, rows.slice(0, 100)), total, nextCursor: rows.length > 100 ? rows[99].id : null };
}

export async function renameMediaAsset(database: Database, id: string, name: string | null) {
  await database.transaction(async (tx) => {
    const [asset] = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, id)).for("update");
    if (!asset) throw new MediaRequestError("This image no longer exists.", 404);
    if (asset.deletedAt) throw new MediaRequestError("Finish deleting this image before changing its name.", 409);
    await tx.update(mediaAssets).set({ descriptiveName: name }).where(eq(mediaAssets.id, id));
    const links = await assetAssociations(tx, [id]);
    // Lock this asset, then update only its attachments. Never acquire locks on
    // other assets while renaming, so shared galleries cannot create a lock cycle.
    for (const productId of new Set(links.map((link) => link.productId))) {
      const productLinks = links.filter((link) => link.productId === productId);
      const gallery = await tx.select({ id: productImages.id, mediaAssetId: productImages.mediaAssetId, url: productImages.url }).from(productImages)
        .where(eq(productImages.productId, productId)).orderBy(asc(productImages.position), asc(productImages.id));
      let galleryUrl: string | undefined;
      for (const [index, image] of gallery.entries()) {
        if (image.mediaAssetId !== id && managedMediaId(image.url, process.env.BETTER_AUTH_URL) !== id) continue;
        const url = descriptiveMediaUrl(id, name || productLinks[0].title, index + 1);
        galleryUrl ||= url;
        await tx.update(productImages).set({ url, mediaAssetId: id }).where(eq(productImages.id, image.id));
      }
      for (const variant of productLinks.filter((link) => link.kind === "variant")) {
        await tx.update(productVariants).set({ imageUrl: galleryUrl || mediaNameUrl(id, name || `${variant.title}-${variant.sku}`), mediaAssetId: id }).where(eq(productVariants.id, variant.imageId));
      }
    }
  });
  const [asset] = await database.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!asset) throw new MediaRequestError("This image no longer exists.", 404);
  return (await mediaAssetViews(database, [asset]))[0];
}

export async function deleteMediaAsset(database: Database, id: string, deleteObject: (key: string) => Promise<void>) {
  const key = await database.transaction(async (tx) => {
    const [asset] = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, id)).for("update");
    if (!asset) return null;
    if (asset.storageDeletedAt) return null;
    const associations = await assetAssociations(tx, [id]);
    if (associations.length) throw new MediaRequestError("This image is used by products. Remove it from all product galleries and variant images before deleting.", 409);
    if (asset.objectKey !== `media/${asset.batchId}/${asset.id}/image.webp`) throw new MediaRequestError("The image storage record is invalid. No object was deleted.", 409);
    await tx.update(mediaAssets).set({ deletedAt: asset.deletedAt || new Date() }).where(eq(mediaAssets.id, id));
    return asset.objectKey;
  });
  if (!key) return;
  try { await deleteObject(key); }
  catch { throw new MediaRequestError("Image deletion is pending because storage removal failed. Retry Delete to finish; the original filename is still retained.", 503); }
  // A durable pending record makes object/DB failures retryable; attachment
  // writers reject pending assets and foreign keys protect referenced records.
  await database.transaction(async (tx) => {
    await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.id, id)).for("update");
    if ((await assetAssociations(tx, [id])).length) throw new MediaRequestError("The image gained a product association. Refresh the library.", 409);
    // Retain the original filename and immutable identity as an archive record.
    await tx.update(mediaAssets).set({ storageDeletedAt: new Date() }).where(eq(mediaAssets.id, id));
  });
}
