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
import { renderToStaticMarkup } from "react-dom/server";

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


const { parseProductGallery, appendGalleryAssets, galleryIdentity } = loadSource("src/lib/media/product-gallery.ts");
const { validateUploadFile, sendMediaFile } = loadSource("src/lib/media/upload-client.ts");
const productId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const existingId = "44444444-4444-4444-8444-444444444444";
const otherImageId = "55555555-5555-4555-8555-555555555555";
const batchId = "66666666-6666-4666-8666-666666666666";

test("gallery payload accepts IDs only, bounds selection and recognizes immutable media identity", () => {
  assert.deepEqual(parseProductGallery(JSON.stringify([{ imageId: existingId.toUpperCase() }, { assetId }])), [{ imageId: existingId }, { assetId }]);
  assert.deepEqual(parseProductGallery("[]"), []);
  for (const value of [null, "not-json", "{}", JSON.stringify([{ url: "/arbitrary" }]), JSON.stringify([{ imageId: existingId, assetId }]), JSON.stringify([{ assetId: "invalid" }]), JSON.stringify(Array.from({ length: 501 }, () => ({ assetId })))]) assert.throws(() => parseProductGallery(value));
  const current = [{ reference: { imageId: existingId }, url: "/media/" + assetId + "/old-name.webp", altText: "Existing alt" }];
  const appended = appendGalleryAssets(current, [{ id: assetId, url: "/media/" + assetId + "/new-name.webp" }, { id: otherId, url: "/media/" + otherId + "/other.webp" }]);
  assert.equal(appended.length, 2); assert.equal(appended[0].altText, "Existing alt"); assert.equal(appended[1].reference.assetId, otherId);
  assert.notEqual(galleryIdentity("https://example.invalid/media/" + assetId + "/image.webp"), galleryIdentity(current[0].url));
  const legacy = [{ ...current[0], url: `https://shop.invalid/media/${assetId}/original.webp`, mediaAssetId: assetId }];
  assert.equal(appendGalleryAssets(legacy, [{ id: assetId, url: `/media/${assetId}/renamed.webp` }]).length, 1);
  assert.equal(appendGalleryAssets(current, [{ id: assetId, url: `https://shop.invalid/media/${assetId}/original.webp` }]).length, 1);
});

test("shared upload transport validates files and sends raw bytes with filename, progress and useful failures", async () => {
  assert(validateUploadFile(new File(["x"], "file.gif", { type: "image/gif" })));
  assert(validateUploadFile(new File([], "empty.jpg", { type: "image/jpeg" })));
  assert.equal(validateUploadFile(new File(["bytes"], "Tasse-?.jpg", { type: "image/jpeg" })), undefined);
  const original = globalThis.XMLHttpRequest;
  let xhr;
  globalThis.XMLHttpRequest = class {
    upload = {}; headers = {};
    constructor() { globalThis.__testUploadRequest = this; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    send(file) { this.file = file; }
  };
  try {
    const file = new File(["bytes"], "Tasse-?.jpg", { type: "image/jpeg" });
    const progress = [];
    const upload = sendMediaFile(batchId, file, (...value) => progress.push(value));
    xhr = globalThis.__testUploadRequest;
    assert.equal(xhr.method, "POST"); assert.equal(xhr.url, "/api/admin/media/upload?batchId=" + batchId); assert.equal(xhr.file, file);
    assert.equal(xhr.headers["X-File-Name"], encodeURIComponent(file.name)); assert.equal(xhr.headers["Content-Type"], "image/jpeg");
    xhr.upload.onprogress({ lengthComputable: true, loaded: 5, total: 5 });
    assert.deepEqual(progress, [[99, true]]);
    xhr.status = 201; xhr.responseText = JSON.stringify({ asset: { id: assetId } }); xhr.onload(); assert.equal((await upload).id, assetId);
    for (const failure of ["network", "timeout", "conflict", "invalid-json"]) {
      const pending = sendMediaFile(batchId, file, () => {});
      xhr = globalThis.__testUploadRequest;
      if (failure === "network") xhr.onerror();
      else if (failure === "timeout") xhr.ontimeout();
      else { xhr.status = 409; xhr.responseText = failure === "invalid-json" ? "bad-json" : JSON.stringify({ error: "Duplicate filename" }); xhr.onload(); }
      await assert.rejects(pending, failure === "network" ? /Network/ : failure === "timeout" ? /timed out/ : failure === "conflict" ? /Duplicate/ : /Unexpected/);
    }
  } finally { globalThis.XMLHttpRequest = original; delete globalThis.__testUploadRequest; }
});

test("product gallery saves validate ownership and roll back all edits on real temporary tables", { skip: !process.env.DATABASE_URL, timeout: 60000 }, async (t) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const publicCounts = async () => (await client.query("SELECT (SELECT count(*) FROM public.products) AS products, (SELECT count(*) FROM public.product_images) AS images")).rows[0];
    const before = await publicCounts();
    for (const table of ["categories", "products", "product_images", "product_variants"]) await client.query("CREATE TEMP TABLE " + table + " (LIKE public." + table + " INCLUDING ALL)");
    for (const table of ["product_images", "product_variants"]) await client.query("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS media_asset_id uuid");
    await client.query("CREATE TEMP TABLE media_assets (id uuid PRIMARY KEY,original_filename varchar(255) NOT NULL,descriptive_name varchar(255),deleted_at timestamptz,storage_deleted_at timestamptz)");
    await client.query("INSERT INTO products(id,title,slug,sku) VALUES ($1,'Original product','original','ORIGINAL'),($2,'Other product','other','OTHER')", [productId, otherId]);
    await client.query("INSERT INTO product_images(id,product_id,url,alt_text,position) VALUES ($1,$2,'https://example.invalid/external.jpg','Keep this custom alt',0),($3,$4,'https://example.invalid/other.jpg','Other alt',0)", [existingId, productId, otherImageId, otherId]);
    await client.query("INSERT INTO media_assets(id,original_filename) VALUES ($1,'front.JPG')", [assetId]);
    const database = drizzle(client);
    let session = { user: { role: "admin" } };
    const invalidated = [];
    const { updateProduct, createProduct } = loadSource("src/app/admin/(panel)/products/actions.ts", {
      "@/db": { db: database }, "@/lib/auth": { auth: { api: { getSession: async () => session } } },
      "next/headers": { headers: async () => new Headers() },
      "next/cache": { revalidatePath: (...args) => invalidated.push(args) },
      "next/navigation": { redirect: (href) => { throw Object.assign(new Error("REDIRECT"), { href }); } },
    });
    const form = (gallery, title = "Updated product", sku = "ORIGINAL") => {
      const data = new FormData();
      for (const [key,value] of Object.entries({ title,sku,brand:"Brand",description:"Description",stockQuantity:"12",wholesalePrice:"12.50",retailPrice:"25",costPrice:"5",minimumOrderQuantity:"2",caseQuantity:"6",isActive:"on",imageGallery:JSON.stringify(gallery) })) data.set(key,value);
      return data;
    };
    const snapshot = async () => (await client.query("SELECT (SELECT json_agg(row_to_json(p) ORDER BY id) FROM products p) AS products, (SELECT json_agg(row_to_json(i) ORDER BY id) FROM product_images i) AS images")).rows[0];
    const save = async (data) => assert.rejects(updateProduct(productId, { error: null }, data), (error) => error.href === "/admin/products");

    await t.test("the real edit page mounts the image editor within one product form and preserves existing image references", async () => {
      const Page = loadSource("src/app/admin/(panel)/products/[id]/edit/page.tsx", {
        "@/db": { db: database },
        "../../actions": { updateProduct },
        "next/link": { __esModule: true, default: () => null },
        "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
      }).default;
      const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: productId }) }));
      assert.equal((html.match(/<form\b/g) ?? []).length, 1);
      assert(html.includes("Choose from library") && html.includes("Upload from computer") && html.includes("Save changes"));
      assert(html.includes(existingId) && html.includes("Keep this custom alt"));
      assert(!html.includes('name="imageUrls"'));
    });

    await t.test("authentication failures, forged/foreign references and malformed galleries never change product data", async () => {
      const original = await snapshot();
      for (const unauthorized of [null, { user: { role: "user" } }]) {
        session = unauthorized; assert((await updateProduct(productId,{ error:null },form([{ imageId:existingId }]))).error);
      }
      session = { user: { role: "admin" } };
      for (const references of [[{ imageId:otherImageId }],[{ imageId:otherId }],[{ assetId:otherId }],[{ url:"/media/arbitrary" }]]) {
        assert((await updateProduct(productId,{ error:null },form(references))).error); assert.deepEqual(await snapshot(), original);
      }
      const missing = form([]); missing.delete("imageGallery"); assert((await updateProduct(productId,{error:null},missing)).error);
      assert((await updateProduct(otherImageId,{error:null},form([]))).error);
      assert.deepEqual(await snapshot(), original); assert.deepEqual(invalidated, []);
    });

    await t.test("an unrelated product edit retains external image URLs and existing alt text", async () => {
      await save(form([{ imageId:existingId }]));
      const images = (await client.query("SELECT url,alt_text,position FROM product_images WHERE product_id=$1 ORDER BY position",[productId])).rows;
      assert.deepEqual(images,[{url:"https://example.invalid/external.jpg",alt_text:"Keep this custom alt",position:0}]);
      const product = (await client.query("SELECT title,brand,stock_quantity,wholesale_price_cents FROM products WHERE id=$1",[productId])).rows[0];
      assert.equal(product.title,"Updated product"); assert.equal(product.stock_quantity,12); assert.equal(product.wholesale_price_cents,1250);
    });

    await t.test("library references append or become primary in the submitted order, with title defaults and deduplication", async () => {
      const [external] = (await client.query("SELECT id FROM product_images WHERE product_id=$1",[productId])).rows;
      await save(form([{assetId},{imageId:external.id},{assetId}],"Gallery product"));
      const images = (await client.query("SELECT id,url,alt_text,position FROM product_images WHERE product_id=$1 ORDER BY position",[productId])).rows;
      assert.equal(images.length,2); assert(images[0].url.includes(assetId)); assert.equal(images[0].alt_text,"Gallery product");
      assert.equal(images[1].url,"https://example.invalid/external.jpg"); assert.equal(images[1].alt_text,"Keep this custom alt"); assert.deepEqual(images.map(i=>i.position),[0,1]);
      await save(form([{imageId:images[0].id},{assetId},{imageId:images[1].id}]));
      assert.equal((await client.query("SELECT count(*) AS count FROM product_images WHERE product_id=$1",[productId])).rows[0].count,"2");
      assert(invalidated.some(([path,type])=>path==="/products/[slug]"&&type==="page")); assert(invalidated.some(([path,type])=>path==="/categories/[slug]"&&type==="page"));
    });

    await t.test("legacy absolute same-origin images cannot be added a second time from the library", async () => {
      const origin = process.env.BETTER_AUTH_URL;
      process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
      try {
        const images = (await client.query("SELECT id,url FROM product_images WHERE product_id=$1 ORDER BY position",[productId])).rows;
        await client.query("UPDATE product_images SET url=$1,media_asset_id=NULL WHERE id=$2",[`${new URL(process.env.BETTER_AUTH_URL).origin}/media/${assetId}/original.webp`, images[0].id]);
        await save(form([{imageId:images[0].id},{assetId},{imageId:images[1].id}]));
        assert.equal((await client.query("SELECT count(*) FROM product_images WHERE product_id=$1",[productId])).rows[0].count,"2");
      } finally { if (origin === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = origin; }
    });

    await t.test("missing assets after selection and database write failures preserve all product fields and gallery rows", async () => {
      const original = await snapshot();
      const removed = await updateProduct(productId,{error:null},form([{assetId:otherId}],"Must not save")); assert(removed.error); assert.deepEqual(await snapshot(),original);
      const references = (await client.query("SELECT id FROM product_images WHERE product_id=$1 ORDER BY position",[productId])).rows.map(image=>({imageId:image.id}));
      await client.query("ALTER TABLE product_images ADD CONSTRAINT fail_gallery_test CHECK (url <> 'https://example.invalid/external.jpg') NOT VALID");
      const failed = await updateProduct(productId,{error:null},form([...references].reverse(),"Rollback title")); assert(failed.error); assert.deepEqual(await snapshot(),original);
      await client.query("ALTER TABLE product_images DROP CONSTRAINT fail_gallery_test");
      const duplicateSku = await updateProduct(productId,{error:null},form(references,"Bad SKU","OTHER")); assert(duplicateSku.error); assert.deepEqual(await snapshot(),original);
    });

    await t.test("removal, including clearing the gallery, detaches images without deleting uploaded assets", async () => {
      const [external] = (await client.query("SELECT id FROM product_images WHERE product_id=$1 AND url LIKE 'https%'",[productId])).rows;
      await save(form([{imageId:external.id}]));
      assert.equal((await client.query("SELECT count(*) AS count FROM product_images WHERE product_id=$1",[productId])).rows[0].count,"1");
      await save(form([])); assert.equal((await client.query("SELECT count(*) AS count FROM product_images WHERE product_id=$1",[productId])).rows[0].count,"0");
      assert.equal((await client.query("SELECT count(*) AS count FROM media_assets WHERE id=$1",[assetId])).rows[0].count,"1");
    });

    await t.test("Add product keeps its existing URL input and names registered images atomically", async () => {
      const data = form([], "Created mug", "CREATED-MUG");
      data.set("imageUrls", `https://example.invalid/front.jpg\n/media/${assetId}/old-name.webp`);
      await assert.rejects(createProduct(data), (error) => error.href === "/admin/products");
      const images = (await client.query("SELECT i.url,i.alt_text,i.position,i.media_asset_id FROM product_images i JOIN products p ON p.id=i.product_id WHERE p.sku='CREATED-MUG' ORDER BY i.position")).rows;
      assert.equal(images[0].url, "https://example.invalid/front.jpg");
      assert.equal(images[1].url, `/media/${assetId}/created-mug-2.webp`); assert.equal(images[1].media_asset_id, assetId);
      assert.equal(images[1].alt_text, "Created mug");
      const bad = form([], "Must roll back", "MISSING-ASSET"); bad.set("imageUrls", `/media/${otherId}/missing.webp`);
      await assert.rejects(createProduct(bad), /missing or being deleted/);
      assert.equal((await client.query("SELECT count(*) FROM products WHERE sku='MISSING-ASSET'")).rows[0].count, "0");
    });

    await t.test("legacy galleries retain row IDs, duplicate images, sparse/tied positions, primary selection and all alt text across ordinary saves", async () => {
      const legacyId = "77777777-7777-4777-8777-777777777777", newAsset = "88888888-8888-4888-8888-888888888888";
      const origin = process.env.BETTER_AUTH_URL;
      process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
      try {
        await client.query("INSERT INTO products(id,title,slug,sku) VALUES($1,'Legacy title','legacy-title','LEGACY-PRESERVE')",[legacyId]);
        await client.query("INSERT INTO product_images(product_id,url,alt_text,position) VALUES($1,'https://external.invalid/old.jpg','External caption',3),($1,$2,NULL,8),($1,$2,'Keep duplicate caption',8),($1,$3,'Absolute caption',17)",[legacyId,`/media/${assetId}/supplier-filename.webp`,`${new URL(process.env.BETTER_AUTH_URL).origin}/media/${assetId}/supplier-filename.webp`]);
        await client.query("INSERT INTO product_variants(product_id,sku,image_url) VALUES($1,'LEGACY-VARIANT',$2)",[legacyId,`/media/${assetId}/variant-original.webp`]);
        const rows = async () => (await client.query("SELECT * FROM product_images WHERE product_id=$1 ORDER BY position,id",[legacyId])).rows;
        const visibleFields = (images) => images.map((image)=>{const copy={...image};delete copy.media_asset_id;return copy;});
        const original = await rows(), originalVariant=(await client.query("SELECT * FROM product_variants WHERE product_id=$1",[legacyId])).rows[0];
        const references=original.map((image)=>({imageId:image.id}));
        const legacySave = async (gallery,title="Changed legacy title")=>assert.rejects(updateProduct(legacyId,{error:null},form(gallery,title,"LEGACY-PRESERVE")),(error)=>error.href==="/admin/products");
        const Page = loadSource("src/app/admin/(panel)/products/[id]/edit/page.tsx",{
          "@/db":{db:database},"../../actions":{updateProduct},"next/link":{__esModule:true,default:()=>null},"next/navigation":{notFound:()=>{throw new Error("NOT_FOUND");}},
        }).default;
        const html=renderToStaticMarkup(await Page({params:Promise.resolve({id:legacyId})}));
        const galleryMarkup=html.split('<ol aria-label="Product gallery"')[1].split('</ol>')[0];
        assert.equal((galleryMarkup.match(/<li\b/g)??[]).length,4); // Duplicate asset rows must remain visible.
        await legacySave(references);
        await legacySave(references,"Second unrelated title change"); // Existing IDs remain valid.
        assert.deepEqual(visibleFields(await rows()),visibleFields(original));
        assert.deepEqual((await rows()).map((image)=>image.media_asset_id),[null,assetId,assetId,assetId]);
        const variant=(await client.query("SELECT * FROM product_variants WHERE product_id=$1",[legacyId])).rows[0];
        assert.equal(variant.image_url,originalVariant.image_url);assert.equal(variant.id,originalVariant.id);assert.equal(variant.media_asset_id,assetId);
        await client.query("INSERT INTO media_assets(id,original_filename) VALUES($1,'New.JPG')",[newAsset]);
        await legacySave([...references,{assetId:newAsset}]);
        const appended=await rows();
        assert.deepEqual(visibleFields(appended.slice(0,4)),visibleFields(original));assert.equal(appended[4].position,18);assert.equal(appended[4].url,`/media/${newAsset}/changed-legacy-title-5.webp`);
        const reordered=[references[2],references[0],references[1],references[3],{imageId:appended[4].id}];
        await legacySave(reordered);
        const moved=await rows();assert.equal(moved[0].id,original[2].id);assert.deepEqual(moved.map((image)=>image.position),[0,1,2,3,4]);
        for(const image of original){const kept=moved.find((row)=>row.id===image.id);assert.equal(kept.url,image.url);assert.equal(kept.alt_text,image.alt_text);assert.equal(+kept.created_at,+image.created_at);}
        await legacySave([reordered[0],reordered[1]]);
        assert.deepEqual((await rows()).map((image)=>image.id),[original[2].id,original[0].id]);
        assert.equal((await client.query("SELECT original_filename FROM media_assets WHERE id=$1",[assetId])).rows[0].original_filename,"front.JPG");
      } finally { if(origin===undefined)delete process.env.BETTER_AUTH_URL;else process.env.BETTER_AUTH_URL=origin; }
    });
    assert.deepEqual(await publicCounts(),before);
  } finally { await client.end(); }
});

