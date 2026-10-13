import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
import ts from "typescript";
import { mediaManagementPlan, validateMediaManagementSql } from "../scripts/media-management-plan.mjs";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
function loadSource(relative, substitutions = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiled = { exports: {} }; cache.set(filename, compiled);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(substitutions, name)) return substitutions[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
        return load(existsSync(base + ".ts") ? base + ".ts" : base + ".tsx");
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", source)(localRequire, compiled, compiled.exports);
    return compiled.exports;
  }
  return load(path.join(root, relative));
}
const authStub = { "@/lib/auth": { auth: {} } };
const { descriptiveMediaUrl, managedMediaId } = loadSource("src/lib/media/shared.ts");
const { parseDescriptiveName, findMediaAssets, renameMediaAsset, deleteMediaAsset } = loadSource("src/lib/media/management.ts", authStub);
const { establishProductMediaAssociations, nameGalleryImages, nameVariantImage } = loadSource("src/lib/media/associations.ts");
const batchA = "11111111-1111-4111-8111-111111111111";
const batchB = "22222222-2222-4222-8222-222222222222";
const assetA = "33333333-3333-4333-8333-333333333333";
const assetB = "44444444-4444-4444-8444-444444444444";
const productA = "55555555-5555-4555-8555-555555555555";
const productB = "66666666-6666-4666-8666-666666666666";
const migrationSql = readFileSync(new URL("../drizzle/0002_media_management.sql", import.meta.url), "utf8");

test("names are bounded, UUID identity survives aliases, and only the configured origin is managed", () => {
  assert.equal(parseDescriptiveName("  Handmade Travel Mug.JPG  "), "Handmade Travel Mug");
  assert.equal(parseDescriptiveName(null), null);
  for (const invalid of ["", "../name", "folder\\name", "bad\0name", "x".repeat(256), 1]) assert.throws(() => parseDescriptiveName(invalid));
  assert.equal(descriptiveMediaUrl(assetA, "Café travel mug", 2), `/media/${assetA}/cafe-travel-mug-2.webp`);
  assert.equal(descriptiveMediaUrl(assetA, "Ceramic Mug 1.5L", 1), `/media/${assetA}/ceramic-mug-1-5l-1.webp`);
  assert(descriptiveMediaUrl(assetA, "x".repeat(255), 500).endsWith("-500.webp"));
  assert.equal(managedMediaId(`/media/${assetA}/old-name.webp`), assetA);
  assert.equal(managedMediaId(`https://shop.invalid/media/${assetA}/old-name.webp`, "https://shop.invalid"), assetA);
  assert.equal(managedMediaId(`https://other.invalid/media/${assetA}/old-name.webp`, "https://shop.invalid"), null);
});

test("management migration has reviewed scope and refuses partial schemas or conflicting history", () => {
  assert.equal(validateMediaManagementSql(migrationSql).length, 11);
  assert.throws(() => validateMediaManagementSql(migrationSql + "\nDROP TABLE products;"));
  const pending = { foundationReady: true, columnCount: 0, indexCount: 0, constraintCount: 0, recorded: false, historyComplete: true, conflictingHistory: false };
  assert.deepEqual(mediaManagementPlan(pending).recordMigration, true);
  assert.equal(mediaManagementPlan({ ...pending, historyComplete: false }).recordMigration, false);
  for (const override of [{ foundationReady: false }, { columnCount: 1 }, { indexCount: 1 }, { constraintCount: 1 }, { recorded: true }, { conflictingHistory: true }]) assert.equal(mediaManagementPlan({ ...pending, ...override }).state, "blocked");
  assert.equal(mediaManagementPlan({ ...pending, columnCount: 5, indexCount: 3, constraintCount: 2 }).state, "ready");
});

test("media naming, search, deletion and migration use real SQL in temporary tables only", { skip: !process.env.DATABASE_URL, timeout: 60000 }, async (t) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const previousOrigin = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "https://catalog.example.invalid";
  await client.connect();
  try {
    const publicCounts = async () => (await client.query("SELECT (SELECT count(*) FROM public.products) AS products,(SELECT count(*) FROM public.product_images) AS images,(SELECT count(*) FROM public.product_variants) AS variants")).rows[0];
    const before = await publicCounts();
    for (const table of ["products", "product_images", "product_variants"]) await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
    // Existing foundation fixtures; never replay 0001 or mutate public tables.
    await client.query("CREATE TEMP TABLE import_batches(id uuid PRIMARY KEY,name varchar(150) NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
    await client.query("CREATE TEMP TABLE media_assets(id uuid PRIMARY KEY,batch_id uuid NOT NULL REFERENCES import_batches(id),original_filename varchar(255) NOT NULL,object_key text NOT NULL UNIQUE,mime_type varchar(50) NOT NULL,size_bytes integer NOT NULL,width integer NOT NULL,height integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now())");
    await client.query("CREATE UNIQUE INDEX media_assets_batch_filename_idx ON media_assets(batch_id,original_filename)");
    await client.query("INSERT INTO import_batches(id,name) VALUES ($1,'Batch A'),($2,'Batch B')", [batchA, batchB]);
    const insertAsset = async (id, batch, filename) => client.query("INSERT INTO media_assets(id,batch_id,original_filename,object_key,mime_type,size_bytes,width,height) VALUES($1,$2,$3,$4,'image/webp',2000,100,100)", [id, batch, filename, `media/${batch}/${id}/image.webp`]);
    await insertAsset(assetA, batchA, "IMG_001.JPG"); await insertAsset(assetB, batchB, "IMG_002.png");
    await client.query("INSERT INTO products(id,title,slug,sku,is_active) VALUES($1,'Café Travel Mug','mug','MUG-001',true),($2,'Brown Bowl','bowl','BOWL-002',false)", [productA, productB]);
    await client.query("INSERT INTO product_images(product_id,url,alt_text,position) VALUES($1,'https://external.invalid/picture.jpg','External alt',3),($1,$2,'Custom mug alt',8),($3,$2,'Bowl alt',9)", [productA, `/media/${assetA}/img-001.webp`, productB]);
    await client.query("INSERT INTO product_variants(product_id,sku,image_url) VALUES($1,'MUG-VARIANT',$2)", [productA, `/media/${assetA}/img-001.webp`]);
    for (const statement of validateMediaManagementSql(migrationSql)) await client.query(statement.replaceAll('"public".', 'pg_temp.'));
    const database = drizzle(client);
    const gallery = async (id) => (await client.query("SELECT url,alt_text,position,media_asset_id FROM product_images WHERE product_id=$1 ORDER BY position,id", [id])).rows;
    const assetRecord = async (id) => (await client.query("SELECT * FROM media_assets WHERE id=$1", [id])).rows[0];
    const original = await assetRecord(assetA);

    await t.test("schema-only deployment preserves legacy URLs and positions; search, display and deletion protection work before saving", async () => {
      assert.deepEqual((await gallery(productA)).map((image) => image.position), [3,8]);
      assert.equal((await gallery(productA))[0].url, "https://external.invalid/picture.jpg");
      assert.equal((await gallery(productA))[1].url, `/media/${assetA}/img-001.webp`);
      assert.equal((await gallery(productA))[1].alt_text, "Custom mug alt");
      assert.equal((await gallery(productA))[1].media_asset_id, null);
      assert.equal((await gallery(productB))[0].url, `/media/${assetA}/img-001.webp`);
      assert.equal((await client.query("SELECT image_url,media_asset_id FROM product_variants")).rows[0].image_url, (await gallery(productA))[1].url);
      assert.equal(original.original_filename, "IMG_001.JPG"); assert.equal(original.object_key, `media/${batchA}/${assetA}/image.webp`);
      const [view] = (await findMediaAssets(database, { q: "MUG-001" })).assets;
      assert.equal(view.id,assetA); assert.equal(view.usageCount,2); assert.equal(view.url,`/media/${assetA}/img-001.webp`);
      await assert.rejects(deleteMediaAsset(database,assetA,async()=>assert.fail("Legacy association must block storage deletion")),(error)=>error.status===409);
      const delivery = loadSource("src/app/media/[id]/[filename]/route.ts", { "@/db":{db:database},"@/lib/media/storage":{getMediaObject:async()=>assert.fail("HEAD does not read storage")} });
      assert.equal((await delivery.HEAD(new Request("https://catalog.example.invalid/media/test",{method:"HEAD"}),{params:Promise.resolve({id:assetA,filename:"img-001.webp"})})).status,200);
    });

    await t.test("association establishment changes only verified reference fields, retaining gallery and variant URLs", async () => {
      const oldGallery = await gallery(productA), oldVariants = (await client.query("SELECT id,image_url FROM product_variants ORDER BY id")).rows;
      await database.transaction((tx)=>establishProductMediaAssociations(tx,productA));
      const visibleFields = (images)=>images.map((image)=>{const copy={...image};delete copy.media_asset_id;return copy;});
      assert.deepEqual(visibleFields(await gallery(productA)),visibleFields(oldGallery));
      assert.equal((await gallery(productA))[1].media_asset_id,assetA);
      assert.deepEqual((await client.query("SELECT id,image_url FROM product_variants ORDER BY id")).rows,oldVariants);
      assert.equal((await client.query("SELECT media_asset_id FROM product_variants")).rows[0].media_asset_id,assetA);
    });

    await t.test("manual rename uses per-product gallery numbering; ordinary title edits never normalize existing URLs", async () => {
      const renamed = await renameMediaAsset(database, assetA, "Ceramic Mug");
      assert.equal(renamed.usageCount, 2); assert.equal(renamed.originalFilename, original.original_filename);
      assert.equal((await gallery(productA))[1].url, descriptiveMediaUrl(assetA, "Ceramic Mug", 2));
      assert.equal((await gallery(productB))[0].url, descriptiveMediaUrl(assetA, "Ceramic Mug", 1));
      await database.transaction((tx) => establishProductMediaAssociations(tx, productA));
      assert.equal((await gallery(productA))[1].url, descriptiveMediaUrl(assetA, "Ceramic Mug", 2));
      await renameMediaAsset(database, assetA, null);
      assert.equal((await gallery(productA))[1].url, descriptiveMediaUrl(assetA, "Café Travel Mug", 2));
      await client.query("UPDATE products SET title='Stainless Mug' WHERE id=$1", [productA]);
      await client.query("UPDATE product_images SET position=CASE WHEN media_asset_id IS NULL THEN 8 ELSE 0 END WHERE product_id=$1", [productA]);
      await database.transaction((tx) => establishProductMediaAssociations(tx, productA));
      assert.equal((await gallery(productA))[0].url, descriptiveMediaUrl(assetA, "Café Travel Mug", 2));
      // Only an explicit naming operation changes the public filename.
      await renameMediaAsset(database,assetA,null);
      assert.equal((await gallery(productA))[0].url, descriptiveMediaUrl(assetA, "Stainless Mug", 1));
      assert.equal((await gallery(productA))[0].alt_text, "Custom mug alt");
      assert.equal((await assetRecord(assetA)).object_key, original.object_key);
      assert.equal((await assetRecord(assetA)).original_filename, original.original_filename);
    });

    await t.test("search covers original names, generated names, manual names, product titles and parent/variant SKUs", async () => {
      for (const query of ["IMG_001", "Stainless Mug", "stainless-mug-1", "MUG-001", "MUG-VARIANT", "Brown Bowl", "BOWL-002"]) assert.equal((await findMediaAssets(database, { q: query })).assets[0]?.id, assetA, query);
      assert.equal((await findMediaAssets(database, { batchId: batchB, q: "IMG_001" })).assets.length, 0);
      await renameMediaAsset(database, assetA, "Handmade Ceramics");
      assert.equal((await findMediaAssets(database, { q: "Handmade Ceramics" })).assets[0].id, assetA);
      for (const query of ["%", "IMG_%", "\\"]) assert.equal((await findMediaAssets(database, { q: query })).assets.length, 0);
      assert.equal((await findMediaAssets(database, { q: "_" })).assets.length, 2); // Both original names literally contain an underscore.
      const { checkCsvImages } = loadSource("src/lib/media/csv-import.ts", authStub);
      assert((await checkCsvImages(database, [{ image_1: "IMG_001.JPG" }], batchA)).preview.ready);
      assert.equal((await checkCsvImages(database, [{ image_1: "Handmade Ceramics" }], batchA)).preview.ready, false);
    });

    await t.test("rename failures roll back the shared name and every associated gallery", async () => {
      const old = await gallery(productA);
      await client.query("ALTER TABLE product_images ADD CONSTRAINT rejected_rename CHECK (url NOT LIKE '%/rollback-name-%') NOT VALID");
      await assert.rejects(renameMediaAsset(database, assetA, "Rollback Name"));
      assert.equal((await assetRecord(assetA)).descriptive_name, "Handmade Ceramics"); assert.deepEqual(await gallery(productA), old);
      await client.query("ALTER TABLE product_images DROP CONSTRAINT rejected_rename");
    });

    await t.test("used images including archived products and variants cannot be deleted", async () => {
      let storageCalls = 0;
      const remove = () => deleteMediaAsset(database, assetA, async () => { storageCalls++; });
      await assert.rejects(client.query("DELETE FROM media_assets WHERE id=$1", [assetA]), (error) => ["23001", "23503"].includes(error.code));
      await assert.rejects(remove(), (error) => error.status === 409);
      await client.query("DELETE FROM product_images WHERE media_asset_id=$1", [assetA]);
      await assert.rejects(remove(), (error) => error.status === 409);
      await client.query("DELETE FROM product_variants WHERE media_asset_id=$1", [assetA]);
      // A legacy same-origin absolute URL is protected before its first resave.
      await client.query("INSERT INTO product_images(product_id,url) VALUES($1,$2)", [productB, `https://CATALOG.example.invalid/media/${assetA.toUpperCase()}/old-name.webp`]);
      await assert.rejects(remove(), (error) => error.status === 409);
      assert.equal((await findMediaAssets(database, { q: "BOWL-002" })).assets[0].id, assetA);
      await client.query("DELETE FROM product_images WHERE product_id=$1", [productB]);
      assert.equal(storageCalls, 0); assert.equal((await assetRecord(assetA)).deleted_at, null);
    });

    await t.test("variant-only associations use descriptive title/SKU URLs and manual names propagate", async () => {
      const named = await database.transaction((tx) => nameVariantImage(tx, `/media/${assetB}/old.webp`, "Stainless Mug", "MUG-SIDE", productA));
      assert.equal(named.imageUrl, `/media/${assetB}/stainless-mug-mug-side.webp`);
      await client.query("INSERT INTO product_variants(product_id,sku,image_url,media_asset_id) VALUES($1,'MUG-SIDE',$2,$3)", [productA,named.imageUrl,assetB]);
      await renameMediaAsset(database, assetB, "Side view");
      assert.equal((await client.query("SELECT image_url FROM product_variants WHERE sku='MUG-SIDE'")).rows[0].image_url, `/media/${assetB}/side-view.webp`);
      await assert.rejects(deleteMediaAsset(database, assetB, async () => assert.fail("Used variant storage must not be deleted")), (error) => error.status === 409);
      await client.query("DELETE FROM product_variants WHERE sku='MUG-SIDE'");
    });

    await t.test("storage failures remain retryable and reject attachments; completed deletion archives original identity", async () => {
      await assert.rejects(deleteMediaAsset(database, assetA, async () => { throw new Error("storage down"); }), (error) => error.status === 503);
      assert((await assetRecord(assetA)).deleted_at); assert.equal((await assetRecord(assetA)).storage_deleted_at, null);
      assert.equal((await findMediaAssets(database, { q: "IMG_001" })).assets[0].deletionPending, true);
      await assert.rejects(database.transaction((tx) => nameGalleryImages(tx, [{ url: `/media/${assetA}/old.webp`, altText: "alt", position: 0 }], "Title")), /missing or being deleted/);
      let storageCalls = 0;
      await deleteMediaAsset(database, assetA, async (key) => { storageCalls++; assert.equal(key, original.object_key); });
      const archived = await assetRecord(assetA);
      assert(archived.storage_deleted_at); assert.equal(archived.original_filename, original.original_filename); assert.equal(archived.object_key, original.object_key);
      assert.equal((await findMediaAssets(database, { q: "IMG_001" })).assets.length, 0);
      await deleteMediaAsset(database, assetA, async () => storageCalls++); assert.equal(storageCalls, 1);
      await insertAsset(randomUUID(), batchA, "IMG_001.JPG"); // Partial uniqueness permits a fresh upload.
      assert.equal((await client.query("SELECT count(*) FROM media_assets WHERE original_filename='IMG_001.JPG'")).rows[0].count, "2");
    });

    await t.test("listing searches the full library, pages in groups of 100 and rejects foreign cursors", async () => {
      for (let index = 0; index < 205; index++) await insertAsset(randomUUID(), batchA, `Page-file-${index}.png`);
      const pages = [], seen = new Set(); let cursor;
      do {
        const page = await findMediaAssets(database, { batchId: batchA, q: "Page-file", beforeId: cursor });
        pages.push(page.assets.length); assert.equal(page.total, 205);
        for (const asset of page.assets) { assert(!seen.has(asset.id)); seen.add(asset.id); }
        cursor = page.nextCursor;
      } while (cursor);
      assert.deepEqual(pages, [100,100,5]);
      await assert.rejects(findMediaAssets(database, { batchId: batchA, beforeId: assetB }), (error) => error.status === 400);
    });

    await t.test("routes enforce admin/origin, retain URL aliases and never serve pending/deleted assets", async () => {
      let session = null, storageReads = 0;
      const substitutions = { "@/db": { db: database }, "@/lib/auth": { auth: { api: { getSession: async () => session } } }, "next/cache": { revalidatePath: () => {} },
        "@/lib/media/storage": { assertStorageConfigured: () => {}, deleteMediaObject: async () => {}, getMediaObject: async () => { storageReads++; return {}; } } };
      const routes = loadSource("src/app/api/admin/media/assets/[id]/route.ts", substitutions);
      const ctx = { params: Promise.resolve({ id: assetB }) };
      const request = (method, body, origin = process.env.BETTER_AUTH_URL) => new Request(`${process.env.BETTER_AUTH_URL}/api/admin/media/assets/${assetB}`, { method, headers: { origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const unauthorized of [null, { user: { role: "user" } }]) {
        session = unauthorized;
        assert([401,403].includes((await routes.PATCH(request("PATCH", { descriptiveName: "Name" }), ctx)).status));
        assert([401,403].includes((await routes.DELETE(request("DELETE"), ctx)).status));
      }
      session = { user: { role: "admin" } };
      assert.equal((await routes.PATCH(request("PATCH", { descriptiveName: "Name" }, "https://evil.invalid"), ctx)).status, 403);
      assert.equal((await routes.DELETE(request("DELETE", undefined, "https://evil.invalid"), ctx)).status, 403);
      assert.equal((await routes.PATCH(request("PATCH", { descriptiveName: "../name" }), ctx)).status, 400);
      assert.equal((await routes.PATCH(request("PATCH", { descriptiveName: "Unassigned Bowl" }), ctx)).status, 200);
      const delivery = loadSource("src/app/media/[id]/[filename]/route.ts", substitutions);
      const context = (id, filename) => ({ params: Promise.resolve({ id, filename }) });
      const head = new Request(`${process.env.BETTER_AUTH_URL}/media/test`, { method: "HEAD" });
      for (const filename of ["img-002.webp", "unassigned-bowl.webp"]) assert.equal((await delivery.HEAD(head, context(assetB, filename))).status, 200);
      assert.equal((await delivery.HEAD(head, context(assetA, "img-001.webp"))).status, 404);
      await assert.rejects(deleteMediaAsset(database, assetB, async () => { throw new Error(); }));
      assert.equal((await delivery.HEAD(head, context(assetB, "img-002.webp"))).status, 404);
      assert.equal(storageReads, 0);
    });
    assert.deepEqual(await publicCounts(), before);
  } finally { await client.end(); if (previousOrigin === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = previousOrigin; }
});
