import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { importBatches, mediaAssets } from "@/db/schema";
import { validateOriginalFilename } from "./image";
import { mediaUrl, UUID_PATTERN } from "./shared";
import { collectCsvImageReferences, type CsvImageAsset, type CsvImageRow, type CsvImportPreview } from "./csv-images";

export async function checkCsvImages(database: Pick<NodePgDatabase, "select">, rows: CsvImageRow[], batchId: string) {
  const references = collectCsvImageReferences(rows);
  const assets = new Map<string, CsvImageAsset>();
  const errors: string[] = [];
  const preview: CsvImportPreview = { ready: false, productCount: 0, imageReferences: references.length, matchedImages: 0, samples: [], truncated: references.length > 50 };
  const validNames = new Set<string>();
  for (const reference of references) {
    try { validateOriginalFilename(reference.filename); validNames.add(reference.filename); }
    catch { errors.push(`Row ${reference.row}, ${reference.column}: "${reference.filename}" must be an uploaded JPG, PNG or WebP filename, not a URL or path.`); }
  }
  if (references.length) {
    if (!UUID_PATTERN.test(batchId)) errors.push("Select an image batch to match image_1–image_5 filenames.");
    else {
      const [batch] = await database.select({ id: importBatches.id }).from(importBatches).where(eq(importBatches.id, batchId)).limit(1);
      if (!batch) errors.push("That image batch no longer exists. Select another batch and check the CSV again.");
      else {
        const names = [...validNames];
        for (let offset = 0; offset < names.length; offset += 500) {
          const matches = await database.select({ id: mediaAssets.id, originalFilename: mediaAssets.originalFilename }).from(mediaAssets)
            .where(and(eq(mediaAssets.batchId, batchId), inArray(mediaAssets.originalFilename, names.slice(offset, offset + 500))));
          for (const asset of matches) assets.set(asset.originalFilename, asset);
        }
        for (const reference of references) {
          if (validNames.has(reference.filename) && !assets.has(reference.filename)) {
            errors.push(`Row ${reference.row}, ${reference.column}: "${reference.filename}" was not found in the selected batch. Filenames are case-sensitive.`);
          }
        }
      }
    }
  }
  preview.matchedImages = references.filter((reference) => assets.has(reference.filename)).length;
  preview.samples = references.slice(0, 50).map((reference) => ({ ...reference, url: assets.has(reference.filename) ? mediaUrl(assets.get(reference.filename)!.id, reference.filename) : null }));
  preview.ready = errors.length === 0;
  return { assets, preview, errors };
}
