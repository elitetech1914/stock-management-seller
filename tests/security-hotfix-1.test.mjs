
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import { loadSource } from "./auth-source.mjs";

const policy = loadSource("src/lib/auth-policy.ts");
const categoryId = "11111111-1111-4111-8111-111111111111";
const dialect = new PgDialect();

function categoryFixture(session, writeError) {
  const events = [], invalidations = [], writes = [];
  const requestHeaders = new Headers({ cookie: "fixture-only" });
  const database = {
    insert() {
      events.push("insert");
      return { async values(value) { if (writeError) throw writeError; writes.push({ create: value }); } };
    },
    delete() {
      events.push("delete");
      return { async where(condition) { if (writeError) throw writeError; writes.push({ delete: dialect.sqlToQuery(condition).params }); } };
    },
  };
  const actions = loadSource("src/app/admin/(panel)/categories/actions.ts", {
    "next/headers": { headers: async () => requestHeaders },
    "next/cache": { revalidatePath: value => invalidations.push(value) },
    "@/db": { db: database },
    "@/lib/auth": { auth: { api: { getSession: async ({ headers }) => {
      events.push("authorize");
      assert.equal(headers, requestHeaders);
      if (session instanceof Error) throw session;
      return session;
    } } } },
  });
  return { actions, events, writes, invalidations };
}

function categoryForm(name = "  Home & Kitchen  ", id = categoryId) {
  const form = new FormData();
  form.set("name", name); form.set("id", id);
  return form;
}

test("F1: actual category actions reject unauthorized callers before form access, database access and early returns", async () => {
  for (const session of [null, {}, { user: {} }, { user: { role: "user" } }, { user: { role: "admin,user" } }]) {
    for (const name of ["createCategory", "deleteCategory"]) {
      for (const form of [categoryForm(), new FormData(), { get() { throw Error("form read before authorization"); } }]) {
        const fixture = categoryFixture(session);
        await assert.rejects(fixture.actions[name](form), /Unauthorized/);
        assert.deepEqual(fixture.events, ["authorize"]);
        assert.deepEqual(fixture.writes, []);
        assert.deepEqual(fixture.invalidations, []);
      }
    }
  }
});

test("F1: administrator actions preserve creation, deletion, validation and empty-ID behavior", async () => {
  const fixture = categoryFixture({ user: { role: "admin" } });
  await fixture.actions.createCategory(categoryForm());
  assert.deepEqual(fixture.events, ["authorize", "insert"]);
  assert.deepEqual(fixture.writes, [{ create: { name: "Home & Kitchen", slug: "home-kitchen" } }]);
  assert.deepEqual(fixture.invalidations, ["/admin/categories"]);
  await fixture.actions.deleteCategory(categoryForm());
  assert.deepEqual(fixture.events, ["authorize", "insert", "authorize", "delete"]);
  assert.deepEqual(fixture.writes[1], { delete: [categoryId] });
  assert.deepEqual(fixture.invalidations, ["/admin/categories", "/admin/categories"]);
  const empty = categoryFixture({ user: { role: "admin" } });
  await empty.actions.deleteCategory(new FormData());
  await assert.rejects(empty.actions.createCategory(categoryForm("  ")), /Category name is required/);
  assert.deepEqual(empty.events, ["authorize", "authorize"]);
  assert.deepEqual(empty.writes, []);
  assert.deepEqual(empty.invalidations, []);
});

test("F1: session and database errors fail closed without invalidation", async () => {
  for (const name of ["createCategory", "deleteCategory"]) {
    const unavailable = categoryFixture(Error("Session unavailable"));
    await assert.rejects(unavailable.actions[name](categoryForm()), /Session unavailable/);
    assert.deepEqual(unavailable.events, ["authorize"]);
    assert.deepEqual(unavailable.writes, []);
    assert.deepEqual(unavailable.invalidations, []);
    const failed = categoryFixture({ user: { role: "admin" } }, Error("Database unavailable"));
    await assert.rejects(failed.actions[name](categoryForm()), /Database unavailable/);
    assert.equal(failed.events[0], "authorize");
    assert.deepEqual(failed.writes, []);
    assert.deepEqual(failed.invalidations, []);
  }
});

const product = {
  id: "22222222-2222-4222-8222-222222222222", slug: "fixture-headphones", title: "Fixture headphones",
  sku: "PARENT-SKU", description: "Product description", brand: "Fixture brand", categoryName: "Electronics",
  wholesalePriceCents: 1250, retailPriceCents: 2500, stockQuantity: 12,
  minimumOrderQuantity: 2, caseQuantity: 2, costPriceCents: 91827364, isActive: true, categoryId: null,
};
const variant = {
  id: "33333333-3333-4333-8333-333333333333", sku: "VARIANT-SKU", barcode: "123456789",
  option1Name: "Color", option1Value: "Black", option2Name: "Size", option2Value: "Large",
  option3Name: "Pack", option3Value: "Pair", costPriceCents: 81726354,
  wholesalePriceCents: 1350, retailPriceCents: 2800, stockQuantity: 6, imageUrl: "/headphones.jpg", isActive: true,
};
const image = { id: categoryId, url: "/headphones.jpg", altText: "Preserved alt", position: 4, mediaAssetId: null };

function productDatabase(overrides = {}) {
  const projections = [];
  const fixtures = { products: [product], product_variants: [variant], product_images: [image], categories: [], ...overrides };
  const db = { select(projection) {
    const query = {
      rows: [],
      from(table) {
        const tableName = getTableName(table);
        projections.push({ table: tableName, projection });
        // Materialize only requested fields; a real SELECT of cost must fail the test.
        this.rows = fixtures[tableName].map(row => projection
          ? Object.fromEntries(Object.keys(projection).map(key => [key, row[key]]))
          : { ...row });
        return this;
      },
      leftJoin() { return this; }, where() { return this; },
      limit() { return Promise.resolve(this.rows); }, orderBy() { return Promise.resolve(this.rows); },
    };
    return query;
  } };
  return { db, projections };
}

function assertPublicProduct(value) {
  assert.equal(value.wholesalePriceCents, 1250);
  assert.equal(value.retailPriceCents, 2500);
  assert.equal(value.stockQuantity, 12);
  assert.deepEqual(value.images, [{ id: image.id, url: image.url, altText: image.altText }]);
  const { costPriceCents: ignoredCost, ...publicVariant } = variant;
  void ignoredCost;
  assert.deepEqual(value.variants, [publicVariant]);
  const serialized = JSON.stringify(value);
  for (const secret of ["costPriceCents", "cost_price_cents", "91827364", "81726354"]) assert(!serialized.includes(secret), secret);
}

function findElement(value, predicate) {
  if (Array.isArray(value)) return value.map(child => findElement(child, predicate)).find(Boolean);
  if (!React.isValidElement(value)) return undefined;
  return predicate(value) ? value : findElement(value.props.children, predicate);
}

test("F2: actual public query projections and returned data exclude costs while preserving public prices and variants", async () => {
  const fixture = productDatabase();
  const { getStoreProductBySlug } = loadSource("src/lib/store-product-detail.ts", { "@/db": fixture });
  const result = await getStoreProductBySlug(product.slug);
  assertPublicProduct(result);
  assert.deepEqual(fixture.projections.map(entry => entry.table), ["products", "product_images", "product_variants"]);
  for (const { projection } of fixture.projections) {
    assert(projection, "public SELECTs must explicitly project fields");
    assert(!Object.hasOwn(projection, "costPriceCents"));
    assert(!Object.values(projection).some(column => column.name === "cost_price_cents"));
  }
});

test("F2: actual product page passes cost-free serialized props to its Client Component", async () => {
  const fixture = productDatabase();
  const ProductDetail = () => null;
  const page = loadSource("src/app/products/[slug]/page.tsx", {
    "@/db": fixture,
    "@/components/store/product-detail": { ProductDetail },
    "next/navigation": { notFound() { throw Error("Not found"); } },
  });
  const tree = await page.default({ params: Promise.resolve({ slug: product.slug }) });
  const boundary = findElement(tree, element => element.type === ProductDetail);
  assert(boundary, "the real page must mount its ProductDetail boundary");
  assertPublicProduct(boundary.props.product);
});

test("F2: missing products and empty galleries/variants keep existing behavior", async () => {
  const missing = productDatabase({ products: [] });
  const loader = loadSource("src/lib/store-product-detail.ts", { "@/db": missing });
  assert.equal(await loader.getStoreProductBySlug("missing"), null);
  assert.equal(missing.projections.length, 1);
  const page = loadSource("src/app/products/[slug]/page.tsx", {
    "@/db": missing, "@/components/store/product-detail": { ProductDetail: () => null },
    "next/navigation": { notFound() { throw Error("Not found"); } },
  });
  await assert.rejects(page.default({ params: Promise.resolve({ slug: "missing" }) }), /Not found/);
  const empty = productDatabase({ product_images: [], product_variants: [] });
  const result = await loadSource("src/lib/store-product-detail.ts", { "@/db": empty }).getStoreProductBySlug(product.slug);
  assert.deepEqual(result.images, []); assert.deepEqual(result.variants, []);
  assert.equal(result.wholesalePriceCents, 1250);
});

test("F2: public TypeScript representations exclude supplier cost fields", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const virtual = path.join(root, "tests", "security-hotfix-1-contract.ts");
  const source = [
    'import type { StoreVariant, StoreProductDetail } from "../src/lib/store-product-detail";',
    "type Assert<T extends true> = T;",
    'type VariantHasNoCost = Assert<"costPriceCents" extends keyof StoreVariant ? false : true>;',
    'type ProductHasNoCost = Assert<"costPriceCents" extends keyof StoreProductDetail ? false : true>;',
    "export type PublicCostContract = [VariantHasNoCost, ProductHasNoCost];",
  ].join("\n");
  const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  options.noEmit = true; options.incremental = false;
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, ...rest) => path.resolve(file) === virtual
    ? ts.createSourceFile(file, source, languageVersion, true)
    : getSourceFile(file, languageVersion, ...rest);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([virtual], options, host));
  assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")), []);
});

test("F2: actual administrator editor retains cost, wholesale and retail fields", async () => {
  const fixture = productDatabase();
  const page = loadSource("src/app/admin/(panel)/products/[id]/edit/page.tsx", {
    "@/db": fixture, "../../actions": { updateProduct: async () => {} },
    "@/components/admin/product-edit-form": {
      ProductEditForm: ({ children }) => React.createElement("form", null, children),
      ProductEditSaveButton: () => React.createElement("button", null, "Save changes"),
    },
    "@/components/admin/product-image-editor": { ProductImageEditor: () => null },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/navigation": { notFound() { throw Error("Not found"); } },
  });
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ id: product.id }) }));
  for (const [name, value] of [["costPrice", "918273.64"], ["wholesalePrice", "12.50"], ["retailPrice", "25.00"]]) {
    const input = html.match(new RegExp('<input[^>]*name="' + name + '"[^>]*>'))?.[0];
    assert(input, name);
    assert(input.includes('value="' + value + '"'), input);
  }
});

const unsafeDestinations = [
  null, undefined, "", "https://evil.invalid", "https://www.apextradealliance.com/account",
  "//evil.invalid", "///evil.invalid", "javascript:alert(1)", "/\\evil.invalid",
  "/checkout?next=\\evil.invalid", "/\u0000evil.invalid", "/checkout?x=\n", "/checkout#\u007f",
  "/%5cevil.invalid", "/%2Fevil.invalid", "/%0alogin", "/%", "/%ff",
  "/login", "/LOGIN", "/login/", "/login?next=/checkout", "/login#form", "/%6cogin",
  "/account/../login", "/admin/login", "/admin//login/", "/register?next=/checkout",
  "/admin%2flogin", "/account%2f..%2flogin",
];
const safeDestinations = [
  ["/", "/"], ["/checkout?source=cart#shipping", "/checkout?source=cart#shipping"],
  ["/account/orders?status=pending#latest", "/account/orders?status=pending#latest"],
  ["/products?search=50%25%20off", "/products?search=50%25%20off"],
  ["/products?next=https%3A%2F%2Fexample.invalid#results", "/products?next=https%3A%2F%2Fexample.invalid#results"],
  ["/products?search=%5C%0A", "/products?search=%5C%0A"],
  ["/orders/../checkout", "/checkout"],
];

test("F4: shared redirect validator rejects unsafe representations with each existing fallback", () => {
  assert.equal(typeof policy.safeAuthDestination, "function");
  for (const fallback of ["/", "/account"]) {
    for (const next of unsafeDestinations) assert.equal(policy.safeAuthDestination(next, fallback), fallback, String(next));
    for (const [next, expected] of safeDestinations) assert.equal(policy.safeAuthDestination(next, fallback), expected);
    assert.equal(policy.safeAuthDestination(["/checkout", "//evil.invalid"], fallback), "/checkout");
    assert.equal(policy.safeAuthDestination(["//evil.invalid", "/checkout"], fallback), fallback);
  }
});

async function submitRegistration(next, result = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const destinations = [], signupRequests = [];
  const location = {
    origin: policy.PUBLIC_ORIGIN,
    search: next == null ? "" : "?" + new URLSearchParams({ next }),
    assign: destination => destinations.push(destination),
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  try {
    let stateIndex = 0;
    const values = ["Fixture buyer", "buyer@example.invalid", "a secure fixture passphrase"];
    const { default: BuyerAuthForm } = loadSource("src/components/store/buyer-auth-form.tsx", {
      react: { ...React, useState(initial) { const index = stateIndex++; return [index < 3 ? values[index] : initial, () => {}]; } },
      "@/lib/auth-client": { authClient: { signUp: { email: async input => { signupRequests.push(input); return result; } } } },
    });
    const form = findElement(BuyerAuthForm({ mode: "register" }), element => element.type === "form");
    assert(form);
    await form.props.onSubmit({ preventDefault() {} });
    assert.equal(signupRequests.length, 1);
    assert.equal(signupRequests[0].callbackURL, policy.PUBLIC_ORIGIN + "/verify-email/callback");
    return destinations;
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else delete globalThis.window;
  }
}

test("F4: actual successful registration handler uses safe destinations and preserves the homepage fallback", async () => {
  for (const next of unsafeDestinations) assert.deepEqual(await submitRegistration(next), ["/"], String(next));
  for (const [next, expected] of safeDestinations) assert.deepEqual(await submitRegistration(next), [expected]);
});

test("F4: failed registration never navigates", async () => {
  assert.deepEqual(await submitRegistration("/checkout", { error: { status: 400, message: "Fixture signup rejected" } }), []);
});

test("F4: actual login page shares validation while preserving its account fallback", async () => {
  for (const session of [null, { user: { id: "buyer", role: "user" } }]) {
    for (const [next, expected] of [...unsafeDestinations.map(next => [next, "/account"]), ...safeDestinations]) {
      const requestHeaders = new Headers();
      const Form = () => null;
      const page = loadSource("src/app/login/page.tsx", {
        "next/headers": { headers: async () => requestHeaders },
        "@/lib/auth": { auth: { api: { getSession: async ({ headers }) => { assert.equal(headers, requestHeaders); return session; } } } },
        "next/navigation": { redirect(destination) { throw Object.assign(Error("redirect"), { destination }); } },
        "./login-form": Form,
      });
      const result = page.default({ searchParams: Promise.resolve({ next }) });
      if (session) await assert.rejects(result, error => error.destination === expected);
      else {
        const form = await result;
        assert.equal(form.type, Form);
        assert.equal(form.props.redirectTo, expected);
      }
    }
  }
});
