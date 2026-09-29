"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Heart } from "lucide-react";

import type { CatalogProduct } from "@/lib/store-catalog";
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

export function ProductCard({
  product,
}: {
  product: CatalogProduct;
}) {
  const {
    isSaved,
    toggle,
  } = useSavedProducts();

  const saved =
    isSaved(product.id);

  return (
    <article className="group min-w-0">
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
                No product image
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
          aria-label={
            saved
              ? "Remove from saved products"
              : "Save product"
          }
          aria-pressed={saved}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            toggle({
              id: product.id,
              slug:
                product.slug,
              title:
                product.title,
              brand:
                product.brand,
              categoryName:
                product.categoryName,
              imageUrl:
                product.imageUrl,
              wholesalePriceCents:
                product.wholesalePriceCents,
              retailPriceCents:
                product.retailPriceCents,
              stockQuantity:
                product.stockQuantity,
              minimumOrderQuantity:
                product.minimumOrderQuantity,
            });
          }}
          className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition ${
            saved
              ? "border-[#17352c]/10 bg-[#17352c] text-white"
              : "border-white/70 bg-white/85 text-neutral-800 hover:bg-white"
          }`}
        >
          <Heart
            size={17}
            fill={
              saved
                ? "currentColor"
                : "none"
            }
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

        <h3 className="line-clamp-2 text-[15px] font-medium leading-5 text-neutral-900 transition group-hover:underline">
          {product.title}
        </h3>

        {product.brand && (
          <p className="mt-1 truncate text-xs text-neutral-400">
            {product.brand}
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
  );
}