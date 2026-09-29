"use client";

/* eslint-disable @next/next/no-img-element */

import { AddToOrderButton } from "@/components/store/add-to-order-button";

import {
  Check,
  Heart,
  Minus,
  Plus,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  useSavedProducts,
} from "@/lib/saved-products";

import type {
  StoreProductDetail,
  StoreVariant,
} from "@/lib/store-product-detail";

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

type OptionGroup = {
  name: string;
  values: string[];
};

export function ProductDetail({
  product,
}: {
  product: StoreProductDetail;
}) {
  const {
    isSaved,
    toggle,
  } = useSavedProducts();

  const saved =
    isSaved(product.id);

  const firstVariant =
    product.variants[0] ??
    null;

  const initialSelections: Record<
    string,
    string
  > = {};

  if (
    firstVariant?.option1Name &&
    firstVariant.option1Value
  ) {
    initialSelections[
      firstVariant.option1Name
    ] = firstVariant.option1Value;
  }

  if (
    firstVariant?.option2Name &&
    firstVariant.option2Value
  ) {
    initialSelections[
      firstVariant.option2Name
    ] = firstVariant.option2Value;
  }

  if (
    firstVariant?.option3Name &&
    firstVariant.option3Value
  ) {
    initialSelections[
      firstVariant.option3Name
    ] = firstVariant.option3Value;
  }

  const caseQuantity =
    Math.max(
      1,
      product.caseQuantity
    );

  const minimumQuantity =
    Math.ceil(
      Math.max(
        1,
        product.minimumOrderQuantity
      ) / caseQuantity
    ) * caseQuantity;

  const [
    selections,
    setSelections,
  ] = useState(
    initialSelections
  );

  const [
    quantity,
    setQuantity,
  ] = useState(
    minimumQuantity
  );

  const [
    selectedImage,
    setSelectedImage,
  ] = useState(
    product.images[0]?.url ??
      null
  );

  const optionGroups =
    useMemo<OptionGroup[]>(
      () => {
        const groups =
          new Map<
            string,
            Set<string>
          >();

        for (
          const variant
          of product.variants
        ) {
          addOption(
            groups,
            variant.option1Name,
            variant.option1Value
          );

          addOption(
            groups,
            variant.option2Name,
            variant.option2Value
          );

          addOption(
            groups,
            variant.option3Name,
            variant.option3Value
          );
        }

        return Array.from(
          groups.entries()
        ).map(
          ([
            name,
            values,
          ]) => ({
            name,
            values:
              Array.from(
                values
              ),
          })
        );
      },
      [product.variants]
    );

  const selectedVariant =
    useMemo(() => {
      if (
        product.variants
          .length === 0
      ) {
        return null;
      }

      return (
        product.variants.find(
          (variant) =>
            variantMatches(
              variant,
              selections
            )
        ) ?? null
      );
    }, [
      product.variants,
      selections,
    ]);

  const activeWholesalePrice =
    selectedVariant
      ? selectedVariant.wholesalePriceCents
      : product.wholesalePriceCents;

  const activeRetailPrice =
    selectedVariant
      ? selectedVariant.retailPriceCents
      : product.retailPriceCents;

  const activeStock =
    selectedVariant
      ? selectedVariant.stockQuantity
      : product.stockQuantity;

  const activeSku =
    selectedVariant?.sku ??
    product.sku;

  const mainImage =
    selectedVariant?.imageUrl ||
    selectedImage ||
    product.images[0]?.url ||
    null;

  const selectedVariantName =
    selectedVariant
      ? getVariantLabel(
          selectedVariant
        )
      : null;

  const hasInvalidVariant =
    product.variants.length >
      0 &&
    !selectedVariant;

  const quantityExceedsStock =
    activeStock > 0 &&
    quantity > activeStock;

  function updateSelection(
    name: string,
    value: string
  ) {
    setSelections(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }

  function decreaseQuantity() {
    setQuantity(
      (current) =>
        Math.max(
          minimumQuantity,
          current -
            caseQuantity
        )
    );
  }

  function increaseQuantity() {
    setQuantity(
      (current) => {
        const next =
          current +
          caseQuantity;

        if (
          activeStock > 0 &&
          next >
            activeStock
        ) {
          return current;
        }

        return next;
      }
    );
  }

  function handleSavedToggle() {
    toggle({
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand:
        product.brand,
      categoryName:
        product.categoryName,
      imageUrl:
        product.images[0]
          ?.url ??
        mainImage ??
        null,

      wholesalePriceCents:
        product.wholesalePriceCents,

      retailPriceCents:
        product.retailPriceCents,

      stockQuantity:
        product.stockQuantity,

      minimumOrderQuantity:
        product.minimumOrderQuantity,
    });
  }

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_430px] xl:grid-cols-[minmax(0,1fr)_460px]">
        {/* LEFT */}
        <div>
          <div className="grid gap-4 md:grid-cols-[78px_minmax(0,1fr)]">
            {/* THUMBNAILS */}
            {product.images.length >
              1 && (
              <div className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col">
                {product.images
                  .slice(0, 6)
                  .map(
                    (image) => {
                      const active =
                        mainImage ===
                        image.url;

                      return (
                        <button
                          key={
                            image.id
                          }
                          type="button"
                          onClick={() =>
                            setSelectedImage(
                              image.url
                            )
                          }
                          className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-neutral-50 transition md:h-[72px] md:w-[72px] ${
                            active
                              ? "border-[#17352c] ring-1 ring-[#17352c]"
                              : "border-neutral-200 hover:border-neutral-400"
                          }`}
                        >
                          <img
                            src={
                              image.url
                            }
                            alt={
                              image.altText ??
                              product.title
                            }
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    }
                  )}
              </div>
            )}

            {/* MAIN IMAGE */}
            <div
              className={`order-1 md:order-2 ${
                product.images
                  .length > 1
                  ? ""
                  : "md:col-span-2"
              }`}
            >
              <div className="relative h-[460px] w-full overflow-hidden rounded-2xl bg-[#f3f2ee] lg:h-[500px]">
                {mainImage ? (
                  <img
                    src={
                      mainImage
                    }
                    alt={
                      product.title
                    }
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
                    No product image
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div>
            {/* CATEGORY + SAVE */}
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                {product.categoryName ??
                  "Wholesale product"}
              </p>

              <button
                type="button"
                onClick={
                  handleSavedToggle
                }
                aria-pressed={
                  saved
                }
                aria-label={
                  saved
                    ? "Remove from saved products"
                    : "Save product"
                }
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
                  saved
                    ? "border-[#17352c] bg-[#17352c] text-white"
                    : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
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

            {/* TITLE */}
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.04em]">
              {product.title}
            </h1>

            {/* BRAND */}
            {product.brand && (
              <p className="mt-2 text-sm text-neutral-500">
                by{" "}
                <span className="font-medium text-neutral-700">
                  {
                    product.brand
                  }
                </span>
              </p>
            )}

            {/* PRICE */}
            <div className="mt-5 flex items-end gap-4">
              <div>
                <p className="text-2xl font-semibold tracking-[-0.03em]">
                  {formatMoney(
                    activeWholesalePrice
                  )}
                </p>

                <p className="mt-0.5 text-xs text-neutral-500">
                  Wholesale
                </p>
              </div>

              {activeRetailPrice >
                0 && (
                <p className="pb-0.5 text-sm text-neutral-500">
                  MSRP{" "}
                  {formatMoney(
                    activeRetailPrice
                  )}
                </p>
              )}
            </div>

            {/* SKU + STOCK */}
            <div className="mt-4 flex items-center gap-5 border-y border-neutral-200 py-3 text-xs">
              <div>
                <span className="text-neutral-400">
                  SKU
                </span>

                <span className="ml-2 font-medium text-neutral-800">
                  {activeSku}
                </span>
              </div>

              <div className="h-4 w-px bg-neutral-200" />

              <div
                className={
                  activeStock > 0
                    ? "text-emerald-700"
                    : "text-red-600"
                }
              >
                {activeStock > 0
                  ? `${activeStock} in stock`
                  : "Out of stock"}
              </div>
            </div>

            {/* VARIANTS */}
            {optionGroups.length >
              0 && (
              <div className="mt-5 space-y-4">
                {optionGroups.map(
                  (group) => (
                    <div
                      key={
                        group.name
                      }
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          {
                            group.name
                          }
                        </p>

                        <span className="text-xs text-neutral-400">
                          {
                            selections[
                              group
                                .name
                            ]
                          }
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {group.values.map(
                          (
                            value
                          ) => {
                            const selected =
                              selections[
                                group
                                  .name
                              ] ===
                              value;

                            return (
                              <button
                                key={
                                  value
                                }
                                type="button"
                                onClick={() =>
                                  updateSelection(
                                    group.name,
                                    value
                                  )
                                }
                                className={`relative min-w-14 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                                  selected
                                    ? "border-[#17352c] bg-[#17352c] text-white"
                                    : "border-neutral-300 bg-white hover:border-neutral-500"
                                }`}
                              >
                                {
                                  value
                                }

                                {selected && (
                                  <Check
                                    size={
                                      11
                                    }
                                    className="absolute -right-1 -top-1 rounded-full bg-white p-[1px] text-[#17352c]"
                                  />
                                )}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* MOQ + CASE + QUANTITY */}
            <div className="mt-5 grid grid-cols-[1fr_1fr_auto] overflow-hidden rounded-xl border border-neutral-200">
              <div className="border-r border-neutral-200 px-4 py-3">
                <p className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                  Minimum order
                </p>

                <p className="mt-1 whitespace-nowrap text-sm font-semibold">
                  {
                    product.minimumOrderQuantity
                  }{" "}
                  units
                </p>
              </div>

              <div className="border-r border-neutral-200 px-4 py-3">
                <p className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                  Case quantity
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {
                    product.caseQuantity
                  }
                </p>
              </div>

              <div className="px-3 py-3">
                <p className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                  Quantity
                </p>

                <div className="mt-1 flex h-5 items-center justify-center">
                  <button
                    type="button"
                    onClick={
                      decreaseQuantity
                    }
                    disabled={
                      quantity <=
                      minimumQuantity
                    }
                    aria-label="Decrease quantity"
                    className="flex h-6 w-7 items-center justify-center text-neutral-500 transition hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Minus
                      size={13}
                    />
                  </button>

                  <span className="min-w-8 text-center text-sm font-semibold">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={
                      increaseQuantity
                    }
                    disabled={
                      activeStock <=
                        0 ||
                      quantity +
                        caseQuantity >
                        activeStock
                    }
                    aria-label="Increase quantity"
                    className="flex h-6 w-7 items-center justify-center text-neutral-500 transition hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Plus
                      size={13}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* ADD TO ORDER */}
            <div className="mt-3">
              <AddToOrderButton
                productId={
                  product.id
                }
                productSlug={
                  product.slug
                }
                productName={
                  product.title
                }
                variantId={
                  selectedVariant
                    ?.id ??
                  null
                }
                variantName={
                  selectedVariantName
                }
                sku={
                  activeSku ??
                  null
                }
                imageUrl={
                  mainImage
                }
                priceCents={
                  activeWholesalePrice
                }
                quantity={
                  quantity
                }
                minimumOrderQuantity={
                  product.minimumOrderQuantity
                }
                caseQuantity={
                  product.caseQuantity
                }
                availableStock={
                  activeStock
                }
                disabled={
                  activeStock <=
                    0 ||
                  hasInvalidVariant ||
                  quantityExceedsStock
                }
              />
            </div>

            {quantityExceedsStock && (
              <p className="mt-2 text-xs font-medium text-red-600">
                Selected quantity exceeds
                available stock.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* LOWER SECTION */}
      <div className="mt-8 grid gap-6 border-t border-neutral-200 pt-7 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="text-base font-semibold">
            Product details
          </h2>

          {product.description ? (
            <p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-6 text-neutral-600">
              {
                product.description
              }
            </p>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">
              No description available.
            </p>
          )}
        </div>

        <div className="rounded-xl bg-[#f7f6f2] p-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">
              SKU
            </span>

            <span className="font-medium">
              {activeSku}
            </span>
          </div>

          <div className="mt-3 flex justify-between gap-4">
            <span className="text-neutral-500">
              MOQ
            </span>

            <span className="font-medium">
              {
                product.minimumOrderQuantity
              }
            </span>
          </div>

          <div className="mt-3 flex justify-between gap-4">
            <span className="text-neutral-500">
              Case
            </span>

            <span className="font-medium">
              {
                product.caseQuantity
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function addOption(
  groups: Map<
    string,
    Set<string>
  >,
  name: string | null,
  value: string | null
) {
  if (!name || !value) {
    return;
  }

  if (!groups.has(name)) {
    groups.set(
      name,
      new Set<string>()
    );
  }

  groups
    .get(name)!
    .add(value);
}

function variantMatches(
  variant: StoreVariant,
  selections: Record<
    string,
    string
  >
) {
  const options = [
    [
      variant.option1Name,
      variant.option1Value,
    ],
    [
      variant.option2Name,
      variant.option2Value,
    ],
    [
      variant.option3Name,
      variant.option3Value,
    ],
  ];

  for (const [
    name,
    value,
  ] of options) {
    if (!name || !value) {
      continue;
    }

    if (
      selections[name] !== value
    ) {
      return false;
    }
  }

  return true;
}

function getVariantLabel(
  variant: StoreVariant
) {
  const values = [
    variant.option1Value,
    variant.option2Value,
    variant.option3Value,
  ].filter(
    (
      value
    ): value is string =>
      Boolean(value)
  );

  if (
    values.length === 0
  ) {
    return null;
  }

  return values.join(" / ");
}