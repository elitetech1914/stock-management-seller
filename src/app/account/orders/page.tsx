import {
  desc,
  eq,
} from "drizzle-orm";
import {
  ArrowLeft,
  PackageCheck,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { auth } from "@/lib/auth";

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

export default async function AccountOrdersPage() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session) {
    redirect("/login");
  }

  const buyerOrders =
    await db
      .select({
        id: orders.id,
        orderNumber:
          orders.orderNumber,
        totalCents:
          orders.totalCents,
        orderStatus:
          orders.orderStatus,
        paymentStatus:
          orders.paymentStatus,
        createdAt:
          orders.createdAt,
      })
      .from(orders)
      .where(
        eq(
          orders.buyerUserId,
          session.user.id
        )
      )
      .orderBy(
        desc(orders.createdAt)
      );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/account"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
      >
        <ArrowLeft size={14} />
        Account
      </Link>

      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          Buyer account
        </p>

        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
          My orders
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Track your wholesale order
          history and fulfillment status.
        </p>
      </div>

      {buyerOrders.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
          <PackageCheck
            size={22}
            className="mx-auto text-neutral-400"
          />

          <h2 className="mt-4 font-semibold text-neutral-950">
            No orders yet
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Your submitted orders will
            appear here.
          </p>

          <Link
            href="/products"
            className="mt-5 inline-flex h-10 items-center rounded-lg bg-[#17352c] px-5 text-sm font-semibold text-white"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr] gap-4 border-b border-neutral-200 bg-[#fafaf8] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400 sm:grid">
            <div>Order</div>
            <div>Total</div>
            <div>Status</div>
            <div>Payment</div>
          </div>

          <div className="divide-y divide-neutral-100">
            {buyerOrders.map(
              (order) => (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.orderNumber}`}
                  className="block px-5 py-5 transition hover:bg-[#fafaf8] sm:grid sm:grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr] sm:items-center sm:gap-4"
                >
                  <div>
                    <p className="text-[15px] font-semibold text-neutral-950">
                      {
                        order.orderNumber
                      }
                    </p>

                    <p className="mt-1 text-xs text-neutral-400">
                      {formatDate(
                        order.createdAt
                      )}
                    </p>
                  </div>

                  <div className="mt-3 text-sm font-semibold sm:mt-0">
                    {formatMoney(
                      order.totalCents
                    )}
                  </div>

                  <div className="mt-3 sm:mt-0">
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

                  <div className="mt-3 sm:mt-0">
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
    </main>
  );
}