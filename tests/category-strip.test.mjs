import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
let pathname = "/";
const compiled = { exports: {} };
const source = ts.transpileModule(readFileSync(new URL("../src/components/site/category-strip.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
new Function("require", "module", "exports", source)((name) => {
  if (name === "next/navigation") return { usePathname: () => pathname };
  if (name === "next/link") return function LinkFixture({ children, ...props }) { return React.createElement("a", props, children); };
  return nativeRequire(name);
}, compiled, compiled.exports);

const render = (categories = [], categoryStatus = "ready") => renderToStaticMarkup(React.createElement(compiled.exports.CategoryStrip, {
  categories, categoryStatus, onRetryCategories() {},
}));

test("empty categories retain All products and accessible scroll buttons", () => {
  const html = render();
  assert.match(html, /aria-label="Category navigation"/);
  assert.match(html, /href="\/products"/);
  assert.match(html, /Scroll categories left/);
  assert.match(html, /Scroll categories right/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Loading categories|Categories could not load/);
});

test("category links preserve supplied order, escape names and mark the active route", () => {
  pathname = "/categories/custom";
  const html = render([
    { id: "1", name: "Electronics", slug: "electronics" },
    { id: "2", name: "Special <finds>", slug: "custom" },
  ]);
  assert(html.indexOf('href="/products"') < html.indexOf('href="/categories/electronics"'));
  assert(html.indexOf('href="/categories/electronics"') < html.indexOf('href="/categories/custom"'));
  assert.match(html, /href="\/categories\/custom" aria-current="page"/);
  assert.match(html, /Special &lt;finds&gt;/);
  assert.match(html, /lucide-smartphone/);
  assert.equal((html.match(/lucide-grid-2x2/g) ?? []).length, 2);
  pathname = "/products";
  assert.match(render(), /href="\/products" aria-current="page"/);
  pathname = "/";
});

test("common category icons and loading/error feedback keep navigation available", () => {
  const categories = ["Electronics", "Clothing", "Home", "Kitchen", "Beauty", "Sports"].map((name, i) => ({ id: String(i), name, slug: name.toLowerCase() }));
  const html = render(categories);
  for (const icon of ["smartphone", "shirt", "house", "cooking-pot", "sparkles", "dumbbell"]) assert.match(html, new RegExp("lucide-" + icon));
  assert.match(render([], "loading"), /role="status"[^>]*>Loading categories/);
  const error = render([], "error");
  assert.match(error, /role="alert"/);
  assert.match(error, /Try again/);
  assert.match(error, /href="\/products"/);
});
