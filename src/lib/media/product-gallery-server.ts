import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { mediaAssets, productImages } from "@/db/schema";
import { ProductGalleryError, type GalleryReference } from "./product-gallery";
import { descriptiveMediaUrl, managedMediaId } from "./shared";
import { lockProductMedia } from "./associations";

type ResolvedImage = { id?: string; url: string; altText: string | null; position: number; mediaAssetId: string | null; previousPosition?: number; previousAssetId?: string | null };
type Gallery = { images: ResolvedImage[]; removedIds: string[] };
type Database = Pick<NodePgDatabase, "select" | "update" | "insert" | "delete">;

export async function resolveProductGallery(tx: Pick<NodePgDatabase, "select">, productId: string, references: GalleryReference[], title: string): Promise<Gallery> {
  const assetIds = [...new Set(references.flatMap((reference) => reference.assetId ? [reference.assetId] : []))];
  await lockProductMedia(tx, productId, assetIds);
  // Read authoritative URLs after asset locks: concurrent Rename must not be
  // overwritten with a stale URL from the editor or an earlier SELECT.
  const current = await tx.select({ id: productImages.id, url: productImages.url, altText: productImages.altText, position: productImages.position, mediaAssetId: productImages.mediaAssetId }).from(productImages)
    .where(eq(productImages.productId, productId)).orderBy(asc(productImages.position), asc(productImages.id)).for("update");
  const imageMap = new Map(current.map((image) => [image.id, image]));
  const imageIds = [...new Set(references.flatMap((reference) => reference.imageId ? [reference.imageId] : []))];
  if (imageIds.some((id) => !imageMap.has(id))) throw new ProductGalleryError("Some product images changed or no longer exist. Reload the editor before saving.");
  const candidates = [...new Set([...assetIds, ...current.map((image) => image.mediaAssetId || managedMediaId(image.url, process.env.BETTER_AUTH_URL))].filter((id): id is string => Boolean(id)))].sort();
  const assets = candidates.length ? await tx.select({ id: mediaAssets.id, name: mediaAssets.descriptiveName }).from(mediaAssets)
    .where(and(inArray(mediaAssets.id, candidates), isNull(mediaAssets.deletedAt))).orderBy(asc(mediaAssets.id)) : [];
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  if (assetIds.some((id) => !assetMap.has(id))) throw new ProductGalleryError("Some uploaded images no longer exist. Refresh the library and select again.");
  const selectedAssets = new Set(imageIds.map((id) => {
    const image = imageMap.get(id)!;
    return image.mediaAssetId || managedMediaId(image.url, process.env.BETTER_AUTH_URL);
  }).filter((id): id is string => Boolean(id)));
  const seenImages = new Set<string>();
  const seenAssets = new Set<string>();
  const images: ResolvedImage[] = [];
  for (const reference of references) {
    if (reference.imageId) {
      if (seenImages.has(reference.imageId)) continue;
      seenImages.add(reference.imageId);
      const image = imageMap.get(reference.imageId)!;
      const candidate = image.mediaAssetId || managedMediaId(image.url, process.env.BETTER_AUTH_URL);
      if (image.mediaAssetId && !assetMap.has(image.mediaAssetId)) throw new ProductGalleryError("An existing image is being deleted. Reload the editor before saving.");
      images.push({ ...image, mediaAssetId: candidate && assetMap.has(candidate) ? candidate : null, previousPosition: image.position, previousAssetId: image.mediaAssetId });
    } else {
      if (selectedAssets.has(reference.assetId!) || seenAssets.has(reference.assetId!)) continue;
      seenAssets.add(reference.assetId!);
      const asset = assetMap.get(reference.assetId!)!;
      images.push({ url: descriptiveMediaUrl(asset.id, asset.name || title, images.length + 1), altText: title, position: 0, mediaAssetId: asset.id });
    }
  }
  const submittedOrder = images.flatMap((image) => image.id ? [image.id] : []);
  const retainedOrder = current.filter((image) => seenImages.has(image.id)).map((image) => image.id);
  const insertedBeforeExisting = images.some((image, index) => !image.id && images.slice(index + 1).some((later) => later.id));
  const reordered = insertedBeforeExisting || JSON.stringify(submittedOrder) !== JSON.stringify(retainedOrder);
  let lastPosition = Math.max(-1, ...images.filter((image) => image.id).map((image) => image.position));
  for (const [index, image] of images.entries()) {
    if (reordered) image.position = index;
    else if (!image.id) image.position = ++lastPosition;
    if (image.position > 2147483647) throw new ProductGalleryError("Reorder the gallery before adding more images; its saved positions are at capacity.");
  }
  return { images, removedIds: current.filter((image) => !seenImages.has(image.id)).map((image) => image.id) };
}

export async function applyProductGallery(tx: Database, productId: string, gallery: Gallery) {
  if (gallery.removedIds.length) await tx.delete(productImages).where(and(eq(productImages.productId, productId), inArray(productImages.id, gallery.removedIds)));
  for (const image of gallery.images) {
    if (image.id) {
      if (image.position !== image.previousPosition || image.mediaAssetId !== image.previousAssetId) {
        // Retain row identity, original URL, alt text and creation time.
        await tx.update(productImages).set({ position: image.position, mediaAssetId: image.mediaAssetId }).where(and(eq(productImages.productId, productId), eq(productImages.id, image.id)));
      }
    } else {
      await tx.insert(productImages).values({ productId, url: image.url, altText: image.altText, position: image.position, mediaAssetId: image.mediaAssetId });
    }
  }
}
