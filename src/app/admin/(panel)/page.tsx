import {
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Package,
  PackageX,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { db } from "@/db";
import {
  orders,
  products,
  productVariants,
} from "@/db/schema";

const LOW_STOCK_LIMIT = 5;

type RecentCustomer = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

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

function formatDate(
  value: Date | string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date(value));
}

function formatStatus(
  value: string
) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function orderStatusClasses(
  status: string
) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "confirmed":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "processing":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "shipped":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";

    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-700";
  }
}

export default async function AdminDashboardPage() {
  const [
    productCountResult,
    orderCountResult,
    revenueResult,
    openOrderResult,
    recentOrders,
    productInventory,
    variantInventory,
    customerResult,
    recentCustomerResult,
  ] = await Promise.all([
    db
      .select({
        count:
          sql<number>`count(*)::int`,
      })
      .from(products)
      .where(
        eq(
          products.isActive,
          true
        )
      ),

    db
      .select({
        count:
          sql<number>`count(*)::int`,
      })
      .from(orders),

    db
      .select({
        total:
          sql<number>`
            coalesce(
              sum(
                case
                  when ${orders.paymentStatus} = 'paid'
                  then ${orders.totalCents}
                  else 0
                end
              ),
              0
            )::int
          `,
      })
      .from(orders),

    db
      .select({
        count:
          sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        inArray(
          orders.orderStatus,
          [
            "pending",
            "confirmed",
            "processing",
            "shipped",
          ]
        )
      ),

    db
      .select({
        id: orders.id,

        orderNumber:
          orders.orderNumber,

        companyName:
          orders.companyName,

        contactName:
          orders.contactName,

        buyerEmail:
          orders.buyerEmail,

        totalCents:
          orders.totalCents,

        orderStatus:
          orders.orderStatus,

        createdAt:
          orders.createdAt,
      })
      .from(orders)
      .orderBy(
        desc(orders.createdAt)
      )
      .limit(5),

    db
      .select({
        id: products.id,

        title:
          products.title,

        sku:
          products.sku,

        stockQuantity:
          products.stockQuantity,
      })
      .from(products)
      .where(
        eq(
          products.isActive,
          true
        )
      ),

    db
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
      ),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS "count"
      FROM "user"
      WHERE
        COALESCE(role, 'user') <> 'admin'
    `),

    db.execute(sql`
      SELECT
        id,
        name,
        email,
        "createdAt"
      FROM "user"
      WHERE
        COALESCE(role, 'user') <> 'admin'
      ORDER BY "createdAt" DESC
      LIMIT 5
    `),
  ]);

  const totalProducts =
    Number(
      productCountResult[0]
        ?.count ?? 0
    );

  const totalOrders =
    Number(
      orderCountResult[0]
        ?.count ?? 0
    );

  const paidRevenue =
    Number(
      revenueResult[0]
        ?.total ?? 0
    );

  const openOrders =
    Number(
      openOrderResult[0]
        ?.count ?? 0
    );

  const totalCustomers =
    Number(
      (
        customerResult
          .rows[0] as
          | {
              count: number;
            }
          | undefined
      )?.count ?? 0
    );

  const recentCustomers =
    recentCustomerResult
      .rows as unknown as RecentCustomer[];

  const variantsByProduct =
    new Map<
      string,
      typeof variantInventory
    >();

  for (
    const variant of variantInventory
  ) {
    const existing =
      variantsByProduct.get(
        variant.productId
      ) ?? [];

    existing.push(
      variant
    );

    variantsByProduct.set(
      variant.productId,
      existing
    );
  }

  const inventoryRows: {
    name: string;
    sku: string;
    stock: number;
  }[] = [];

  for (
    const product of productInventory
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
        const variantName = [
          variant.option1Value,
          variant.option2Value,
          variant.option3Value,
        ]
          .filter(Boolean)
          .join(" / ");

        inventoryRows.push({
          name: variantName
            ? `${product.title} — ${variantName}`
            : product.title,

          sku: variant.sku,

          stock:
            variant.stockQuantity,
        });
      }

      continue;
    }

    inventoryRows.push({
      name:
        product.title,

      sku:
        product.sku,

      stock:
        product.stockQuantity,
    });
  }

  const lowStockItems =
    inventoryRows.filter(
      (item) =>
        item.stock > 0 &&
        item.stock <=
          LOW_STOCK_LIMIT
    );

  const outOfStockItems =
    inventoryRows.filter(
      (item) =>
        item.stock === 0
    );

  const inventoryAlerts = [
    ...outOfStockItems.map(
      (item) => ({
        ...item,
        status:
          "Out of stock",
      })
    ),

    ...lowStockItems.map(
      (item) => ({
        ...item,
        status:
          "Low stock",
      })
    ),
  ].slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Administration
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
            Overview
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            Store performance
            and operations at a
            glance.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/products/new"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Add product
          </Link>

          <Link
            href="/admin/orders"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#17352c] px-4 text-xs font-semibold text-white transition hover:bg-[#24483d]"
          >
            View orders
          </Link>
        </div>
      </div>

      <h2 className="mt-7 text-base font-semibold">Needs attention</h2>
      {/* OPERATIONAL METRICS */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <CompactMetric
          icon={
            <ShoppingCart
              size={15}
            />
          }
          label="Open orders"
          value={String(
            openOrders
          )}
          href="/admin/orders"
        />

        <CompactMetric
          icon={
            <AlertTriangle
              size={15}
            />
          }
          label="Low stock"
          value={String(
            lowStockItems.length
          )}
          href="/admin/inventory?status=low"
        />

        <CompactMetric
          icon={
            <PackageX
              size={15}
            />
          }
          label="Out of stock"
          value={String(
            outOfStockItems.length
          )}
          href="/admin/inventory?status=out"
        />
      </div>

      <h2 className="mt-7 text-base font-semibold">Store performance</h2>
      {/* PRIMARY METRICS */}
      <div className="mt-5 grid overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={
            <Package size={17} />
          }
          label="Active products"
          value={String(
            totalProducts
          )}
        />

        <Metric
          icon={
            <UsersRound
              size={17}
            />
          }
          label="Customers"
          value={String(
            totalCustomers
          )}
        />

        <Metric
          icon={
            <ShoppingCart
              size={17}
            />
          }
          label="Total orders"
          value={String(
            totalOrders
          )}
        />

        <Metric
          icon={
            <CircleDollarSign
              size={17}
            />
          }
          label="Paid revenue"
          value={formatMoney(
            paidRevenue
          )}
          last
        />
      </div>

      {/* TOP CONTENT */}
      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* RECENT ORDERS */}
        <section className="h-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SectionHeader
            title="Recent orders"
            description="Latest wholesale orders received."
            href="/admin/orders"
            action="View all"
          />

          {recentOrders.length ===
          0 ? (
            <EmptyState
              icon={
                <ShoppingCart
                  size={19}
                />
              }
              title="No orders yet"
              description="New customer orders will appear here."
            />
          ) : (
            <>
              <div className="hidden grid-cols-[1.15fr_1.2fr_0.65fr_0.7fr] gap-5 border-b border-neutral-200 bg-background px-5 py-3 lg:grid">
                <Heading>
                  Order
                </Heading>

                <Heading>
                  Customer
                </Heading>

                <Heading>
                  Total
                </Heading>

                <Heading>
                  Status
                </Heading>
              </div>

              <div className="divide-y divide-neutral-100">
                {recentOrders.map(
                  (order) => (
                    <Link
                      key={
                        order.id
                      }
                      href={`/admin/orders/${order.id}`}
                      className="block px-5 py-4 transition hover:bg-background lg:grid lg:grid-cols-[1.15fr_1.2fr_0.65fr_0.7fr] lg:items-center lg:gap-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-950">
                          {
                            order.orderNumber
                          }
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          {formatDate(
                            order.createdAt
                          )}
                        </p>
                      </div>

                      <div className="mt-3 min-w-0 lg:mt-0">
                        <p className="truncate text-sm font-medium text-neutral-800">
                          {order.companyName ||
                            order.contactName ||
                            order.buyerEmail}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          {
                            order.buyerEmail
                          }
                        </p>
                      </div>

                      <div className="mt-3 lg:mt-0">
                        <p className="text-sm font-semibold tabular-nums text-neutral-950">
                          {formatMoney(
                            order.totalCents
                          )}
                        </p>
                      </div>

                      <div className="mt-3 lg:mt-0">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${orderStatusClasses(
                            order.orderStatus
                          )}`}
                        >
                          {formatStatus(
                            order.orderStatus
                          )}
                        </span>
                      </div>
                    </Link>
                  )
                )}
              </div>
            </>
          )}
        </section>

        {/* INVENTORY ALERTS */}
        <section className="h-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SectionHeader
            title="Inventory attention"
            description="Items that may need restocking."
            href="/admin/inventory"
            action="Inventory"
          />

          {inventoryAlerts.length ===
          0 ? (
            <EmptyState
              icon={
                <Boxes
                  size={19}
                />
              }
              title="Inventory looks good"
              description="No low-stock or out-of-stock items."
            />
          ) : (
            <div className="divide-y divide-neutral-100">
              {inventoryAlerts.map(
                (
                  item,
                  index
                ) => (
                  <Link
                    key={`${item.sku}-${index}`}
                    href={
                      item.stock ===
                      0
                        ? "/admin/inventory?status=out"
                        : "/admin/inventory?status=low"
                    }
                    className="flex items-center justify-between gap-5 px-5 py-4 transition hover:bg-background"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-950">
                        {
                          item.name
                        }
                      </p>

                      <p className="mt-1 truncate font-mono text-xs text-neutral-500">
                        {
                          item.sku
                        }
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-neutral-950">
                        {
                          item.stock
                        }
                      </p>

                      <p
                        className={`mt-0.5 text-xs font-semibold ${
                          item.stock ===
                          0
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      >
                        {
                          item.status
                        }
                      </p>
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {/* BOTTOM CONTENT */}
      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* RECENT CUSTOMERS */}
        <section className="h-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SectionHeader
            title="Recent customers"
            description="Latest registered buyer accounts."
            href="/admin/customers"
            action="View all"
          />

          {recentCustomers.length ===
          0 ? (
            <EmptyState
              icon={
                <UsersRound
                  size={19}
                />
              }
              title="No customers yet"
              description="New buyer accounts will appear here."
            />
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentCustomers.map(
                (customer) => (
                  <Link
                    key={
                      customer.id
                    }
                    href={`/admin/customers/${customer.id}`}
                    className="flex items-center justify-between gap-6 px-5 py-4 transition hover:bg-background"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-950">
                        {
                          customer.name
                        }
                      </p>

                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {
                          customer.email
                        }
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-xs text-neutral-500">
                        {formatDate(
                          customer.createdAt
                        )}
                      </p>

                      <ArrowRight
                        size={14}
                        className="text-neutral-300"
                      />
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>

        {/* QUICK ACTIONS */}
        <section className="self-start overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="font-semibold text-neutral-950">
              Quick actions
            </h2>

            <p className="mt-0.5 text-xs text-neutral-500">
              Common administration
              tasks.
            </p>
          </div>

          <div className="p-2">
            <QuickAction
              href="/admin/products/new"
              label="Add product"
              description="Create a new catalog item."
            />

            <QuickAction
              href="/admin/import"
              label="Import products"
              description="Upload products using CSV."
            />

            <QuickAction
              href="/admin/orders"
              label="Manage orders"
              description="Review fulfillment and payments."
            />

            <QuickAction
              href="/admin/inventory"
              label="Update inventory"
              description="Review and adjust stock."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
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

      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
          {label}
        </p>

        <p className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] text-neutral-950">
          {value}
        </p>
      </div>
    </div>
  );
}

function CompactMetric({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[72px] items-center justify-between rounded-xl border border-neutral-200 bg-white px-5 py-3.5 shadow-sm transition hover:border-neutral-300 hover:bg-background"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5f4f0] text-neutral-500">
          {icon}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            {label}
          </p>

          <p className="mt-0.5 text-lg font-semibold text-neutral-950">
            {value}
          </p>
        </div>
      </div>

      <ArrowRight
        size={14}
        className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-700"
      />
    </Link>
  );
}

function SectionHeader({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4">
      <div className="min-w-0">
        <h2 className="font-semibold text-neutral-950">
          {title}
        </h2>

        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {description}
        </p>
      </div>

      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-500 transition hover:text-neutral-950"
      >
        {action}

        <ArrowRight
          size={13}
        />
      </Link>
    </div>
  );
}

function QuickAction({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition hover:bg-background"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">
          {label}
        </p>

        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {description}
        </p>
      </div>

      <ArrowRight
        size={14}
        className="shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-700"
      />
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center px-6 py-9 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
        {icon}
      </div>

      <p className="mt-3 text-sm font-semibold text-neutral-950">
        {title}
      </p>

      <p className="mt-1 max-w-xs text-xs leading-5 text-neutral-500">
        {description}
      </p>
    </div>
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