import "server-only";

import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { mediaAssets, productImages, products, productVariants } from "@/db/schema";
import { ProductGalleryError } from "./product-gallery";
import { descriptiveMediaUrl, managedMediaId, mediaNameUrl } from "./shared";

type Database = Pick<NodePgDatabase, "select" | "update">;
export type GalleryInput = { url: string; altText: string | null; position: number; mediaAssetId?: string | null };

export async function lockProductMedia(tx: Pick<NodePgDatabase, "select">, productId: string, additions: (string | null)[] = []) {
  const images = await tx.select({ id: productImages.mediaAssetId, url: productImages.url }).from(productImages).where(eq(productImages.productId, productId));
  const variants = await tx.select({ id: productVariants.mediaAssetId, url: productVariants.imageUrl }).from(productVariants).where(eq(productVariants.productId, productId));
  const ids = [...new Set([...additions, ...images.map((image) => image.id || managedMediaId(image.url, process.env.BETTER_AUTH_URL)), ...variants.map((variant) => variant.id || managedMediaId(variant.url, process.env.BETTER_AUTH_URL))].filter((id): id is string => Boolean(id)))].sort();
  // Include removed gallery assets and retained variant assets before touching
  // attachment rows. Rename locks the asset first, so both operations agree.
  if (ids.length) await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(inArray(mediaAssets.id, ids)).orderBy(asc(mediaAssets.id)).for("key share");
}

export async function nameGalleryImages(tx: Pick<NodePgDatabase, "select">, images: GalleryInput[], title: string) {
  const ids = images.map((image) => image.mediaAssetId || managedMediaId(image.url, process.env.BETTER_AUTH_URL));
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
  const assets = unique.length ? await tx.select({ id: mediaAssets.id, name: mediaAssets.descriptiveName }).from(mediaAssets)
    .where(and(inArray(mediaAssets.id, unique), isNull(mediaAssets.deletedAt))).orderBy(asc(mediaAssets.id)).for("key share") : [];
  if (assets.length !== unique.length) throw new ProductGalleryError("Some images are missing or being deleted. Refresh the library before saving.");
  const names = new Map(assets.map((asset) => [asset.id, asset.name]));
  return images.map((image, index) => ({
    ...image, mediaAssetId: ids[index], position: index,
    url: ids[index] ? descriptiveMediaUrl(ids[index]!, names.get(ids[index]!) || title, index + 1) : image.url,
  }));
}

export async function nameVariantImage(tx: Pick<NodePgDatabase, "select">, url: string | null, title: string, sku: string, productId: string) {
  const id = managedMediaId(url, process.env.BETTER_AUTH_URL);
  if (!id) return { imageUrl: url, mediaAssetId: null };
  const [asset] = await tx.select({ id: mediaAssets.id, name: mediaAssets.descriptiveName }).from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt))).for("key share");
  if (!asset) throw new ProductGalleryError("A variant image is missing or being deleted. Refresh the library before importing.");
  const [gallery] = await tx.select({ url: productImages.url }).from(productImages).where(and(eq(productImages.productId, productId), eq(productImages.mediaAssetId, id))).orderBy(asc(productImages.position), asc(productImages.id)).limit(1);
  return { mediaAssetId: id, imageUrl: gallery?.url || mediaNameUrl(id, asset.name || `${title}-${sku}`) };
}

export async function establishProductMediaAssociations(tx: Database, productId: string) {
  await lockProductMedia(tx, productId);
  const images = await tx.select({ id: productImages.id, url: productImages.url, mediaAssetId: productImages.mediaAssetId }).from(productImages).where(eq(productImages.productId, productId)).for("update");
  const variants = await tx.select({ id: productVariants.id, url: productVariants.imageUrl, mediaAssetId: productVariants.mediaAssetId }).from(productVariants).where(eq(productVariants.productId, productId)).for("update");
  const candidates = [...new Set([...images, ...variants].map((image) => managedMediaId(image.url, process.env.BETTER_AUTH_URL)).filter((id): id is string => Boolean(id)))];
  const active = candidates.length ? await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, candidates), isNull(mediaAssets.deletedAt))) : [];
  const registered = new Set(active.map((asset) => asset.id));
  // Establish only verified NULL references. Never normalize an existing URL,
  // position, alt text or variant image during an ordinary product save.
  for (const image of images) {
    const id = managedMediaId(image.url, process.env.BETTER_AUTH_URL);
    if (!image.mediaAssetId && id && registered.has(id)) await tx.update(productImages).set({ mediaAssetId: id }).where(eq(productImages.id, image.id));
  }
  for (const variant of variants) {
    const id = managedMediaId(variant.url, process.env.BETTER_AUTH_URL);
    if (!variant.mediaAssetId && id && registered.has(id)) await tx.update(productVariants).set({ mediaAssetId: id }).where(eq(productVariants.id, variant.id));
  }
}

export async function assetAssociations(tx: Pick<NodePgDatabase, "select">, ids: string[]) {
  if (!ids.length) return [];
  const origin = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : null;
  const galleryLegacy = ids.flatMap((id) => [ilike(productImages.url, `/media/${id}/%`), ...(origin ? [ilike(productImages.url, `${origin}/media/${id}/%`)] : [])]);
  const variantLegacy = ids.flatMap((id) => [ilike(productVariants.imageUrl, `/media/${id}/%`), ...(origin ? [ilike(productVariants.imageUrl, `${origin}/media/${id}/%`)] : [])]);
  const gallery = await tx.select({ assetId: productImages.mediaAssetId, imageId: productImages.id, productId: products.id, title: products.title, sku: products.sku, position: productImages.position, url: productImages.url }).from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId)).where(or(inArray(productImages.mediaAssetId, ids), and(isNull(productImages.mediaAssetId), or(...galleryLegacy)))).orderBy(asc(products.createdAt), asc(products.id), asc(productImages.position), asc(productImages.id));
  const variants = await tx.select({ assetId: productVariants.mediaAssetId, imageId: productVariants.id, productId: products.id, title: products.title, sku: productVariants.sku, url: productVariants.imageUrl }).from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(or(inArray(productVariants.mediaAssetId, ids), and(isNull(productVariants.mediaAssetId), or(...variantLegacy)))).orderBy(asc(products.createdAt), asc(products.id), asc(productVariants.id));
  return [...gallery.map((entry) => ({ ...entry, assetId: entry.assetId || managedMediaId(entry.url, origin || undefined), kind: "gallery" as const })), ...variants.map((entry) => ({ ...entry, assetId: entry.assetId || managedMediaId(entry.url, origin || undefined), position: null, url: entry.url!, kind: "variant" as const }))].filter((entry) => entry.assetId && ids.includes(entry.assetId));
}
