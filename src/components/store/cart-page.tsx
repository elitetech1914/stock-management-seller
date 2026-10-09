"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useHydrated } from "@/lib/use-hydrated";

import {
  getCartMinimumQuantity,
  getCartQuantityStep,
  useCart,
} from "@/lib/cart";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function CartPage() {
  const {
    items,
    subtotalCents,
    setQuantity,
    removeItem,
    clearCart,
  } = useCart();

  const mounted = useHydrated();

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-72 animate-pulse rounded-2xl bg-neutral-100" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <ShoppingCart className="h-6 w-6 text-neutral-600" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
            Your order is empty
          </h1>

          <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
            Browse our wholesale catalog and add
            products to your order.
          </p>

          <Link
            href="/products"
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition hover:bg-[#24483d]"
          >
            <ArrowLeft className="h-4 w-4" />
            Browse products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Wholesale order
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Your cart
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            Review quantities before continuing to
            checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={() => { if (window.confirm("Remove all products from your cart?")) clearCart(); }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-red-700 transition hover:border-red-200 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Clear cart
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {items.map((item, index) => {
            const quantityStep =
              getCartQuantityStep(item);

            const minimumQuantity =
              getCartMinimumQuantity(item);

            return (
              <article
                key={item.lineId}
                className={`grid grid-cols-[72px_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center ${
                  index !== items.length - 1
                    ? "border-b border-neutral-200"
                    : ""
                }`}
              >
                <Link
                  href={`/products/${item.productSlug}`}
                  className="relative block aspect-square overflow-hidden rounded-xl bg-neutral-100"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-6 w-6 text-neutral-500" />
                    </div>
                  )}
                </Link>

                <div className="min-w-0">
                  <Link
                    href={`/products/${item.productSlug}`}
                    className="line-clamp-2 font-semibold text-neutral-950 transition hover:text-neutral-600"
                  >
                    {item.productName}
                  </Link>

                  {item.variantName ? (
                    <p className="mt-1 text-sm text-neutral-500">
                      {item.variantName}
                    </p>
                  ) : null}

                  {item.sku ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      SKU: {item.sku}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span>
                      MOQ: {minimumQuantity}
                    </span>

                    {item.caseQuantity > 1 ? (
                      <span>
                        Case qty:{" "}
                        {item.caseQuantity}
                      </span>
                    ) : null}

                    {item.availableStock !== null ? (
                      <span>
                        Stock:{" "}
                        {item.availableStock}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeItem(item.lineId)
                    }
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-500 transition hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>

                <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-950">
                      {formatMoney(
                        item.priceCents *
                          item.quantity,
                      )}
                    </p>

                    <p className="mt-0.5 text-xs text-neutral-500">
                      {formatMoney(
                        item.priceCents,
                      )}{" "}
                      each
                    </p>
                  </div>

                  <div className="flex h-11 items-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.productName} quantity`}
                      onClick={() =>
                        setQuantity(
                          item.lineId,
                          item.quantity -
                            quantityStep,
                        )
                      }
                      className="flex h-full w-11 items-center justify-center text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>

                    <input
                      type="number"
                      min={minimumQuantity}
                      step={quantityStep}
                      value={item.quantity}
                      onChange={(event) => {
                        const quantity = Number(
                          event.target.value,
                        );

                        if (
                          Number.isFinite(quantity)
                        ) {
                          setQuantity(
                            item.lineId,
                            quantity,
                          );
                        }
                      }}
                      className="h-full w-14 border-x border-neutral-200 bg-white text-center text-sm font-medium text-neutral-950 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />

                    <button
                      type="button"
                      aria-label={`Increase ${item.productName} quantity`}
                      onClick={() =>
                        setQuantity(
                          item.lineId,
                          item.quantity +
                            quantityStep,
                        )
                      }
                      className="flex h-full w-11 items-center justify-center text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-950"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-950">
              Order summary
            </h2>

            <div className="mt-5 space-y-3 border-b border-neutral-200 pb-5 text-sm">
              <div className="flex justify-between gap-4 text-neutral-600">
                <span>Products</span>

                <span className="font-medium text-neutral-950">
                  {items.length}
                </span>
              </div>

              <div className="flex justify-between gap-4 text-neutral-600">
                <span>Subtotal</span>

                <span className="font-semibold text-neutral-950">
                  {formatMoney(subtotalCents)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 py-5">
              <span className="font-semibold text-neutral-950">
                Estimated total
              </span>

              <span className="text-xl font-semibold text-neutral-950">
                {formatMoney(subtotalCents)}
              </span>
            </div>

            <p className="mb-4 text-xs leading-5 text-neutral-500">
              Final product pricing and stock will be
              verified again when the order is placed.
            </p>

            <Link
              href="/checkout"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-[#24483d]"
            >
              Continue to checkout
            </Link>

            <Link
              href="/products"
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
