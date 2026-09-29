import { eq } from "drizzle-orm";
import {
  ArrowLeft,
  Building2,
  Mail,
  MapPin,
  Package,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderSelect } from "@/components/admin/order-select";
import { db } from "@/db";
import {
  orderItems,
  orders,
} from "@/db/schema";

import {
  updateOrderStatus,
  updatePaymentStatus,
} from "../actions";

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
      hour: "numeric",
      minute: "2-digit",
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

function statusClasses(
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

function paymentClasses(
  status: string
) {
  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

const statusLabels: Record<
  string,
  string
> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
};

/*
 * We allow corrections between active fulfillment states.
 *
 * Completed and Cancelled remain final because:
 *
 * - cancelled orders may have already restored stock
 * - reopening them without reversing that inventory movement
 *   would corrupt inventory
 */
const fulfillmentTransitions: Record<
  string,
  string[]
> = {
  pending: [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "completed",
    "cancelled",
  ],

  confirmed: [
    "confirmed",
    "processing",
    "shipped",
    "completed",
    "cancelled",
  ],

  processing: [
    "confirmed",
    "processing",
    "shipped",
    "completed",
    "cancelled",
  ],

  shipped: [
    "confirmed",
    "processing",
    "shipped",
    "completed",
    "cancelled",
  ],

  completed: [
    "completed",
  ],

  cancelled: [
    "cancelled",
  ],
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } =
    await params;

  const [order] =
    await db
      .select()
      .from(orders)
      .where(
        eq(
          orders.id,
          id
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

  const fulfillmentStatuses =
    fulfillmentTransitions[
      order.orderStatus
    ] ?? [
      order.orderStatus,
    ];

  const fulfillmentOptions =
    Array.from(
      new Set(
        fulfillmentStatuses
      )
    ).map((status) => ({
      label:
        statusLabels[
          status
        ] ??
        formatStatus(status),

      value: status,
    }));

  return (
    <div className="mx-auto w-full max-w-[1450px] px-6 py-5 lg:px-8">
      {/* BACK */}
      <Link
        href="/admin/orders"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
      >
        <ArrowLeft
          size={14}
        />

        Back to orders
      </Link>

      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Order
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
            {
              order.orderNumber
            }
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            Placed{" "}
            {formatDate(
              order.createdAt
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClasses(
              order.orderStatus
            )}`}
          >
            {formatStatus(
              order.orderStatus
            )}
          </span>

          <span
            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${paymentClasses(
              order.paymentStatus
            )}`}
          >
            {formatStatus(
              order.paymentStatus
            )}
          </span>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        {/* LEFT */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {/* ITEMS */}
          <section>
            <div className="border-b border-neutral-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5f4f0] text-neutral-500">
                  <Package
                    size={16}
                  />
                </div>

                <div>
                  <h2 className="font-semibold text-neutral-950">
                    Order items
                  </h2>

                  <p className="mt-0.5 text-xs text-neutral-500">
                    {
                      items.length
                    }{" "}
                    {items.length ===
                    1
                      ? "item"
                      : "items"}
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden grid-cols-[minmax(0,1.5fr)_130px_80px_120px] gap-5 border-b border-neutral-200 bg-[#fafaf8] px-5 py-3.5 lg:grid">
              <Heading>
                Product
              </Heading>

              <Heading>
                Price
              </Heading>

              <Heading>
                Qty
              </Heading>

              <Heading>
                Total
              </Heading>
            </div>

            <div className="divide-y divide-neutral-100">
              {items.map(
                (item) => (
                  <div
                    key={
                      item.id
                    }
                    className="px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1.5fr)_130px_80px_120px] lg:items-center lg:gap-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-neutral-950">
                        {
                          item.productName
                        }
                      </p>

                      {item.variantName && (
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {
                            item.variantName
                          }
                        </p>
                      )}

                      {item.sku && (
                        <p className="mt-1 truncate font-mono text-[11px] text-neutral-400">
                          {
                            item.sku
                          }
                        </p>
                      )}
                    </div>

                    <div className="mt-3 lg:mt-0">
                      <p className="text-sm text-neutral-700">
                        {formatMoney(
                          item.unitPriceCents
                        )}
                      </p>
                    </div>

                    <div className="mt-3 lg:mt-0">
                      <p className="text-sm font-medium tabular-nums text-neutral-900">
                        {
                          item.quantity
                        }
                      </p>
                    </div>

                    <div className="mt-3 lg:mt-0">
                      <p className="text-sm font-semibold tabular-nums text-neutral-950">
                        {formatMoney(
                          item.lineTotalCents
                        )}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* BUYER + SHIPPING */}
          <section className="grid border-t border-neutral-200 md:grid-cols-2">
            {/* BUYER */}
            <div className="p-5 md:border-r md:border-neutral-200">
              <div className="flex items-center gap-2">
                <UserRound
                  size={16}
                  className="text-neutral-400"
                />

                <h2 className="font-semibold text-neutral-950">
                  Buyer
                </h2>
              </div>

              <div className="mt-5 space-y-4">
                <Info
                  icon={
                    <UserRound
                      size={14}
                    />
                  }
                  label="Contact"
                  value={
                    order.contactName
                  }
                />

                <Info
                  icon={
                    <Building2
                      size={14}
                    />
                  }
                  label="Company"
                  value={
                    order.companyName
                  }
                />

                <Info
                  icon={
                    <Mail
                      size={14}
                    />
                  }
                  label="Email"
                  value={
                    order.buyerEmail
                  }
                />

                <Info
                  icon={
                    <Phone
                      size={14}
                    />
                  }
                  label="Phone"
                  value={
                    order.phone
                  }
                />
              </div>
            </div>

            {/* SHIPPING */}
            <div className="border-t border-neutral-200 p-5 md:border-t-0">
              <div className="flex items-center gap-2">
                <MapPin
                  size={16}
                  className="text-neutral-400"
                />

                <h2 className="font-semibold text-neutral-950">
                  Shipping
                </h2>
              </div>

              <div className="mt-5 text-sm leading-6 text-neutral-700">
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
                  {[
                    order.shippingCity,
                    order.shippingState,
                    order.shippingPostalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>

                <p>
                  {
                    order.shippingCountry
                  }
                </p>
              </div>
            </div>
          </section>

          {/* NOTES */}
          {order.notes && (
            <section className="border-t border-neutral-200 p-5">
              <h2 className="font-semibold text-neutral-950">
                Order notes
              </h2>

              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-600">
                {
                  order.notes
                }
              </p>
            </section>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="self-start overflow-visible rounded-xl border border-neutral-200 bg-white shadow-sm">
          {/* ORDER SUMMARY */}
          <section className="p-5">
            <h2 className="font-semibold text-neutral-950">
              Order summary
            </h2>

            <div className="mt-5 space-y-3">
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
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4">
              <span className="text-sm font-semibold text-neutral-950">
                Total
              </span>

              <span className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
                {formatMoney(
                  order.totalCents
                )}
              </span>
            </div>
          </section>

          {/* FULFILLMENT */}
          <section className="border-t border-neutral-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Fulfillment
                </h2>

                <p className="mt-1 text-xs text-neutral-500">
                  Order progress
                </p>
              </div>

              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClasses(
                  order.orderStatus
                )}`}
              >
                {formatStatus(
                  order.orderStatus
                )}
              </span>
            </div>

            <form
              action={
                updateOrderStatus
              }
              className="mt-4 space-y-2.5"
            >
              <input
                type="hidden"
                name="orderId"
                value={
                  order.id
                }
              />

              <OrderSelect
                name="orderStatus"
                defaultValue={
                  order.orderStatus
                }
                options={
                  fulfillmentOptions
                }
              />

              <button
                type="submit"
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
              >
                Update fulfillment
              </button>
            </form>
          </section>

          {/* PAYMENT */}
          <section className="border-t border-neutral-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Payment
                </h2>

                <p className="mt-1 text-xs text-neutral-500">
                  Offline payment status
                </p>
              </div>

              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${paymentClasses(
                  order.paymentStatus
                )}`}
              >
                {formatStatus(
                  order.paymentStatus
                )}
              </span>
            </div>

            <form
              action={
                updatePaymentStatus
              }
              className="mt-4 space-y-2.5"
            >
              <input
                type="hidden"
                name="orderId"
                value={
                  order.id
                }
              />

              <OrderSelect
                name="paymentStatus"
                defaultValue={
                  order.paymentStatus
                }
                options={[
                  {
                    label: "Unpaid",
                    value: "unpaid",
                  },
                  {
                    label: "Paid",
                    value: "paid",
                  },
                ]}
              />

              <button
                type="submit"
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
              >
                Update payment
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Heading({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400">
      {children}
    </p>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-400">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
          {label}
        </p>

        <p className="mt-0.5 break-words text-sm font-medium text-neutral-900">
          {value || "—"}
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-neutral-500">
        {label}
      </span>

      <span className="text-sm font-medium tabular-nums text-neutral-900">
        {value}
      </span>
    </div>
  );
}