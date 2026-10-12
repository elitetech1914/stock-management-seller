import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { mediaAssets, productImages } from "@/db/schema";
import { galleryIdentity, ProductGalleryError, type GalleryReference } from "./product-gallery";
import { mediaUrl } from "./shared";

export async function resolveProductGallery(tx: Pick<NodePgDatabase, "select">, productId: string, references: GalleryReference[], title: string) {
  const imageIds = [...new Set(references.flatMap((reference) => reference.imageId ? [reference.imageId] : []))];
  const assetIds = [...new Set(references.flatMap((reference) => reference.assetId ? [reference.assetId] : []))];
  const existing = imageIds.length ? await tx.select({ id: productImages.id, url: productImages.url, altText: productImages.altText }).from(productImages)
    .where(and(eq(productImages.productId, productId), inArray(productImages.id, imageIds))).for("update") : [];
  if (existing.length !== imageIds.length) throw new ProductGalleryError("Some product images changed or no longer exist. Reload the editor before saving.");
  const uploaded = assetIds.length ? await tx.select({ id: mediaAssets.id, originalFilename: mediaAssets.originalFilename }).from(mediaAssets)
    .where(inArray(mediaAssets.id, assetIds)).for("key share") : [];
  if (uploaded.length !== assetIds.length) throw new ProductGalleryError("Some uploaded images no longer exist. Refresh the library and select again.");
  const imageMap = new Map(existing.map((image) => [image.id, image]));
  const assetMap = new Map(uploaded.map((asset) => [asset.id, asset]));
  const seen = new Set<string>();
  const gallery: { url: string; altText: string | null; position: number }[] = [];
  for (const reference of references) {
    const image = reference.imageId ? imageMap.get(reference.imageId)! : null;
    const asset = reference.assetId ? assetMap.get(reference.assetId)! : null;
    const url = image ? image.url : mediaUrl(asset!.id, asset!.originalFilename);
    const identity = galleryIdentity(url);
    if (seen.has(identity)) continue;
    seen.add(identity);
    gallery.push({ url, altText: image ? image.altText : title, position: gallery.length });
  }
  return gallery;
}
