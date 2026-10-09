import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });
const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);

// Use real project code and SQL. Auth/cache dependencies alone are substituted.
function loadSource(relative, substitutions = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} };
    cache.set(filename, compiledModule);
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
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
    new Function("require", "module", "exports", compiled)(localRequire, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return load(path.join(root, relative));
}

const { parseAdminProductFilters, adminProductsHref, parseBulkProductRequest } = loadSource("src/lib/admin-product-filters.ts");
const { getAdminProducts, applyBulkProductUpdate } = loadSource("src/lib/admin-products.ts");
const id = (number) => "00000000-0000-4000-8000-" + String(number).padStart(12, "0");
const categoryA = "11111111-1111-4111-8111-111111111111";
const categoryB = "22222222-2222-4222-8222-222222222222";
function bulkForm(ids, operation, categoryId) {
  const data = new FormData();
  ids.forEach((value) => data.append("ids", value));
  data.set("operation", operation);
  if (categoryId !== undefined) data.set("categoryId", categoryId);
  return data;
}

test("normalizes malformed URLs and preserves filters when changing pages", () => {
  for (const page of ["-1", "1.5", "NaN", "Infinity", "9007199254740992"]) {
    assert.equal(parseAdminProductFilters({ page }).page, 1);
  }
  const filters = parseAdminProductFilters({ q: ["  soap & tea  ", "ignored"], status: "active", category: categoryA, stock: "low", sort: "price-desc", page: "2" });
  const url = new URL(adminProductsHref(filters, 3), "http://localhost");
  assert.equal(url.searchParams.get("q"), "soap & tea");
  assert.equal(url.searchParams.get("category"), categoryA);
  assert.equal(url.searchParams.get("status"), "active");
  assert.equal(url.searchParams.get("stock"), "low");
  assert.equal(url.searchParams.get("sort"), "price-desc");
  assert.equal(url.searchParams.get("page"), "3");
  assert.deepEqual(parseAdminProductFilters({ category: "bad", status: "bad", stock: "bad", sort: "bad" }), { q: "", category: "", status: "all", stock: "all", sort: "newest", page: 1 });
});

test("bulk requests enforce a bounded, valid selection and category", () => {
  assert.throws(() => parseBulkProductRequest(bulkForm([], "archive")), /between 1 and 50/);
  assert.throws(() => parseBulkProductRequest(bulkForm(Array.from({ length: 51 }, (_, i) => id(i)), "archive")), /between 1 and 50/);
  assert.throws(() => parseBulkProductRequest(bulkForm(["invalid"], "archive")), /selection is invalid/);
  assert.throws(() => parseBulkProductRequest(bulkForm([id(1)], "delete")), /Choose a bulk action/);
  assert.throws(() => parseBulkProductRequest(bulkForm([id(1)], "category", "")), /Choose the category/);
  assert.deepEqual(parseBulkProductRequest(bulkForm([id(1), id(1)], "category", "none")), { ids: [id(1)], operation: "category", categoryId: null });
});

test("1,000-product catalog: real database pagination, filters, sorting and atomic bulk actions", { skip: !process.env.DATABASE_URL, timeout: 60000 }, async (t) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const originalCount = Number((await client.query("SELECT count(*) AS count FROM public.products")).rows[0].count);
    // Session-local tables shadow the app's tables. Nothing touches real catalog data.
    await client.query("CREATE TEMP TABLE categories (LIKE public.categories INCLUDING DEFAULTS)");
    await client.query("CREATE TEMP TABLE products (LIKE public.products INCLUDING DEFAULTS)");
    await client.query("INSERT INTO categories (id, name, slug) VALUES ($1, 'Home', 'home'), ($2, 'Kitchen', 'kitchen')", [categoryA, categoryB]);
    await client.query(`INSERT INTO products (id,title,slug,sku,brand,category_id,wholesale_price_cents,retail_price_cents,stock_quantity,is_active,created_at,updated_at)
      SELECT ('00000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid, 'Product ' || lpad(g::text,4,'0'), 'product-' || g, 'SKU-' || lpad(g::text,4,'0'),
      CASE WHEN g % 2 = 0 THEN 'Aster' ELSE 'Boreal' END,
      CASE WHEN g % 3 = 0 THEN $1::uuid WHEN g % 3 = 1 THEN $2::uuid ELSE NULL END,
      g*10,g*20,CASE WHEN g % 3 = 0 THEN 0 WHEN g % 3 = 1 THEN 5 ELSE 20 END,g % 4 != 0,
      '2026-01-01'::timestamptz + (g/3) * interval '1 minute',now() FROM generate_series(1,1000) AS g`, [categoryA, categoryB]);
    const database = drizzle(client);
    if (process.env.ADMIN_PRODUCTS_PREVIEW_FILE) writeFileSync(process.env.ADMIN_PRODUCTS_PREVIEW_FILE, JSON.stringify(await getAdminProducts(database, {})));

    await t.test("page preserves filter URLs, redirects excess page numbers and distinguishes empty search results", async () => {
      const { default: Page } = loadSource("src/app/admin/(panel)/products/page.tsx", {
        "@/db": { db: database },
        "@/components/admin/products-table": { ProductsTable: ({ products }) => React.createElement("div", { "data-product-count": products.length }) },
        "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } },
        "next/navigation": { redirect: (href) => { throw new Error("redirect:" + href); } },
      });
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: "Product", stock: "low", status: "active", page: "2" }) }));
      assert.match(html, /data-product-count="50"/);
      assert.match(html, /50 products per page/);
      assert.match(html, /href="\/admin\/products\?q=Product&amp;status=active&amp;stock=low&amp;page=3"/);
      const empty = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: "does-not-exist" }) }));
      assert.match(empty, /No products match these filters/);
      assert.match(empty, /Clear filters/);
      await assert.rejects(Page({ searchParams: Promise.resolve({ page: "999" }) }), /redirect:\/admin\/products\?page=20/);
    });

    await t.test("returns exactly 50 per page across 20 pages, without duplicate or missing products", async () => {
      const seen = new Set();
      for (let page = 1; page <= 20; page++) {
        const result = await getAdminProducts(database, { page: String(page) });
        assert.equal(result.total, 1000);
        assert.equal(result.totalPages, 20);
        assert.equal(result.productList.length, 50);
        for (const product of result.productList) { assert(!seen.has(product.id)); seen.add(product.id); }
      }
      assert.equal(seen.size, 1000);
      const last = await getAdminProducts(database, { page: "999999" });
      assert.equal(last.filters.page, 20);
      assert.equal(last.productList.length, 50);
    });

    await t.test("searches names, primary SKUs and brands; LIKE wildcard characters are literal", async () => {
      assert.equal((await getAdminProducts(database, { q: "product 0015" })).productList[0].id, id(15));
      assert.equal((await getAdminProducts(database, { q: "SKU-0815" })).productList[0].id, id(815));
      assert.equal((await getAdminProducts(database, { q: "aster" })).total, 500);
      await client.query("UPDATE products SET sku = $1 WHERE id = $2", ["SKU_100%", id(1)]);
      await client.query("UPDATE products SET sku = $1 WHERE id = $2", ["SKU\\path", id(2)]);
      for (const q of ["%", "_", "SKU_100%", "\\path"]) assert.equal((await getAdminProducts(database, { q })).total, 1);
      const empty = await getAdminProducts(database, { q: "does-not-exist", page: "20" });
      assert.equal(empty.total, 0); assert.equal(empty.filters.page, 1); assert.deepEqual(empty.productList, []);
    });

    await t.test("combines status/category/stock filters across the whole catalog", async () => {
      assert.equal((await getAdminProducts(database, { status: "active" })).total, 750);
      assert.equal((await getAdminProducts(database, { status: "archived" })).total, 250);
      assert.equal((await getAdminProducts(database, { stock: "out" })).total, 333);
      assert.equal((await getAdminProducts(database, { stock: "low" })).total, 334);
      assert.equal((await getAdminProducts(database, { stock: "in" })).total, 667);
      assert.equal((await getAdminProducts(database, { category: "none" })).total, 333);
      const combined = await getAdminProducts(database, { q: "Boreal", category: categoryB, status: "active", stock: "low", page: "2" });
      const expected = Array.from({ length: 1000 }, (_, i) => i + 1).filter(n => n % 2 === 1 && n % 3 === 1 && n % 4 !== 0);
      assert.equal(combined.total, expected.length);
      assert.equal(combined.productList.length, 50);
      assert(combined.productList.every(row => row.isActive && row.categoryName === "Kitchen" && row.stockQuantity === 5 && row.brand === "Boreal"));
      const last = await getAdminProducts(database, { q: "Boreal", category: categoryB, status: "active", stock: "low", page: "4" });
      assert.equal(last.productList.length, expected.length - 150);
    });

    await t.test("sorts the full result set, with stable tie ordering", async () => {
      const descending = await getAdminProducts(database, { sort: "price-desc" });
      assert.equal(descending.productList[0].wholesalePriceCents, 10000);
      assert.equal(descending.productList[49].wholesalePriceCents, 9510);
      const alphabetical = await getAdminProducts(database, { sort: "name-asc" });
      assert.equal(alphabetical.productList[0].title, "Product 0001");
      const stock = await getAdminProducts(database, { sort: "stock-asc" });
      assert(stock.productList.every(row => row.stockQuantity === 0));
      assert.deepEqual(stock.productList.map(row => row.id), [...stock.productList.map(row => row.id)].sort());
    });

    await t.test("archives, reactivates, assigns and removes categories only for selected products", async () => {
      assert.equal(await applyBulkProductUpdate(database, { ids: [id(1), id(2)], operation: "archive", categoryId: null }), 2);
      assert.equal((await client.query("SELECT count(*) AS count FROM products WHERE is_active = false")).rows[0].count, "252");
      await applyBulkProductUpdate(database, { ids: [id(1), id(2)], operation: "activate", categoryId: null });
      assert.equal((await client.query("SELECT count(*) AS count FROM products WHERE is_active = false")).rows[0].count, "250");
      await applyBulkProductUpdate(database, { ids: [id(1), id(2)], operation: "category", categoryId: categoryA });
      assert((await client.query("SELECT category_id FROM products WHERE id = ANY($1::uuid[])", [[id(1), id(2)]])).rows.every(row => row.category_id === categoryA));
      await applyBulkProductUpdate(database, { ids: [id(1), id(2)], operation: "category", categoryId: null });
      assert((await client.query("SELECT category_id FROM products WHERE id = ANY($1::uuid[])", [[id(1), id(2)]])).rows.every(row => row.category_id === null));
      await assert.rejects(applyBulkProductUpdate(database, { ids: [id(1), id(9999)], operation: "archive", categoryId: null }), /no longer exist/);
      assert.equal((await client.query("SELECT is_active FROM products WHERE id = $1", [id(1)])).rows[0].is_active, true);
      await assert.rejects(applyBulkProductUpdate(database, { ids: [id(1)], operation: "category", categoryId: id(9999) }), /category no longer exists/);
      assert.equal((await client.query("SELECT category_id FROM products WHERE id = $1", [id(1)])).rows[0].category_id, null);
    });

    await t.test("server action enforces admin authorization, validates selection and invalidates affected pages", async () => {
      let session = null;
      const invalidated = [];
      const { bulkUpdateProducts } = loadSource("src/app/admin/(panel)/products/actions.ts", {
        "@/db": { db: database }, "@/lib/auth": { auth: { api: { getSession: async () => session } } },
        "next/headers": { headers: async () => new Headers() }, "next/cache": { revalidatePath: (...args) => invalidated.push(args) }, "next/navigation": { redirect: () => {} },
      });
      const previous = { success: false, message: "" };
      assert.equal((await bulkUpdateProducts(previous, bulkForm([id(1)], "archive"))).success, false);
      session = { user: { role: "user" } };
      assert.equal((await bulkUpdateProducts(previous, bulkForm([id(1)], "archive"))).success, false);
      assert.equal((await client.query("SELECT is_active FROM products WHERE id = $1", [id(1)])).rows[0].is_active, true);
      session = { user: { role: "admin" } };
      assert.equal((await bulkUpdateProducts(previous, bulkForm(["invalid"], "archive"))).success, false);
      const result = await bulkUpdateProducts(previous, bulkForm([id(1)], "archive"));
      assert.equal(result.success, true); assert.match(result.message, /1 product archived/);
      assert(invalidated.some(([route]) => route === "/admin/products"));
      assert(invalidated.some(([route]) => route === "/products/[slug]"));
      assert.equal(Number((await client.query("SELECT count(*) AS count FROM public.products")).rows[0].count), originalCount);
    });
  } finally { await client.end(); }
});
