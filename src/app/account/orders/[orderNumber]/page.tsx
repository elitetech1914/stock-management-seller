import {
  and,
  eq,
} from "drizzle-orm";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Package,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  orderItems,
  orders,
} from "@/db/schema";
import { auth } from "@/lib/auth";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

export default async function BuyerOrderPage({
  params,
}: {
  params: Promise<{
    orderNumber: string;
  }>;
}) {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session) {
    redirect("/login");
  }

  const { orderNumber } =
    await params;

  const [order] =
    await db
      .select()
      .from(orders)
      .where(
        and(
          eq(
            orders.orderNumber,
            orderNumber
          ),
          eq(
            orders.buyerUserId,
            session.user.id
          )
        )
      )
      .limit(1);

  if (!order) {
    notFound();
  }

  const items =
    await db
      .select()
      .from(orderItems)
      .where(
        eq(
          orderItems.orderId,
          order.id
        )
      );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/account/orders"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
      >
        <ArrowLeft size={14} />
        My orders
      </Link>

      {/* HEADER */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Order
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
            {order.orderNumber}
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            {formatDate(
              order.createdAt
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClasses(
              order.orderStatus
            )}`}
          >
            {formatStatus(
              order.orderStatus
            )}
          </span>

          <span
            className={
              order.paymentStatus ===
              "paid"
                ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                : "rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-600"
            }
          >
            {formatStatus(
              order.paymentStatus
            )}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* LEFT */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {/* ITEMS */}
          <section>
            <div className="border-b border-neutral-200 px-5 py-4">
              <h2 className="font-semibold text-neutral-950">
                Order items
              </h2>

              <p className="mt-0.5 text-xs text-neutral-500">
                {items.length}{" "}
                {items.length === 1
                  ? "line item"
                  : "line items"}
              </p>
            </div>

            <div className="divide-y divide-neutral-100">
              {items.map(
                (item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 px-5 py-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f5f4f0] text-neutral-500">
                      <Package
                        size={17}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-neutral-950">
                        {
                          item.productName
                        }
                      </p>

                      {item.variantName && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {
                            item.variantName
                          }
                        </p>
                      )}

                      <p className="mt-1 text-xs text-neutral-500">
                        SKU {item.sku}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {formatMoney(
                          item.lineTotalCents
                        )}
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        {item.quantity} ×{" "}
                        {formatMoney(
                          item.unitPriceCents
                        )}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* BUSINESS + SHIPPING */}
          <section className="grid border-t border-neutral-200 md:grid-cols-2">
            <div className="border-b border-neutral-200 p-5 md:border-b-0 md:border-r">
              <div className="flex items-center gap-2">
                <Building2
                  size={15}
                  className="text-neutral-500"
                />

                <h2 className="font-semibold text-neutral-950">
                  Business
                </h2>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="font-medium text-neutral-950">
                  {
                    order.companyName
                  }
                </p>

                <p className="text-neutral-600">
                  {
                    order.contactName
                  }
                </p>

                <p className="text-neutral-600">
                  {
                    order.buyerEmail
                  }
                </p>

                <p className="text-neutral-600">
                  {order.phone}
                </p>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2">
                <MapPin
                  size={15}
                  className="text-neutral-500"
                />

                <h2 className="font-semibold text-neutral-950">
                  Shipping
                </h2>
              </div>

              <div className="mt-4 text-sm leading-6 text-neutral-600">
                <p>
                  {
                    order.shippingAddressLine1
                  }
                </p>

                {order.shippingAddressLine2 && (
                  <p>
                    {
                      order.shippingAddressLine2
                    }
                  </p>
                )}

                <p>
                  {
                    order.shippingCity
                  }
                  ,{" "}
                  {
                    order.shippingState
                  }{" "}
                  {
                    order.shippingPostalCode
                  }
                </p>

                <p>
                  {
                    order.shippingCountry
                  }
                </p>
              </div>
            </div>
          </section>

          {order.notes && (
            <section className="border-t border-neutral-200 p-5">
              <h2 className="font-semibold text-neutral-950">
                Order notes
              </h2>

              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-600">
                {order.notes}
              </p>
            </section>
          )}
        </div>

        {/* SUMMARY */}
        <aside className="self-start">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-neutral-950">
              Order summary
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow
                label="Subtotal"
                value={formatMoney(
                  order.subtotalCents
                )}
              />

              <SummaryRow
                label="Shipping"
                value={formatMoney(
                  order.shippingCents
                )}
              />

              <SummaryRow
                label="Tax"
                value={formatMoney(
                  order.taxCents
                )}
              />

              <div className="flex justify-between border-t border-neutral-200 pt-3">
                <span className="font-semibold text-neutral-950">
                  Total
                </span>

                <span className="text-lg font-semibold text-neutral-950">
                  {formatMoney(
                    order.totalCents
                  )}
                </span>
              </div>
            </div>

            <div className="mt-5 border-t border-neutral-200 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Current status
              </p>

              <p className="mt-1 text-sm font-semibold text-neutral-950">
                {formatStatus(
                  order.orderStatus
                )}
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Your order status is
                updated by the Stockmora
                team as fulfillment
                progresses.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
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
    <div className="flex justify-between gap-4">
      <span className="text-neutral-500">
        {label}
      </span>

      <span className="font-medium text-neutral-950">
        {value}
      </span>
    </div>
  );
}