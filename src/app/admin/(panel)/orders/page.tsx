import { desc } from "drizzle-orm";
import {
  CircleDollarSign,
  Clock3,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { orders } from "@/db/schema";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStatus(value: string) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function statusClasses(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "confirmed":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "processing":
      return "bg-violet-50 text-violet-700 border-violet-200";

    case "shipped":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";

    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
  }
}

export default async function AdminOrdersPage() {
  const orderList = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      companyName: orders.companyName,
      contactName: orders.contactName,
      buyerEmail: orders.buyerEmail,
      totalCents: orders.totalCents,
      orderStatus: orders.orderStatus,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt));

  const totalOrders = orderList.length;

  const pendingOrders = orderList.filter(
    (order) => order.orderStatus === "pending"
  ).length;

  const activeOrders = orderList.filter(
    (order) =>
      order.orderStatus === "confirmed" ||
      order.orderStatus === "processing" ||
      order.orderStatus === "shipped"
  ).length;

  const paidRevenue = orderList
    .filter(
      (order) =>
        order.paymentStatus === "paid"
    )
    .reduce(
      (total, order) =>
        total + order.totalCents,
      0
    );

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Order management
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
          Orders
        </h1>

        <p className="mt-1 text-sm text-neutral-500">
          Review and manage wholesale orders.
        </p>
      </div>

      {/* SUMMARY STRIP */}
      <div className="mb-5 grid overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem
          icon={<ShoppingBag size={16} />}
          label="Total orders"
          value={String(totalOrders)}
        />

        <SummaryItem
          icon={<Clock3 size={16} />}
          label="Pending"
          value={String(pendingOrders)}
        />

        <SummaryItem
          icon={<PackageCheck size={16} />}
          label="Active"
          value={String(activeOrders)}
        />

        <SummaryItem
          icon={
            <CircleDollarSign size={16} />
          }
          label="Paid revenue"
          value={formatMoney(
            paidRevenue
          )}
          last
        />
      </div>

      {/* ORDERS TABLE */}
      {orderList.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
            <ShoppingBag size={19} />
          </div>

          <h2 className="mt-4 font-semibold text-neutral-950">
            No orders yet
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Orders will appear here when buyers
            submit them.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {/* HEADER */}
          <div className="hidden grid-cols-[1.45fr_1.5fr_0.7fr_0.85fr_0.8fr] gap-4 border-b border-neutral-200 bg-background px-6 py-3.5 lg:grid">
            <TableHeading>
              Order
            </TableHeading>

            <TableHeading>
              Customer
            </TableHeading>

            <div className="text-right"><TableHeading>Total</TableHeading></div>

            <TableHeading>
              Status
            </TableHeading>

            <TableHeading>
              Payment
            </TableHeading>
          </div>

          <div className="grid gap-3 bg-background p-3 lg:block lg:divide-y lg:divide-neutral-100 lg:bg-white lg:p-0">
            {orderList.map(
              (order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="block rounded-xl border border-border bg-white px-4 py-4 transition hover:bg-background lg:rounded-none lg:border-0 lg:px-5 lg:grid lg:grid-cols-[1.45fr_1.5fr_0.7fr_0.85fr_0.8fr] lg:items-center lg:gap-4"
                >
                  {/* ORDER */}
                  <div>
                    <p className="text-[15px] font-semibold text-neutral-950">
                      {order.orderNumber}
                    </p>

                    <p className="mt-1 text-xs text-neutral-500">
                      {formatDate(
                        order.createdAt
                      )}
                    </p>
                  </div>

                  {/* CUSTOMER */}
                  <div className="mt-3 min-w-0 lg:mt-0">
                    <p className="break-words lg:truncate text-[15px] font-medium text-neutral-900">
                      {
                        order.companyName
                      }
                    </p>

                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {
                        order.contactName
                      }
                      {" · "}
                      {
                        order.buyerEmail
                      }
                    </p>
                  </div>

                  {/* TOTAL */}
                  <div className="mt-3 lg:mt-0 lg:text-right"><p className="text-xs text-muted lg:hidden">Total</p>
                    <p className="text-[15px] font-semibold text-neutral-950">
                      {formatMoney(
                        order.totalCents
                      )}
                    </p>
                  </div>

                  {/* STATUS */}
                  <div className="mt-3 lg:mt-0"><p className="mb-1 text-xs text-muted lg:hidden">Order status</p>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                        order.orderStatus
                      )}`}
                    >
                      {formatStatus(
                        order.orderStatus
                      )}
                    </span>
                  </div>

                  {/* PAYMENT */}
                  <div className="mt-3 lg:mt-0"><p className="mb-1 text-xs text-muted lg:hidden">Payment</p>
                    <span
                      className={
                        order.paymentStatus ===
                        "paid"
                          ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600"
                      }
                    >
                      {formatStatus(
                        order.paymentStatus
                      )}
                    </span>
                  </div>
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ReactNode;
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

function TableHeading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
      {children}
    </p>
  );
}