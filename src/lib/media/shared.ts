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
};

// Only the immutable ID determines storage identity. The final URL segment can
// later be generated from the product title without moving the stored object.
export function mediaUrl(id: string, filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "image";
  return `/media/${id}/${stem}.webp`;
}
