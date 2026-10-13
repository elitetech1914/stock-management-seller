# Product media: uploads, CSV matching and product galleries

**Admin → Bulk Images** manages uploaded assets. **Import products** adds batch selection, CSV filename matching and a read-only CSV check. **Edit product** adds a visual gallery with library selection and computer uploads. All three reuse the existing admin authorization, media infrastructure and product image tables. Storefront card heights are unchanged. Add product retains its existing URL field.

## Available workflow

1. Create an import batch for a supplier delivery.
2. Select or drop up to 500 images into the upload list, then click Upload. Two files upload at a time. Individual progress, processing, success, failure and retry states are shown.
3. Review uploaded images in the batch library. The library and batch selector load in pages of 100.
4. In **Import products**, select this batch, choose a CSV with exact original filenames in `image_1`–`image_5`, and click **Check CSV**. Review matches, then click **Import products**. Alternatively, edit a product, choose a batch and add images from its library, or upload computer files directly from the editor. Click **Save changes** to apply gallery edits.

Original filenames are preserved exactly, including case and Unicode. A database constraint rejects duplicate filenames within a batch rather than permitting ambiguous matches. Another batch can contain the same filename. Uploaded assets are independent of products and survive changes to product titles. Only successfully stored uploads enter `media_assets`; upload failures remain in the current browser list and can be retried.

Uploading alone does not assign images to products. CSV filename matching, preview reports and the edit-product gallery with ordering/primary/removal controls are implemented. Library search, guarded deletion, manual rename and descriptive filenames for new attachments are implemented. Explicit gallery alt-text editing remains a subsequent milestone. Imported/newly attached images use the product title as default alt text; existing gallery alt text is preserved.

## Edit-product gallery

- The URL textarea is replaced with image thumbnails. Existing external URLs remain supported; failed image loading shows a placeholder without removing the image.
- Choose an existing batch, load older batches, or create one in the editor. **Choose from library** lists images in pages of 100 with a bounded scrolling panel. Select images and click **Add selected images**. Assets already attached are marked and cannot be added again.
- **Upload from computer** accepts file selection and drag-and-drop. Click Upload to process two files at a time using the same transport, validation, WebP conversion, progress and retry behavior as Bulk Images. Successful uploads append in original file-selection order, independent of completion order. Up to 500 images can be attached to a product.
- Remove, move earlier/later, or make primary using keyboard-accessible buttons. The first gallery entry is primary. Removing an attachment does not delete the underlying asset or object.
- Queued, active and failed uploads block product saving until uploaded, retried or removed. Batch/library loading failures do not prevent saving a gallery made only of existing product images. After upload timeouts, refresh the library before retrying because the server may have saved the image already.
- Save submits ordered `{imageId}` or `{assetId}` references, never new arbitrary URLs or file bytes. The action verifies admin access and product existence, validates reference IDs, ensures existing images belong to this product, and confirms uploaded assets still exist. It prevents duplicate new attachments and saves fields and gallery changes in one transaction. Existing gallery rows, including duplicate legacy image rows, are retained. Ordinary saves preserve image IDs, URLs, positions, primary selection, alt text and creation time while establishing verified NULL media references. Appends follow the largest retained position; explicit reorder changes positions, and explicit removal deletes only selected attachments. New attachments use the current product title for alt text; existing alt text, including null values, is preserved.
- Inline save failures retain product fields and gallery edits for retry. Success redirects to the product list and refreshes admin/catalog/category/product pages. Discarding the editor leaves the published gallery unchanged; completed uploads remain in their selected batch.
- The visual editor uses the existing media foundation; media management additionally requires the schema-only 0002 migration. Uploads require the existing runtime storage configuration.

## Exact CSV columns and import checks

| Column | Behavior / accepted aliases |
| --- | --- |
| `sku` | Required header; aliases `product_sku`, `variant_sku`, `item_sku`, or Shopify `Variant SKU`. Every product group needs at least one SKU. |
| `title` | Every product group needs a title; aliases `name`, `product_name`, `product_title`. Continuation rows sharing a Shopify handle may omit it. |
| `image_1`–`image_5` | Exact uploaded filenames with extensions, matched only by `(batch_id, original_filename)`. Select the image batch in the form. URLs and paths do not belong in these columns. |
| `product_image_url` | Existing URL support; aliases `image_src`, `image_url`, or Shopify `Image Src`. No batch/media tables required for URL-only files. |
| `image_position` | Existing URL gallery ordering; ignored for numbered filenames. |
| `image_alt_text` | Optional alt text; defaults to the product title. |
| `variant_image_url` | Existing variant image URL; aliases `variant_image` or Shopify `Variant Image`. Filename matching does not apply to this field. |

Headers are case-insensitive and spaces/punctuation normalize to underscores. Original image filenames remain case- and Unicode-sensitive; no fuzzy or cross-batch lookup is used. Duplicate normalized headers and nonempty numbered image columns outside `image_1`–`image_5` are rejected. `/product-images-example.csv` is a downloadable sample; replace the sample filenames with images you uploaded.

**Check CSV** performs no writes. It reports product/image-reference counts and the first 50 image references with matches; every reference is checked even when the preview is abbreviated. Matching queries use groups of up to 500 distinct filenames. Missing images, missing batches, invalid product identities or unsupported numbered columns block the entire import before any product/category/variant changes. Changing the chosen CSV or batch invalidates the UI check. Import checks the actual uploaded CSV and selected batch again rather than trusting a prior preview.

Within each product, numbered images are ordered by `image_1` through `image_5`, skipping empty slots and duplicate URLs. The first supplied image is primary. Existing URL images follow numbered filenames if both are supplied; URL-only files retain their existing `image_position` ordering. Nonempty supplied galleries replace the old gallery in a transaction; no image references leave existing galleries unchanged. Product/category/variant writes retain the existing importer behavior, so runtime failures can still result in a partially completed catalog import, reported in the result. A filename-validation failure causes no catalog writes.

New product attachments generate descriptive URL filenames such as `/media/<asset UUID>/stainless-steel-travel-mug-1.webp`, without moving objects or changing supplier filenames. Gallery order supplies the 1-based suffix, including external images in that order. A shared asset can have a different automatic title-based filename on each product. New variant-only images use the product title and variant SKU; a variant image also in the gallery uses its gallery filename. Existing URLs remain unchanged on ordinary product saves and title changes. Explicit Rename regenerates names using the current gallery order.

## Image names, search and deletion

Bulk Images and the Edit product library share search and image controls. Search the selected batch, or select **Search all batches**, by original filename, descriptive image name, associated product title, parent SKU or variant SKU. Matching covers the full library; pages load 100 images at a time with a stable timestamp/UUID cursor.

**Rename** changes the descriptive base name globally for every product using the asset. Gallery numbering stays specific to each product. **Use automatic name** restores title-based naming. Original uploaded filenames and storage keys never change, so CSV matching still uses the exact original filename, including case and extension. Existing public URL aliases keep working after a rename, title change or reorder. No visual identification or AI image recognition is performed.

**Delete** permanently removes an unreferenced file from object storage. The server blocks deletion while any product gallery or variant uses it, including inactive products and recognized legacy same-origin URLs. Remove all associations and save the products first. A failed storage deletion remains pending and retryable in the library; pending images cannot be attached or served. Completed deletion hides the asset from the library but retains its original filename, UUID and storage key in an archive record. A fresh upload may then reuse the original filename in the same batch. Files already cached in a browser can remain cached until expiry.

Rename and Delete are immediate library operations, separate from **Save changes**. Discarding a product edit does not undo a library rename or deletion. Unsaved product galleries retain their edits and validate asset availability again when saved.

### Media management migration

The schema-only `drizzle/0002_media_management.sql` adds descriptive names, deletion status and nullable media references, with restrictive foreign keys and indexes. It does not backfill references, rewrite URLs, normalize positions, change primary selections or alt text, or access storage.

Production's 0001 foundation is already applied and recorded. Use the [two-stage deployment instructions](media-management-deployment.md): publish the migration-tooling commit first, verify the deployed runtime, take a backup, preview and manually apply only 0002, verify readiness, then publish the feature commit. The command stops when prerequisites or schema/history do not match; it never replays 0001. Do not run migrations during build/start or use general db:migrate/db:push for this rollout.

Relative media URLs and absolute URLs on `BETTER_AUTH_URL` work before explicit references are populated. Search and deletion checks recognize these legacy associations; old public aliases keep working. Ordinary product saves establish verified reference fields without rewriting existing images. Supported legacy URLs need no backfill for display or image management. Unsupported references require a separately reviewed mapping; any future reference-only backfill must preview changes and preserve existing URLs, positions and alt text. No automatic backfill is included.

## Storage, limits and delivery

- Reuses the existing six runtime S3 variables and the existing `default` bucket. `src/lib/media/storage.ts` initializes the SDK lazily and imports `server-only`. No S3 variables are needed for the build, exposed to the client, or stored in media URLs.
- Original filenames never determine object paths. Each optimized object uses `media/<batch UUID>/<asset UUID>/image.webp` with a newly generated UUID. Uploads do not overwrite previous assets.
- JPG/JPEG, PNG and WebP only. The server verifies signatures, decoded format, filename extension and MIME type. Maximum input/output size is 10 MiB, maximum input is 25 megapixels and 16,384 pixels per dimension. Animated WebP and APNG are rejected.
- Sharp auto-orients, preserves aspect ratio, fits within 2400 × 2400 without enlarging smaller images, strips supplier metadata and emits WebP at quality 82. Image processing has a 15-second timeout.
- Request bodies are streamed into a bounded buffer and have a 30-second read timeout; the limit applies even without a reliable Content-Length. At most two upload requests are processed per Node process, before reading their bodies. Extra requests return 429 instead of accumulating in memory. Multiple replicas would each have that limit; coordinate limits before changing the deployment scale.
- Database insert failures trigger cleanup of that request's generated object. If storage cleanup fails, the server logs only the generated object key for an operator to reconcile against `media_assets`. A process crash between object creation and metadata insertion can also leave an orphan; distributed DB/storage writes are not atomic. Do not delete bucket objects without checking references.
- `/media/<asset UUID>/<filename>.webp` serves registered images from Garage through Stockmora, with streaming delivery, ETag/304 support, HEAD support, and immutable one-year browser caching. Only a database-registered asset key is read. Callers cannot specify a bucket, arbitrary storage key or endpoint.
- Uploaded catalog assets are public to anyone possessing their image URL, including before attachment to a product. Use this library for public product imagery. Listing assets, creating batches and uploading all require an authenticated admin on the server. Mutation routes also verify Origin against `BETTER_AUTH_URL`.
- The final URL segment is a descriptive presentation filename; UUIDs determine uniqueness. Existing `imageUrl` fields, storefront galleries and cart URLs accept these same-origin relative URLs. No dedicated media domain is required. Garage's ports and S3 credentials remain private.
- Failed/queued upload lists are browser state and are cleared on reload or batch change. Successfully uploaded images persist in the batch library. A timeout or dropped response might happen after the server saved an image: refresh the library before retrying. A duplicate response cannot replace the stored image.

## Existing migration foundation

`0001_media_upload_foundation` created the independent batch and asset tables. Its SQL, snapshot and recorded history remain unchanged. It is already applied and recorded in production; do not rerun it for the media-management rollout. `0000` and `0001` files are retained for read-only dependency/history validation.

The schema-only 0002 rollout is documented in [media-management-deployment.md](media-management-deployment.md). The command defaults to preview; `--check` returns success only when the reviewed management schema is ready. Schema changes and the 0002 history record are transactional. No production migration, baseline operation, storage deletion, push or deployment has been executed from this workspace.

Fresh dedicated development databases may use the normal initialization workflow; production must use the targeted reviewed rollout. Better Auth initialization remains separate. Never use production as a disposable test database.

## Coolify requirements

Keep the existing Railpack deployment, build `npm run build`, start `npm run start`, bucket, private Docker networking and six runtime S3 variables. Keep `BETTER_AUTH_URL` equal to the application's public origin so cookie authentication and mutation origin checks agree. No new environment variables, public Garage ports, domains or other Coolify services are needed. Install the normal production dependencies including Sharp's platform binaries; do not omit optional dependencies during installation.

Apply schema-only 0002 separately between the two deployment stages before enabling Rename/Delete/Search. Without the media tables, the admin APIs report a specific missing-table error. Opening the tab lists database batches and does not access Garage, so an initial batch-list error should be diagnosed against the database first. Uploading additionally requires the runtime storage configuration. Existing commerce pages continue using their existing tables.

## Local verification

The processing/route checks use the existing TypeScript dependency and Node's built-in test runner. They run real Sharp image decoding with stubbed authentication, database and storage services, so they do not require S3 credentials or a live database.

```sh
npm ci
npm run test:media
npm run test:csv-images
npm run test:product-gallery
npm run test:media-management-migration
npm run test:media-management
npx tsc --noEmit
npm run db:check
npm run lint
npm run build
```

For an interactive upload test, configure the existing authentication/database variables and all six S3 variables in an ignored local `.env`, pointing at a dedicated development database and reachable development Garage service. The production Docker hostname is reachable inside Coolify's network; do not expect it to resolve on a Windows laptop. Use the existing setup for an admin account, then:

```sh
npm run db:media-status
# Only on a fresh dedicated development database:
npm run db:migrate
npm run dev
```

Open `http://localhost:3000/admin/bulk-images` after signing in as an admin. Verify multiple files, a failed file and retry; duplicate names in one batch; identical names in different batches; image persistence after reload; and a copied URL in the existing product editor, product card, gallery and cart. Check that unsigned requests and buyer accounts cannot list/create/upload. After saving product image URLs, verify existing category/product navigation and checkout still work.

CSV tests run the actual importer and Drizzle queries against connection-local temporary commerce/media tables, including alias headers, preview without writes, exact filenames, cross-batch isolation, missing images, reimports, gallery ordering and legacy Shopify URL behavior. They never modify the real catalog. Live authenticated DB/Garage upload verification still requires the above runtime services and migration; isolated tests do not substitute for that deployment check.

Gallery tests additionally cover the real edit page, reference validation/ownership, alt-text preservation, primary/order changes, detachment, and rollback of both fields and gallery rows on a save failure. The shared browser upload transport is tested for filename/raw-file/progress handling and network/timeout/conflict responses. Browser checks use the real editor components with simulated APIs and uploads; real S3 persistence remains a deployment check.

## Files changed

- `src/app/admin/(panel)/bulk-images/page.tsx`, `src/components/admin/bulk-images.tsx`: admin interface and batch library.
- `src/components/admin/sidebar.tsx`: Bulk Images navigation.
- `src/app/api/admin/media/{batches,assets,upload}/route.ts`: server-authorized batch creation/listing, paginated assets and image uploads.
- `src/app/media/[id]/[filename]/route.ts`: public read-only image delivery.
- `src/lib/media/{admin,image,shared,storage,upload}.ts`: authorization, validation/processing, common types/limits, Garage access and bounded uploads.
- `src/db/schema.ts`, `drizzle.config.ts`, `drizzle/0001_media_upload_foundation.sql`, `drizzle/meta/*`: additive media schema/migration.
- `scripts/check-media-migration.mjs`, `scripts/media-migration-plan.mjs`, `scripts/migrate-media.mjs`: read-only migration status/planning and opt-in application of only the media migration.
- `tests/media.test.mjs`, `tests/media-migration.test.mjs`, `package.json`, `package-lock.json`: focused verification and explicit Sharp/server-only dependencies.
- `docs/product-media.md`: rollout and continuation notes.
