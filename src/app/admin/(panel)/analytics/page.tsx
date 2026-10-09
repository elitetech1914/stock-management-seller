import {
  desc,
  eq,
  gte,
  sql,
} from "drizzle-orm";
import {
  BarChart3,
  CircleDollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { db } from "@/db";
import {
  orderItems,
  orders,
} from "@/db/schema";

type MonthData = {
  key: string;
  label: string;
  revenue: number;
  orders: number;
};

type CustomerCountRow = {
  count: number;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatCompactMoney(
  cents: number
) {
  const dollars =
    cents / 100;

  if (dollars >= 1_000_000) {
    return `$${(
      dollars / 1_000_000
    ).toFixed(1)}M`;
  }

  if (dollars >= 1_000) {
    return `$${(
      dollars / 1_000
    ).toFixed(1)}K`;
  }

  return `$${Math.round(
    dollars
  )}`;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}`;
}

function createMonths(
  count: number
) {
  const now =
    new Date();

  const result: MonthData[] =
    [];

  for (
    let offset = count - 1;
    offset >= 0;
    offset--
  ) {
    const date =
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() -
            offset,
          1
        )
      );

    result.push({
      key: monthKey(date),

      label:
        new Intl.DateTimeFormat(
          "en-US",
          {
            month: "short",
          }
        ).format(date),

      revenue: 0,
      orders: 0,
    });
  }

  return result;
}

function statusLabel(
  status: string
) {
  return (
    status
      .charAt(0)
      .toUpperCase() +
    status.slice(1)
  );
}

function statusColor(
  status: string
) {
  switch (status) {
    case "pending":
      return "bg-amber-500";

    case "confirmed":
      return "bg-blue-500";

    case "processing":
      return "bg-violet-500";

    case "shipped":
      return "bg-cyan-500";

    case "completed":
      return "bg-emerald-500";

    case "cancelled":
      return "bg-red-500";

    default:
      return "bg-neutral-400";
  }
}

export default async function AnalyticsPage() {
  const months =
    createMonths(6);

  const firstMonth =
    months[0];

  const firstMonthDate =
    new Date(
      `${firstMonth.key}-01T00:00:00.000Z`
    );

  const [
    allOrders,
    recentOrders,
    customerResult,
    topProducts,
  ] = await Promise.all([
    db
      .select({
        id: orders.id,

        totalCents:
          orders.totalCents,

        orderStatus:
          orders.orderStatus,

        paymentStatus:
          orders.paymentStatus,

        createdAt:
          orders.createdAt,
      })
      .from(orders),

    db
      .select({
        id: orders.id,

        totalCents:
          orders.totalCents,

        paymentStatus:
          orders.paymentStatus,

        createdAt:
          orders.createdAt,
      })
      .from(orders)
      .where(
        gte(
          orders.createdAt,
          firstMonthDate
        )
      ),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS "count"
      FROM "user"
      WHERE
        COALESCE(role, 'user')
        <> 'admin'
    `),

    db
      .select({
        productName:
          orderItems.productName,

        sku:
          orderItems.sku,

        unitsSold:
          sql<number>`
            COALESCE(
              SUM(
                ${orderItems.quantity}
              ),
              0
            )::int
          `,

        revenueCents:
          sql<number>`
            COALESCE(
              SUM(
                ${orderItems.lineTotalCents}
              ),
              0
            )::int
          `,
      })
      .from(orderItems)
      .innerJoin(
        orders,
        eq(
          orderItems.orderId,
          orders.id
        )
      )
      .where(
        eq(
          orders.paymentStatus,
          "paid"
        )
      )
      .groupBy(
        orderItems.productName,
        orderItems.sku
      )
      .orderBy(
        desc(
          sql`
            SUM(
              ${orderItems.lineTotalCents}
            )
          `
        )
      )
      .limit(5),
  ]);

  const totalOrders =
    allOrders.length;

  const paidOrders =
    allOrders.filter(
      (order) =>
        order.paymentStatus ===
        "paid"
    );

  const paidRevenue =
    paidOrders.reduce(
      (total, order) =>
        total +
        order.totalCents,
      0
    );

  const averageOrderValue =
    paidOrders.length > 0
      ? Math.round(
          paidRevenue /
            paidOrders.length
        )
      : 0;

  const totalCustomers =
    Number(
      (
        customerResult.rows[
          0
        ] as
          | CustomerCountRow
          | undefined
      )?.count ?? 0
    );

  /*
   * SIX-MONTH TREND
   */
  const monthMap =
    new Map(
      months.map(
        (month) => [
          month.key,
          month,
        ]
      )
    );

  for (
    const order of recentOrders
  ) {
    const key =
      monthKey(
        new Date(
          order.createdAt
        )
      );

    const month =
      monthMap.get(key);

    if (!month) {
      continue;
    }

    month.orders += 1;

    if (
      order.paymentStatus ===
      "paid"
    ) {
      month.revenue +=
        order.totalCents;
    }
  }

  const maxRevenue =
    Math.max(
      ...months.map(
        (month) =>
          month.revenue
      ),
      1
    );

  /*
   * ORDER STATUS BREAKDOWN
   */
  const statusOrder = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "completed",
    "cancelled",
  ];

  const statusCounts =
    statusOrder.map(
      (status) => ({
        status,

        count:
          allOrders.filter(
            (order) =>
              order.orderStatus ===
              status
          ).length,
      })
    );

  const maxStatusCount =
    Math.max(
      ...statusCounts.map(
        (item) =>
          item.count
      ),
      1
    );

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Reporting
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
          Analytics
        </h1>

        <p className="mt-1 text-sm text-neutral-500">
          Track store performance,
          sales and customer
          activity.
        </p>
      </div>

      {/* METRICS */}
      <div className="mt-5 grid overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
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
            <TrendingUp
              size={17}
            />
          }
          label="Avg. order value"
          value={formatMoney(
            averageOrderValue
          )}
          last
        />
      </div>

      {/* MAIN CHARTS */}
      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* REVENUE TREND */}
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SectionHeading
            icon={
              <BarChart3
                size={17}
              />
            }
            title="Revenue trend"
            description="Paid revenue over the last 6 months."
          />

          <div className="px-3 pb-6 pt-7 sm:px-6">
            <div className="flex h-[260px] items-end gap-2 sm:gap-4 border-b border-neutral-200">
              {months.map(
                (month) => {
                  const height =
                    month.revenue >
                    0
                      ? Math.max(
                          8,
                          Math.round(
                            (month.revenue /
                              maxRevenue) *
                              200
                          )
                        )
                      : 3;

                  return (
                    <div
                      key={
                        month.key
                      }
                      className="flex h-full min-w-0 flex-1 flex-col justify-end"
                    >
                      <div className="mb-2 text-center">
                        <p className="truncate text-xs font-semibold text-neutral-700">
                          {formatCompactMoney(
                            month.revenue
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-neutral-500">
                          {
                            month.orders
                          }{" "}
                          {month.orders ===
                          1
                            ? "order"
                            : "orders"}
                        </p>
                      </div>

                      <div className="flex h-[200px] items-end justify-center">
                        <div
                          className="w-full max-w-[72px] rounded-t-md bg-[#17352c] transition"
                          style={{
                            height: `${height}px`,
                          }}
                        />
                      </div>

                      <p className="py-3 text-center text-xs font-medium text-neutral-500">
                        {
                          month.label
                        }
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </section>

        {/* STATUS */}
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SectionHeading
            icon={
              <ShoppingCart
                size={17}
              />
            }
            title="Order status"
            description="Current order distribution."
          />

          <div className="space-y-5 p-5">
            {statusCounts.map(
              (item) => (
                <div
                  key={
                    item.status
                  }
                >
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${statusColor(
                          item.status
                        )}`}
                      />

                      <p className="text-sm font-medium text-neutral-700">
                        {statusLabel(
                          item.status
                        )}
                      </p>
                    </div>

                    <p className="text-sm font-semibold tabular-nums text-neutral-950">
                      {
                        item.count
                      }
                    </p>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${statusColor(
                        item.status
                      )}`}
                      style={{
                        width: `${
                          item.count >
                          0
                            ? Math.max(
                                5,
                                (item.count /
                                  maxStatusCount) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      </div>

      {/* BOTTOM */}
      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* TOP PRODUCTS */}
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SectionHeading
            icon={
              <Package
                size={17}
              />
            }
            title="Top products"
            description="Best-selling products based on paid orders."
          />

          {topProducts.length ===
          0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                <Package
                  size={18}
                />
              </div>

              <p className="mt-3 text-sm font-semibold text-neutral-950">
                No sales data yet
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                Paid orders will
                populate product
                performance.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_160px_110px_130px] gap-5 border-b border-neutral-200 bg-background px-5 py-3.5 lg:grid">
                <Heading>
                  Product
                </Heading>

                <Heading>
                  SKU
                </Heading>

                <Heading>
                  Units
                </Heading>

                <Heading>
                  Revenue
                </Heading>
              </div>

              <div className="divide-y divide-neutral-100">
                {topProducts.map(
                  (
                    product,
                    index
                  ) => (
                    <div
                      key={`${product.sku}-${index}`}
                      className="px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_160px_110px_130px] lg:items-center lg:gap-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-950">
                          {
                            product.productName
                          }
                        </p>
                      </div>

                      <div className="mt-2 min-w-0 lg:mt-0">
                        <p className="truncate font-mono text-xs text-neutral-500">
                          {product.sku ||
                            "—"}
                        </p>
                      </div>

                      <div className="mt-2 lg:mt-0">
                        <p className="text-sm font-semibold tabular-nums text-neutral-950">
                          {Number(
                            product.unitsSold
                          )}
                        </p>
                      </div>

                      <div className="mt-2 lg:mt-0">
                        <p className="text-sm font-semibold tabular-nums text-neutral-950">
                          {formatMoney(
                            Number(
                              product.revenueCents
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </section>

        {/* SALES SUMMARY */}
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <SectionHeading
            icon={
              <CircleDollarSign
                size={17}
              />
            }
            title="Sales summary"
            description="Quick performance breakdown."
          />

          <div className="divide-y divide-neutral-100">
            <SummaryRow
              label="All orders"
              value={String(
                totalOrders
              )}
            />

            <SummaryRow
              label="Paid orders"
              value={String(
                paidOrders.length
              )}
            />

            <SummaryRow
              label="Unpaid orders"
              value={String(
                totalOrders -
                  paidOrders.length
              )}
            />

            <SummaryRow
              label="Paid revenue"
              value={formatMoney(
                paidRevenue
              )}
            />

            <SummaryRow
              label="Average paid order"
              value={formatMoney(
                averageOrderValue
              )}
            />

            <SummaryRow
              label="Registered customers"
              value={String(
                totalCustomers
              )}
            />
          </div>
        </section>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Revenue analytics use
        orders marked as paid.
        Cancelled or unpaid orders
        do not contribute to paid
        revenue.
      </p>
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

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f5f4f0] text-neutral-500">
        {icon}
      </div>

      <div className="min-w-0">
        <h2 className="font-semibold text-neutral-950">
          {title}
        </h2>

        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 px-5 py-4">
      <p className="text-sm text-neutral-500">
        {label}
      </p>

      <p className="text-sm font-semibold tabular-nums text-neutral-950">
        {value}
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