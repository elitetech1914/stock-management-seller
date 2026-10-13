export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_SELECTION = 500;
export const UPLOAD_CONCURRENCY = 2;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MediaAssetView = {
  id: string;
  originalFilename: string;
  url: string;
  sizeBytes: number;
  width: number;
  height: number;
  descriptiveName?: string | null;
  effectiveName?: string;
  deletionPending?: boolean;
  usageCount?: number;
  associations?: { productId: string; title: string; sku: string; position: number | null; url: string; kind: "gallery" | "variant" }[];
};

// Only the immutable ID determines storage identity. The final URL segment can
// later be generated from the product title without moving the stored object.
export function mediaUrl(id: string, filename: string) {
  return mediaNameUrl(id, filename.replace(/\.[^.]+$/, ""));
}

export function mediaNameUrl(id: string, name: string) {
  const stem = name.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "image";
  return `/media/${id}/${stem}.webp`;
}

export function descriptiveMediaUrl(id: string, name: string, galleryNumber: number) {
  // Reserve room for the ordinal so long titles never truncate gallery order.
  const stem = mediaNameUrl(id, name).split("/").pop()!.replace(/\.webp$/, "").slice(0, 94);
  return `/media/${id}/${stem}-${galleryNumber}.webp`;
}

export function managedMediaId(url: string | null | undefined, publicOrigin?: string) {
  if (!url) return null;
  let path = url;
  if (!url.startsWith("/")) {
    if (!publicOrigin) return null;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== new URL(publicOrigin).origin) return null;
      path = parsed.pathname;
    } catch { return null; }
  }
  const id = /^\/media\/([0-9a-f-]{36})\/[a-z0-9][a-z0-9-]{0,119}\.webp(?:[?#].*)?$/i.exec(path)?.[1];
  return id && UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}
