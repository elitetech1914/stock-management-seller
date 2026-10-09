import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  Archive,
  Package,
  Pencil,
  Plus,
} from "lucide-react";

import { db } from "@/db";

import {
  categories,
  products,
} from "@/db/schema";

import { archiveProduct } from "./actions";

import { DeleteProductButton } from "@/components/admin/delete-product-button";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function ProductsPage() {
  const productList = await db
    .select({
      id: products.id,

      title: products.title,

      sku: products.sku,

      brand: products.brand,

      wholesalePriceCents:
        products.wholesalePriceCents,

      retailPriceCents:
        products.retailPriceCents,

      stockQuantity:
        products.stockQuantity,

      isActive:
        products.isActive,

      categoryName:
        categories.name,

      createdAt:
        products.createdAt,
    })
    .from(products)
    .leftJoin(
      categories,
      eq(
        products.categoryId,
        categories.id
      )
    )
    .orderBy(
      desc(products.createdAt)
    );

  return (
    <div className="p-4 sm:p-6 lg:p-8 2xl:p-10">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Catalog
          </p>

          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl tracking-[-0.05em]">
            Products
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            Manage products, pricing and inventory.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#24483d]"
        >
          <Plus size={17} />

          Add product
        </Link>
      </div>

      {/* PRODUCTS TABLE */}
      <section className="mt-10 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {productList.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ef] text-[#17352c]">
              <Package size={24} />
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              No products yet
            </h2>

            <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
              Add a product manually or import products
              using CSV.
            </p>

            <Link
              href="/admin/products/new"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#17352c] px-4 text-sm font-semibold text-white"
            >
              <Plus size={16} />

              Add product
            </Link>
          </div>
        ) : (
          /* TABLE */
          <>
          <div className="grid gap-3 bg-background p-3 lg:hidden">
            {productList.map((product) => <article key={product.id} className="ui-panel p-4">
              <div className="flex items-start justify-between gap-3"><Link href={"/admin/products/" + product.id + "/edit"} className="min-w-0 break-words text-base font-semibold text-brand">{product.title}</Link><span className={"shrink-0 rounded-full px-2 py-1 text-xs font-medium " + (product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-700")}>{product.isActive ? "Active" : "Archived"}</span></div>
              <p className="mt-2 break-words text-xs text-muted">SKU: {product.sku}</p>{product.brand && <p className="mt-1 break-words text-xs text-muted">{product.brand}</p>}
              <p className="mt-3 text-sm text-muted">{product.categoryName ?? "No category"}</p>
              <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-border py-3 text-sm"><div><dt className="text-xs text-muted">Wholesale</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(product.wholesalePriceCents)}</dd></div><div><dt className="text-xs text-muted">MSRP</dt><dd className="mt-1 tabular-nums">{formatMoney(product.retailPriceCents)}</dd></div><div className="col-span-2"><dt className="text-xs text-muted">Stock</dt><dd className="mt-1 font-medium">{product.stockQuantity} units{product.stockQuantity === 0 ? " - Out of stock" : product.stockQuantity <= 10 ? " - Low stock" : ""}</dd></div></dl>
              <div className="mt-3"><ProductActions product={product} /></div>
            </article>)}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-6 py-4 font-medium">
                    Product
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Category
                  </th>

                  <th className="px-6 py-4 text-right font-medium">
                    Wholesale
                  </th>

                  <th className="px-6 py-4 text-right font-medium">
                    MSRP
                  </th>

                  <th className="px-6 py-4 text-right font-medium">
                    Stock
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Status
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {productList.map(
                  (product) => (
                    <tr
                      key={product.id}
                      className="transition hover:bg-neutral-50/70"
                    >
                      {/* PRODUCT */}
                      <td className="px-6 py-4">
                        <p className="font-medium text-neutral-900">
                          {product.title}
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          SKU: {product.sku}
                        </p>

                        {product.brand && (
                          <p className="mt-1 text-xs text-neutral-500">
                            {product.brand}
                          </p>
                        )}
                      </td>

                      {/* CATEGORY */}
                      <td className="px-6 py-4 text-neutral-600">
                        {product.categoryName ??
                          "—"}
                      </td>

                      {/* WHOLESALE */}
                      <td className="px-6 py-4 text-right font-medium">
                        {formatMoney(
                          product.wholesalePriceCents
                        )}
                      </td>

                      {/* MSRP */}
                      <td className="px-6 py-4 text-right text-neutral-600">
                        {formatMoney(
                          product.retailPriceCents
                        )}
                      </td>

                      {/* STOCK */}
                      <td className="px-6 py-4 text-right">
                        <span
                          className={
                            product.stockQuantity === 0
                              ? "font-medium text-red-600"
                              : product.stockQuantity <= 10
                                ? "font-medium text-amber-600"
                                : "text-neutral-900"
                          }
                        >
                          {product.stockQuantity}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            product.isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {product.isActive
                            ? "Active"
                            : "Archived"}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-4">
                        <ProductActions product={product} />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
function ProductActions({ product }: { product: { id: string; title: string; isActive: boolean } }) {
  return <div className="flex flex-wrap items-center gap-2">
    <Link href={"/admin/products/" + product.id + "/edit"} aria-label={"Edit " + product.title} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-brand hover:bg-background"><Pencil size={15} />Edit</Link>
    {product.isActive && <form action={archiveProduct}><input type="hidden" name="id" value={product.id} /><button type="submit" aria-label={"Archive " + product.title} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted hover:bg-amber-50 hover:text-amber-800"><Archive size={15} />Archive</button></form>}
    <DeleteProductButton id={product.id} title={product.title} />
  </div>;
}
