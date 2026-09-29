import {
  and,
  desc,
  eq,
  inArray,
} from "drizzle-orm";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  PackageCheck,
  ShoppingBag,
  Truck,
  UserRound,
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

export default async function AccountPage() {
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

  const totalOrders =
    buyerOrders.length;

  const inProgress =
    buyerOrders.filter(
      (order) =>
        order.orderStatus ===
          "pending" ||
        order.orderStatus ===
          "confirmed" ||
        order.orderStatus ===
          "processing"
    ).length;

  const shipped =
    buyerOrders.filter(
      (order) =>
        order.orderStatus ===
        "shipped"
    ).length;

  const completed =
    buyerOrders.filter(
      (order) =>
        order.orderStatus ===
        "completed"
    ).length;

  const recentOrders =
    buyerOrders.slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Buyer account
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
            Welcome back,{" "}
            {session.user.name}
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            Track your wholesale orders
            and account activity.
          </p>
        </div>

        <Link
          href="/products"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Continue shopping
        </Link>
      </div>

      {/* ACCOUNT INFO */}
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5f4f0] text-neutral-600">
          <UserRound size={18} />
        </div>

        <div className="min-w-0">
          <p className="font-semibold text-neutral-950">
            {session.user.name}
          </p>

          <p className="truncate text-sm text-neutral-500">
            {session.user.email}
          </p>
        </div>
      </div>

      {/* STATS */}
      <div className="mb-7 grid overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={
            <ShoppingBag size={16} />
          }
          label="Total orders"
          value={String(totalOrders)}
        />

        <Stat
          icon={<Clock3 size={16} />}
          label="In progress"
          value={String(inProgress)}
        />

        <Stat
          icon={<Truck size={16} />}
          label="Shipped"
          value={String(shipped)}
        />

        <Stat
          icon={
            <CheckCircle2 size={16} />
          }
          label="Completed"
          value={String(completed)}
          last
        />
      </div>

      {/* RECENT ORDERS */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              Recent orders
            </h2>

            <p className="mt-0.5 text-sm text-neutral-500">
              Your latest wholesale
              purchases.
            </p>
          </div>

          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#17352c] hover:underline"
          >
            View all

            <ArrowRight size={14} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
              <PackageCheck
                size={19}
              />
            </div>

            <h3 className="mt-4 font-semibold text-neutral-950">
              No orders yet
            </h3>

            <p className="mt-1 text-sm text-neutral-500">
              Your wholesale orders will
              appear here after checkout.
            </p>

            <Link
              href="/products"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#24483d]"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-neutral-200 bg-[#fafaf8] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400 sm:grid">
              <div>Order</div>
              <div>Total</div>
              <div>Status</div>
              <div>Payment</div>
            </div>

            <div className="divide-y divide-neutral-100">
              {recentOrders.map(
                (order) => (
                  <Link
                    key={order.id}
                    href={`/account/orders/${order.orderNumber}`}
                    className="block px-5 py-4 transition hover:bg-[#fafaf8] sm:grid sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] sm:items-center sm:gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">
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

                    <div className="mt-3 text-sm font-semibold text-neutral-950 sm:mt-0">
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
      </section>
    </main>
  );
}

function Stat({
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
      className={`flex min-h-[82px] items-center gap-3 px-5 py-4 ${
        last
          ? ""
          : "border-b border-neutral-200 sm:border-r lg:border-b-0"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f5f4f0] text-neutral-500">
        {icon}
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-400">
          {label}
        </p>

        <p className="mt-0.5 text-xl font-semibold text-neutral-950">
          {value}
        </p>
      </div>
    </div>
  );
}