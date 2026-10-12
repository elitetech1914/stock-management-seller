import { mediaUrl } from "./shared";

export const CSV_IMAGE_COLUMNS = ["image_1", "image_2", "image_3", "image_4", "image_5"] as const;

export type CsvImageRow = Partial<Record<typeof CSV_IMAGE_COLUMNS[number], string>> & {
  sku?: string;
  product_image_url?: string;
  image_position?: string;
  image_alt_text?: string;
};

export type CsvImageReference = { row: number; sku: string; column: string; filename: string };
export type CsvImageMatch = CsvImageReference & { url: string | null };
export type CsvImageAsset = { id: string; originalFilename: string };
export type CsvImportPreview = {
  ready: boolean;
  productCount: number;
  imageReferences: number;
  matchedImages: number;
  samples: CsvImageMatch[];
  truncated: boolean;
};

export function collectCsvImageReferences(rows: CsvImageRow[]): CsvImageReference[] {
  return rows.flatMap((row, index) => CSV_IMAGE_COLUMNS.flatMap((column) => {
    const filename = row[column]?.trim();
    return filename ? [{ row: index + 2, sku: row.sku?.trim() || "—", column, filename }] : [];
  }));
}

export function getCsvProductImages(rows: CsvImageRow[], assets: Map<string, CsvImageAsset>) {
  const images = new Map<string, { url: string; position: number; altText: string | null }>();
  // Numbered filenames define gallery order, independent of CSV row order.
  for (const [position, column] of CSV_IMAGE_COLUMNS.entries()) {
    for (const row of rows) {
      const filename = row[column]?.trim();
      if (!filename) continue;
      const asset = assets.get(filename);
      if (!asset) throw new Error("An image reference was not checked before import.");
      const url = mediaUrl(asset.id, asset.originalFilename);
      if (!images.has(url)) images.set(url, { url, position, altText: row.image_alt_text?.trim() || null });
    }
  }
  const hasFilenames = images.size > 0;
  for (const row of rows) {
    const url = row.product_image_url?.trim();
    if (!url || images.has(url)) continue;
    const suppliedPosition = Number((row.image_position ?? "").replace(/,/g, "").trim());
    const position = hasFilenames ? CSV_IMAGE_COLUMNS.length + images.size
      : row.image_position?.trim() && Number.isFinite(suppliedPosition) ? Math.max(0, Math.trunc(suppliedPosition)) : images.size;
    images.set(url, { url, position, altText: row.image_alt_text?.trim() || null });
  }
  return [...images.values()].sort((a, b) => a.position - b.position);
}
