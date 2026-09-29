"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Heart,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { useSavedProducts } from "@/lib/saved-products";

function formatMoney(
  cents: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  ).format(cents / 100);
}

export function SavedProductsPage() {
  const {
    products,
    totalSaved,
    remove,
    clear,
  } = useSavedProducts();

  return (
    <section className="mx-auto max-w-[1500px] px-5 py-8 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Your shortlist
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
            Saved products
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            {totalSaved}{" "}
            {totalSaved === 1
              ? "product"
              : "products"}{" "}
            saved
          </p>
        </div>

        {totalSaved > 0 && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Remove all saved products?"
                )
              ) {
                clear();
              }
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2
              size={14}
            />
            Clear saved
          </button>
        )}
      </div>

      {products.length ===
      0 ? (
        <div className="mt-8 flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-[#fafaf8] px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-neutral-400 shadow-sm">
            <Heart
              size={20}
            />
          </div>

          <h2 className="mt-4 font-semibold text-neutral-950">
            No saved products
          </h2>

          <p className="mt-1 max-w-sm text-sm leading-6 text-neutral-500">
            Save products while
            browsing and they will
            appear here.
          </p>

          <Link
            href="/products"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#24483d]"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map(
            (product) => (
              <article
                key={
                  product.id
                }
                className="group min-w-0"
              >
                <div className="relative">
                  <Link
                    href={`/products/${product.slug}`}
                    className="block"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#f1f0ec]">
                      {product.imageUrl ? (
                        <img
                          src={
                            product.imageUrl
                          }
                          alt={
                            product.title
                          }
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
                          No product
                          image
                        </div>
                      )}

                      <div className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm">
                        MOQ{" "}
                        {
                          product.minimumOrderQuantity
                        }
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      remove(
                        product.id
                      )
                    }
                    aria-label={`Remove ${product.title}`}
                    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#17352c] text-white shadow-sm transition hover:bg-[#24483d]"
                  >
                    <Heart
                      size={17}
                      fill="currentColor"
                    />
                  </button>
                </div>

                <Link
                  href={`/products/${product.slug}`}
                  className="block pt-4"
                >
                  <p className="mb-1 truncate text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    {product.categoryName ??
                      "Uncategorized"}
                  </p>

                  <h3 className="line-clamp-2 text-[15px] font-medium leading-5 text-neutral-900 group-hover:underline">
                    {
                      product.title
                    }
                  </h3>

                  {product.brand && (
                    <p className="mt-1 truncate text-xs text-neutral-400">
                      {
                        product.brand
                      }
                    </p>
                  )}

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">
                        {formatMoney(
                          product.wholesalePriceCents
                        )}
                      </p>

                      <p className="text-xs text-neutral-500">
                        Wholesale
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-neutral-500">
                        MSRP{" "}
                        {formatMoney(
                          product.retailPriceCents
                        )}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          product.stockQuantity >
                          0
                            ? "text-emerald-600"
                            : "text-red-500"
                        }`}
                      >
                        {product.stockQuantity >
                        0
                          ? `${product.stockQuantity} in stock`
                          : "Out of stock"}
                      </p>
                    </div>
                  </div>
                </Link>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}