"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Heart } from "lucide-react";

type ProductCardProduct = {
  id: string;
  slug: string;
  title: string;

  brand: string | null;
  categoryName: string | null;

  wholesalePriceCents: number;
  retailPriceCents: number;

  stockQuantity: number;
  minimumOrderQuantity: number;

  imageUrl: string | null;
};

function formatMoney(cents: number) {
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
  product: ProductCardProduct;
}) {
  return (
    <article className="group flex h-full flex-col">
      {/* PRODUCT IMAGE */}
      <div className="relative">
        <Link
          href={`/products/${product.slug}`}
          className="block"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#f1f0ec]">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.title}
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

        {/* SAVE */}
        <button
          type="button"
          aria-label="Save product"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            // Wishlist handled separately
          }}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:bg-white"
        >
          <Heart size={17} />
        </button>
      </div>

      {/* PRODUCT INFORMATION */}
      <Link
        href={`/products/${product.slug}`}
        className="flex flex-1 flex-col pt-4"
      >
        {/* CATEGORY */}
        <p className="mb-1 min-h-4 truncate text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
          {product.categoryName ??
            "Uncategorized"}
        </p>

        {/* TITLE
            Always reserves room for
            exactly two lines.
        */}
        <h3 className="min-h-[40px] line-clamp-2 text-[15px] font-medium leading-5 text-neutral-900 transition group-hover:underline">
          {product.title}
        </h3>

        {/* BRAND
            Always reserves the same
            vertical space, even if a
            product has no brand.
        */}
        <p className="mt-1 min-h-4 truncate text-xs leading-4 text-neutral-400">
          {product.brand ?? ""}
        </p>

        {/* PRICE / STOCK
            mt-auto keeps this section
            aligned at the bottom of
            every product card.
        */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3">
          {/* WHOLESALE */}
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

          {/* MSRP / STOCK */}
          <div className="text-right">
            <p className="text-xs text-neutral-500">
              MSRP{" "}
              {formatMoney(
                product.retailPriceCents
              )}
            </p>

            <p
              className={`mt-1 text-xs ${
                product.stockQuantity > 0
                  ? "text-emerald-600"
                  : "text-red-500"
              }`}
            >
              {product.stockQuantity > 0
                ? `${product.stockQuantity} in stock`
                : "Out of stock"}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
