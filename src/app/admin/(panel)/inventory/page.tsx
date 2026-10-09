import {
  asc,
  eq,
} from "drizzle-orm";
import {
  AlertTriangle,
  Boxes,
  PackageCheck,
  PackageX,
  Search,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { db } from "@/db";
import {
  products,
  productVariants,
} from "@/db/schema";
import { updateInventory } from "./actions";

type InventoryRow = {
  id: string;
  type: "product" | "variant";
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  stock: number;
};

const LOW_STOCK_LIMIT = 5;

function getVariantName(variant: {
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
}) {
  const values = [
    variant.option1Value,
    variant.option2Value,
    variant.option3Value,
  ].filter(
    (value): value is string =>
      Boolean(value)
  );

  return values.length
    ? values.join(" / ")
    : "Variant";
}

function getStockStatus(
  stock: number
) {
  if (stock <= 0) {
    return {
      label: "Out of stock",
      className:
        "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (
    stock <=
    LOW_STOCK_LIMIT
  ) {
    return {
      label: "Low stock",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "In stock",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
}) {
  const params =
    await searchParams;

  const query =
    params.q?.trim() ?? "";

  const status =
    params.status ?? "all";

  const productList =
    await db
      .select({
        id: products.id,
        title:
          products.title,
        sku: products.sku,
        stockQuantity:
          products.stockQuantity,
      })
      .from(products)
      .where(
        eq(
          products.isActive,
          true
        )
      )
      .orderBy(
        asc(products.title)
      );

  const variantList =
    await db
      .select({
        id:
          productVariants.id,

        productId:
          productVariants.productId,

        sku:
          productVariants.sku,

        stockQuantity:
          productVariants.stockQuantity,

        option1Value:
          productVariants.option1Value,

        option2Value:
          productVariants.option2Value,

        option3Value:
          productVariants.option3Value,
      })
      .from(
        productVariants
      )
      .where(
        eq(
          productVariants.isActive,
          true
        )
      )
      .orderBy(
        asc(
          productVariants.sku
        )
      );

  const variantsByProduct =
    new Map<
      string,
      typeof variantList
    >();

  for (
    const variant of variantList
  ) {
    const existing =
      variantsByProduct.get(
        variant.productId
      ) ?? [];

    existing.push(variant);

    variantsByProduct.set(
      variant.productId,
      existing
    );
  }

  const allRows: InventoryRow[] =
    [];

  for (
    const product of productList
  ) {
    const variants =
      variantsByProduct.get(
        product.id
      );

    if (
      variants &&
      variants.length > 0
    ) {
      for (
        const variant of variants
      ) {
        allRows.push({
          id: variant.id,

          type: "variant",

          productId:
            product.id,

          productName:
            product.title,

          variantName:
            getVariantName(
              variant
            ),

          sku:
            variant.sku,

          stock:
            variant.stockQuantity,
        });
      }

      continue;
    }

    allRows.push({
      id: product.id,

      type: "product",

      productId:
        product.id,

      productName:
        product.title,

      variantName: null,

      sku: product.sku,

      stock:
        product.stockQuantity,
    });
  }

  const totalSkus =
    allRows.length;

  const totalUnits =
    allRows.reduce(
      (total, row) =>
        total + row.stock,
      0
    );

  const lowStockCount =
    allRows.filter(
      (row) =>
        row.stock > 0 &&
        row.stock <=
          LOW_STOCK_LIMIT
    ).length;

  const outOfStockCount =
    allRows.filter(
      (row) =>
        row.stock === 0
    ).length;

  const normalizedQuery =
    query.toLowerCase();

  const filteredRows =
    allRows.filter((row) => {
      const matchesSearch =
        !normalizedQuery ||
        row.productName
          .toLowerCase()
          .includes(
            normalizedQuery
          ) ||
        row.sku
          .toLowerCase()
          .includes(
            normalizedQuery
          ) ||
        (
          row.variantName ??
          ""
        )
          .toLowerCase()
          .includes(
            normalizedQuery
          );

      let matchesStatus =
        true;

      if (
        status === "low"
      ) {
        matchesStatus =
          row.stock > 0 &&
          row.stock <=
            LOW_STOCK_LIMIT;
      }

      if (
        status === "out"
      ) {
        matchesStatus =
          row.stock === 0;
      }

      if (
        status === "in"
      ) {
        matchesStatus =
          row.stock >
          LOW_STOCK_LIMIT;
      }

      return (
        matchesSearch &&
        matchesStatus
      );
    });

  function filterHref(
    nextStatus: string
  ) {
    const nextParams =
      new URLSearchParams();

    if (query) {
      nextParams.set(
        "q",
        query
      );
    }

    if (
      nextStatus !== "all"
    ) {
      nextParams.set(
        "status",
        nextStatus
      );
    }

    const value =
      nextParams.toString();

    return value
      ? `/admin/inventory?${value}`
      : "/admin/inventory";
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Catalog
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
          Inventory
        </h1>

        <p className="mt-1 text-sm text-neutral-500">
          Monitor and manage stock across
          products and variants.
        </p>
      </div>

      {/* SUMMARY */}
      <div className="mt-5 grid overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem
          icon={
            <Boxes size={17} />
          }
          label="Total SKUs"
          value={String(
            totalSkus
          )}
        />

        <SummaryItem
          icon={
            <PackageCheck
              size={17}
            />
          }
          label="Units in stock"
          value={String(
            totalUnits
          )}
        />

        <SummaryItem
          icon={
            <AlertTriangle
              size={17}
            />
          }
          label="Low stock"
          value={String(
            lowStockCount
          )}
        />

        <SummaryItem
          icon={
            <PackageX
              size={17}
            />
          }
          label="Out of stock"
          value={String(
            outOfStockCount
          )}
          last
        />
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <form
          method="GET"
          className="flex h-10 w-full max-w-md items-center rounded-lg border border-neutral-200 bg-neutral-50"
        >
          <Search
            size={16}
            className="ml-3 shrink-0 text-neutral-500"
          />

          <input
            type="search"
            name="q"
            aria-label="Search inventory by product or SKU"
            defaultValue={
              query
            }
            placeholder="Search product or SKU..."
            className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          />

          {status !== "all" && (
            <input
              type="hidden"
              name="status"
              value={status}
            />
          )}

          <button
            type="submit"
            className="mr-1 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-100"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          <FilterButton
            href={filterHref(
              "all"
            )}
            active={
              status === "all"
            }
          >
            All
          </FilterButton>

          <FilterButton
            href={filterHref(
              "in"
            )}
            active={
              status === "in"
            }
          >
            In stock
          </FilterButton>

          <FilterButton
            href={filterHref(
              "low"
            )}
            active={
              status === "low"
            }
          >
            Low stock
          </FilterButton>

          <FilterButton
            href={filterHref(
              "out"
            )}
            active={
              status === "out"
            }
          >
            Out of stock
          </FilterButton>
        </div>
      </div>

      {/* INVENTORY TABLE */}
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {/* TABLE HEADER */}
        <div className="hidden grid-cols-[minmax(0,1.8fr)_minmax(140px,0.8fr)_80px_125px_190px] items-center gap-5 border-b border-neutral-200 bg-background px-6 py-3.5 lg:grid">
          <Heading>
            Product
          </Heading>

          <Heading>
            SKU
          </Heading>

          <Heading>
            Stock
          </Heading>

          <Heading>
            Status
          </Heading>

          <Heading>
            Update inventory
          </Heading>
        </div>

        {filteredRows.length ===
        0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
              <Boxes
                size={19}
              />
            </div>

            <h2 className="mt-3 font-semibold text-neutral-950">
              No inventory found
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Try changing your
              search or stock filter.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 bg-background p-3 lg:block lg:divide-y lg:divide-neutral-100 lg:bg-white lg:p-0">
            {filteredRows.map(
              (row) => {
                const stockStatus =
                  getStockStatus(
                    row.stock
                  );

                return (
                  <div
                    key={`${row.type}-${row.id}`}
                    className="rounded-xl border border-border bg-white px-4 py-4 transition hover:bg-background lg:rounded-none lg:border-0 lg:px-5 lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(140px,0.8fr)_80px_125px_190px] lg:items-center lg:gap-5"
                  >
                    {/* PRODUCT */}
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${row.productId}/edit`}
                        className="block break-words lg:truncate text-[15px] font-semibold text-neutral-950 transition hover:text-[#17352c]"
                      >
                        {
                          row.productName
                        }
                      </Link>

                      {row.variantName && (
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {
                            row.variantName
                          }
                        </p>
                      )}
                    </div>

                    {/* SKU */}
                    <div className="mt-3 min-w-0 lg:mt-0">
                      <p className="block break-words lg:truncate font-mono text-xs text-neutral-600">
                        {row.sku}
                      </p>
                    </div>

                    {/* STOCK */}
                    <div className="mt-3 lg:mt-0"><p className="text-xs text-muted lg:hidden">Units in stock</p>
                      <p className="text-[15px] font-semibold tabular-nums text-neutral-950">
                        {
                          row.stock
                        }
                      </p>
                    </div>

                    {/* STATUS */}
                    <div className="mt-3 lg:mt-0">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${stockStatus.className}`}
                      >
                        {
                          stockStatus.label
                        }
                      </span>
                    </div>

                    {/* UPDATE */}
                    <form
                      action={
                        updateInventory
                      }
                      className="mt-4 flex items-center gap-2 lg:mt-0"
                    >
                      <input
                        type="hidden"
                        name="type"
                        value={
                          row.type
                        }
                      />

                      <input
                        type="hidden"
                        name="id"
                        value={
                          row.id
                        }
                      />

                      <input
                        type="number"
                        min="0"
                        step="1"
                        name="stockQuantity"
                        defaultValue={
                          row.stock
                        }
                        className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium tabular-nums outline-none transition focus:border-[#17352c] focus:ring-1 focus:ring-[#17352c]/10"
                        aria-label={`Stock quantity for ${row.productName}`}
                      />

                      <button
                        type="submit"
                        className="h-9 shrink-0 rounded-lg bg-[#17352c] px-3.5 text-xs font-semibold text-white transition hover:bg-[#24483d]"
                      >
                        Update
                      </button>
                    </form>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Low stock is defined as 5 units
        or fewer. Products with variants
        are managed using their individual
        variant inventory.
      </p>
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  last = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[88px] items-center gap-4 px-5 py-4 ${
        last
          ? ""
          : "border-b border-neutral-200 sm:border-r xl:border-b-0"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f5f4f0] text-neutral-500">
        {icon}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
          {label}
        </p>

        <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-neutral-950">
          {value}
        </p>
      </div>
    </div>
  );
}

function FilterButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
        active
          ? "border-[#17352c] bg-[#17352c] text-white"
          : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {children}
    </Link>
  );
}

function Heading({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
      {children}
    </p>
  );
}