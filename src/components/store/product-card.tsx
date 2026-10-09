"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { Heart, ImageIcon } from "lucide-react";

import { useSavedProducts } from "@/lib/saved-products";

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
  const { isSaved, toggle } = useSavedProducts();
  const saved = isSaved(product.id);
  return (
    <article className="group flex h-full min-w-0 flex-col">
      {/* PRODUCT IMAGE */}
      <div className="relative">
        <Link
          href={`/products/${product.slug}`}
          className="block"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-background">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.title}
                loading="lazy"
                className="h-full w-full object-contain p-3 transition duration-300 motion-safe:group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted">
                <ImageIcon size={28} strokeWidth={1.2} aria-hidden="true" />
                Image unavailable
              </div>
            )}

            <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-lg bg-white px-2 py-1.5 text-xs font-medium shadow-sm">
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
          aria-label={(saved ? "Remove from saved: " : "Save ") + product.title}
          aria-pressed={saved}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            toggle(product);
          }}
          className={"absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition " + (saved ? "border-brand bg-brand text-white hover:bg-[#24483d]" : "border-border bg-white text-brand hover:bg-background")}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
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
        <p className="mt-1 min-h-4 truncate text-xs leading-4 text-muted">
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
            <p className="text-lg font-semibold tabular-nums tracking-tight">
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
                  ? "text-emerald-700"
                  : "text-red-700"
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
