import { MAX_UPLOAD_SELECTION, UUID_PATTERN } from "./shared";

export type GalleryReference = { imageId: string; assetId?: never } | { assetId: string; imageId?: never };
export type ProductGalleryItem = { reference: GalleryReference; url: string; altText: string | null; mediaAssetId?: string | null };
export type ProductEditState = { error: string | null };

export class ProductGalleryError extends Error {}

export function parseProductGallery(value: FormDataEntryValue | null): GalleryReference[] {
  if (typeof value !== "string") throw new ProductGalleryError("The product gallery is missing. Reload the editor and try again.");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new ProductGalleryError("The product gallery is invalid. Reload the editor and try again."); }
  if (!Array.isArray(parsed) || parsed.length > MAX_UPLOAD_SELECTION) throw new ProductGalleryError(`Select at most ${MAX_UPLOAD_SELECTION} product images.`);
  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object") throw new ProductGalleryError("The product gallery contains an invalid image.");
    const keys = Object.keys(entry);
    const key = keys[0];
    if (keys.length !== 1 || !["imageId", "assetId"].includes(key) || typeof entry[key] !== "string" || !UUID_PATTERN.test(entry[key])) throw new ProductGalleryError("The product gallery contains an invalid image.");
    return key === "imageId" ? { imageId: entry[key].toLowerCase() } : { assetId: entry[key].toLowerCase() };
  });
}

export function galleryIdentity(url: string) {
  const id = /^\/media\/([0-9a-f-]{36})\//i.exec(url)?.[1];
  return id && UUID_PATTERN.test(id) ? `asset:${id.toLowerCase()}` : `url:${url}`;
}

export function galleryItemIdentity(item: ProductGalleryItem) {
  const id = item.reference.assetId || item.mediaAssetId;
  return id ? `asset:${id.toLowerCase()}` : galleryIdentity(item.url);
}

export function appendGalleryAssets(current: ProductGalleryItem[], assets: { id: string; url: string }[]) {
  const seen = new Set(current.map(galleryItemIdentity));
  const next = [...current];
  for (const asset of assets) {
    const identity = `asset:${asset.id.toLowerCase()}`;
    if (!seen.has(identity) && next.length < MAX_UPLOAD_SELECTION) {
      seen.add(identity); next.push({ reference: { assetId: asset.id }, url: asset.url, altText: null });
    }
  }
  return next;
}
