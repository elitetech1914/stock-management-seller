import {
  and,
  eq,
} from "drizzle-orm";
import {
  ArrowRight,
  CheckCircle2,
  Package,
} from "lucide-react";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Order Placed | Stockmora",
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

function formatStatus(
  value: string
) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

export default async function OrderSuccessPage({
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
      .select({
        id: orders.id,
        orderNumber:
          orders.orderNumber,
        companyName:
          orders.companyName,
        subtotalCents:
          orders.subtotalCents,
        shippingCents:
          orders.shippingCents,
        taxCents:
          orders.taxCents,
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
      .select({
        id: orderItems.id,
        productName:
          orderItems.productName,
        variantName:
          orderItems.variantName,
        sku: orderItems.sku,
        unitPriceCents:
          orderItems.unitPriceCents,
        quantity:
          orderItems.quantity,
        lineTotalCents:
          orderItems.lineTotalCents,
      })
      .from(orderItems)
      .where(
        eq(
          orderItems.orderId,
          order.id
        )
      );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2
            size={24}
          />
        </div>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Order received
        </p>

        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
          Thank you for your order
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Your wholesale order has been
          submitted successfully. Our
          team can now review and process
          it.
        </p>

        <div className="mt-7 grid overflow-hidden rounded-xl border border-neutral-200 sm:grid-cols-3">
          <div className="border-b border-neutral-200 px-4 py-3 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              Order number
            </p>

            <p className="mt-1 text-sm font-semibold text-neutral-950">
              {order.orderNumber}
            </p>
          </div>

          <div className="border-b border-neutral-200 px-4 py-3 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              Order status
            </p>

            <p className="mt-1 text-sm font-semibold text-amber-700">
              {formatStatus(
                order.orderStatus
              )}
            </p>
          </div>

          <div className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
              Payment
            </p>

            <p className="mt-1 text-sm font-semibold text-neutral-950">
              {formatStatus(
                order.paymentStatus
              )}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-950">
            Order items
          </h2>

          <div className="mt-4 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                  <Package
                    size={17}
                    className="text-neutral-500"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-950">
                    {item.productName}
                  </p>

                  {item.variantName && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {item.variantName}
                    </p>
                  )}

                  <p className="mt-1 text-xs text-neutral-400">
                    SKU {item.sku}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-neutral-950">
                    {formatMoney(
                      item.lineTotalCents
                    )}
                  </p>

                  <p className="mt-0.5 text-xs text-neutral-500">
                    {item.quantity} ×{" "}
                    {formatMoney(
                      item.unitPriceCents
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-neutral-200 bg-[#f7f6f2] p-5">
          <h2 className="text-sm font-semibold text-neutral-950">
            Order totals
          </h2>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">
                Subtotal
              </span>

              <span className="font-medium text-neutral-950">
                {formatMoney(
                  order.subtotalCents
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">
                Shipping
              </span>

              <span className="font-medium text-neutral-950">
                {formatMoney(
                  order.shippingCents
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">
                Tax
              </span>

              <span className="font-medium text-neutral-950">
                {formatMoney(
                  order.taxCents
                )}
              </span>
            </div>

            <div className="flex justify-between gap-4 border-t border-neutral-200 pt-3">
              <span className="text-base font-semibold text-neutral-950">
                Total
              </span>

              <span className="text-base font-semibold text-neutral-950">
                {formatMoney(
                  order.totalCents
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/products"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#24483d]"
          >
            Continue shopping
            <ArrowRight
              size={15}
            />
          </Link>

          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-200 px-5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}