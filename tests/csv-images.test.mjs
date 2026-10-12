import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
import ts from "typescript";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);

function loadSource(relative, substitutions = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} }; cache.set(filename, compiledModule);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(substitutions, name)) return substitutions[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
        return load(existsSync(base + ".ts") ? base + ".ts" : base + ".tsx");
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", source)(localRequire, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return load(path.join(root, relative));
}

const { getCsvProductImages, collectCsvImageReferences } = loadSource("src/lib/media/csv-images.ts");
const { checkCsvImages } = loadSource("src/lib/media/csv-import.ts");
const batchA = "11111111-1111-4111-8111-111111111111";
const batchB = "22222222-2222-4222-8222-222222222222";
const assetA = "33333333-3333-4333-8333-333333333333";
const assetB = "44444444-4444-4444-8444-444444444444";

test("numbered filenames order and deduplicate gallery images while retaining URL positions and alt text", () => {
  const assets = new Map([["front.JPG", { id: assetA, originalFilename: "front.JPG" }], ["back.png", { id: assetB, originalFilename: "back.png" }]]);
  const rows = [{ sku: "MUG", image_2: "back.png", product_image_url: "https://example.invalid/third.jpg", image_position: "0", image_alt_text: "Back" }, { image_1: "front.JPG" }, { image_5: "front.JPG" }];
  const gallery = getCsvProductImages(rows, assets);
  assert.equal(gallery.length, 3); assert(gallery[0].url.includes(assetA)); assert(gallery[1].url.includes(assetB));
  assert.equal(gallery[1].altText, "Back"); assert.equal(gallery[2].url, rows[0].product_image_url);
  assert.deepEqual(collectCsvImageReferences(rows).map((reference) => reference.row), [2, 3, 4]);
  const urls = getCsvProductImages([{ product_image_url: "url-2", image_position: "2" }, { product_image_url: "url-1", image_position: "1", image_alt_text: "Front" }], new Map());
  assert.deepEqual(urls.map((image) => image.url), ["url-1", "url-2"]); assert.equal(urls[0].altText, "Front");
  assert.throws(() => getCsvProductImages([{ image_1: "missing.jpg" }], new Map()), /not checked/);
});

test("URL-only checks need no media tables or storage configuration", async () => {
  const database = { select: () => assert.fail("URL-only imports must not access media tables") };
  const result = await checkCsvImages(database, [{ product_image_url: "https://example.invalid/image.jpg" }], "");
  assert.equal(result.preview.ready, true); assert.equal(result.preview.imageReferences, 0);
});

test("CSV import preview and image association use real SQL in isolated temporary tables", { skip: !process.env.DATABASE_URL, timeout: 60000 }, async (t) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const publicCounts = async () => (await client.query("SELECT (SELECT count(*) FROM public.products) AS products, (SELECT count(*) FROM public.product_images) AS images, (SELECT count(*) FROM public.product_variants) AS variants")).rows[0];
    const before = await publicCounts();
    for (const table of ["categories", "products", "product_images", "product_variants"]) await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
    await client.query("CREATE TEMP TABLE import_batches (id uuid PRIMARY KEY, name varchar(150) NOT NULL, created_at timestamptz DEFAULT now() NOT NULL)");
    await client.query("CREATE TEMP TABLE media_assets (id uuid PRIMARY KEY, batch_id uuid NOT NULL REFERENCES import_batches(id), original_filename varchar(255) NOT NULL, UNIQUE(batch_id,original_filename))");
    await client.query("INSERT INTO import_batches(id,name) VALUES ($1,'Supplier A'),($2,'Supplier B')", [batchA, batchB]);
    await client.query("INSERT INTO media_assets(id,batch_id,original_filename) VALUES ($1,$2,'front.JPG'),($3,$2,'back.png'),('55555555-5555-4555-8555-555555555555',$4,'front.JPG'),('66666666-6666-4666-8666-666666666666',$2,'Tasse-é.png')", [assetA, batchA, assetB, batchB]);
    const database = drizzle(client);
    let session = { user: { role: "admin" } };
    const invalidated = [];
    const { importProducts } = loadSource("src/app/admin/(panel)/import/actions.ts", {
      "@/db": { db: database },
      "@/lib/auth": { auth: { api: { getSession: async () => session } } },
      "next/headers": { headers: async () => new Headers() },
      "next/cache": { revalidatePath: (...args) => invalidated.push(args) },
    });
    const { initialImportState } = loadSource("src/app/admin/(panel)/import/import-state.ts");
    const form = (csv, mode = "preview", batchId = batchA) => {
      const data = new FormData(); data.set("file", new File([csv], "products.csv", { type: "text/csv" })); data.set("mode", mode); data.set("batchId", batchId); return data;
    };
    const counts = async () => (await client.query("SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM categories) AS categories, (SELECT count(*) FROM product_images) AS images, (SELECT count(*) FROM product_variants) AS variants")).rows[0];
    const csv = "sku,title,category,wholesale_price,retail_price,stock,image_1,image_2\nMUG-1,Travel Mug,Kitchen,12.00,24.00,10,front.JPG,back.png";

    await t.test("anonymous/buyer requests cannot preview or import", async () => {
      for (const unauthorized of [null, { user: { role: "user" } }]) {
        session = unauthorized;
        for (const mode of ["preview", "import"]) await assert.rejects(importProducts(initialImportState, form(csv, mode)), /Unauthorized/);
      }
      session = { user: { role: "admin" } };
      assert.equal((await counts()).products, "0");
    });

    await t.test("valid preview matches exact names without modifying products, galleries, categories or variants", async () => {
      const snapshot = await counts(); const result = await importProducts(initialImportState, form(csv));
      assert(result.success); assert.equal(result.preview.productCount, 1); assert.equal(result.preview.imageReferences, 2); assert.equal(result.preview.matchedImages, 2);
      assert.equal(result.preview.samples[0].filename, "front.JPG"); assert.equal(result.preview.samples[0].row, 2);
      assert.deepEqual(await counts(), snapshot); assert.deepEqual(invalidated, []);
    });

    await t.test("missing, case-mismatched, path/URL filenames and absent batches block all writes", async () => {
      const snapshot = await counts();
      for (const [name, batch] of [["missing.jpg", batchA], ["front.jpg", batchA], ["back.png", batchB], ["../front.JPG", batchA], ["https://example.invalid/front.JPG", batchA], ["front.JPG", ""], ["front.JPG", assetA]]) {
        const result = await importProducts(initialImportState, form(`sku,title,category,image_1\nNEW,New product,New category,${name}`, "import", batch));
        assert.equal(result.success, false); assert(result.errors.length); assert.equal(result.preview.ready, false);
        assert.deepEqual(await counts(), snapshot);
      }
      const unicode = await checkCsvImages(database, [{ image_1: "Tasse-é.png" }], batchA); assert(unicode.preview.ready);
      const normalized = await checkCsvImages(database, [{ image_1: "Tasse-e\u0301.png" }], batchA); assert.equal(normalized.preview.ready, false);
    });

    await t.test("import stores primary/gallery order with title alt text and leaves uploaded assets independent", async () => {
      const result = await importProducts(initialImportState, form(csv, "import"));
      assert(result.success); assert.equal(result.created, 1); assert.equal(result.variantsCreated, 1); assert.equal(result.preview, null);
      const images = (await client.query("SELECT url,position,alt_text FROM product_images ORDER BY position")).rows;
      assert.equal(images.length, 2); assert(images[0].url.includes(assetA)); assert(images[1].url.includes(assetB));
      assert.deepEqual(images.map((image) => image.position), [0, 1]); assert(images.every((image) => image.alt_text === "Travel Mug"));
      const product = (await client.query("SELECT wholesale_price_cents,stock_quantity FROM products WHERE sku='MUG-1'")).rows[0];
      assert.equal(product.wholesale_price_cents, 1200); assert.equal(product.stock_quantity, 10);
      assert(invalidated.some(([path, type]) => path === "/products/[slug]" && type === "page"));
    });

    await t.test("repeat imports replace galleries without duplicates; blank images preserve existing galleries", async () => {
      const again = await importProducts(initialImportState, form(csv, "import")); assert.equal(again.updated, 1); assert.equal(again.variantsUpdated, 1);
      assert.equal((await counts()).images, "2");
      const beforeImages = (await client.query("SELECT url,position FROM product_images ORDER BY position")).rows;
      const blank = await importProducts(initialImportState, form("sku,title,image_1,image_2\nMUG-1,Renamed Mug,,", "import", ""));
      assert(blank.success); assert.deepEqual((await client.query("SELECT url,position FROM product_images ORDER BY position")).rows, beforeImages);
    });

    await t.test("Shopify URL headers/continuation rows, positions and variant images retain their behavior", async () => {
      const shopify = 'Handle,Title,Variant SKU,Image Src,Image Position,Image Alt Text,Variant Image\nshopify-mug,Shopify Mug,SHOP-1,https://example.invalid/two.jpg,2,Back,https://example.invalid/variant.jpg\nshopify-mug,,,https://example.invalid/one.jpg,1,Front,';
      const result = await importProducts(initialImportState, form(shopify, "import", "")); assert(result.success);
      const images = (await client.query("SELECT pi.url,pi.position,pi.alt_text FROM product_images pi JOIN products p ON p.id=pi.product_id WHERE p.sku='SHOP-1' ORDER BY position")).rows;
      assert.deepEqual(images.map((image) => image.url), ["https://example.invalid/one.jpg", "https://example.invalid/two.jpg"]);
      assert.deepEqual(images.map((image) => image.alt_text), ["Front", "Back"]);
      assert.equal((await client.query("SELECT image_url FROM product_variants WHERE sku='SHOP-1'")).rows[0].image_url, "https://example.invalid/variant.jpg");
      for (const alias of ["image_src", "image_url", "product_image_url"]) {
        const preview = await importProducts(initialImportState, form(`product_sku,product_name,${alias}\nSKU-A,Alias product,https://example.invalid/one.jpg`));
        assert(preview.success); assert.equal(preview.preview.productCount, 1);
      }
    });

    await t.test("product identity errors, duplicate alias headers and unsupported numbered columns cannot be ignored", async () => {
      const snapshot = await counts();
      for (const invalid of ["title,image_1\nNo SKU,front.JPG", "sku,title\nNO-TITLE,", "sku,title,image_6\nNEW,New,front.JPG", "sku,title,Image Src,image_url\nNEW,New,a,b"]) {
        const result = await importProducts(initialImportState, form(invalid, "import")); assert.equal(result.success, false); assert.deepEqual(await counts(), snapshot);
      }
    });

    await t.test("an asset removed after preview is rechecked before import and preserves the existing gallery", async () => {
      const valid = await importProducts(initialImportState, form(csv)); assert(valid.success);
      await client.query("DELETE FROM media_assets WHERE id=$1", [assetB]);
      const snapshot = await counts(); const result = await importProducts(valid, form(csv, "import"));
      assert.equal(result.success, false); assert.deepEqual(await counts(), snapshot);
      await client.query("INSERT INTO media_assets(id,batch_id,original_filename) VALUES ($1,$2,'back.png')", [assetB, batchA]);
    });

    await t.test("a failed gallery replacement rolls back its deletion and preserves old images", async () => {
      const snapshot = (await client.query("SELECT id,url,position FROM product_images ORDER BY id")).rows;
      await client.query("ALTER TABLE product_images ADD CONSTRAINT test_rejected_image CHECK (url <> 'rejected-image')");
      const originalError = console.error;
      let result;
      try {
        console.error = () => {};
        result = await importProducts(initialImportState, form("sku,title,product_image_url\nMUG-1,Gallery failure,rejected-image", "import", ""));
      } finally { console.error = originalError; }
      assert.equal(result.success, false); assert.equal(result.failed, 1);
      assert.deepEqual((await client.query("SELECT id,url,position FROM product_images ORDER BY id")).rows, snapshot);
      await client.query("ALTER TABLE product_images DROP CONSTRAINT test_rejected_image");
    });

    await t.test("large lookup lists use bounded queries and preview samples while checking every reference", async () => {
      await client.query("INSERT INTO media_assets(id,batch_id,original_filename) SELECT ('00000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid,$1,'bulk-' || g || '.jpg' FROM generate_series(1,1200) AS g", [batchA]);
      const result = await checkCsvImages(database, Array.from({ length: 1200 }, (_, index) => ({ image_1: `bulk-${index + 1}.jpg` })), batchA);
      assert(result.preview.ready); assert.equal(result.preview.matchedImages, 1200); assert.equal(result.preview.samples.length, 50); assert(result.preview.truncated);
      const otherBatch = await checkCsvImages(database, [{ image_1: "front.JPG" }], batchB);
      assert(otherBatch.preview.ready); assert(!otherBatch.preview.samples[0].url.includes(assetA));
    });
    assert.deepEqual(await publicCounts(), before);
  } finally { await client.end(); }
});
