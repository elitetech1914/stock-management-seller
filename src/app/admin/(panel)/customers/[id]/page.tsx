import {
  desc,
  eq,
  sql,
} from "drizzle-orm";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { orders } from "@/db/schema";

type Customer = {
  id: string;
  name: string;
  email: string;
  role: string | null;
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
  date: Date | string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(new Date(date));
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

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const customerResult =
    await db.execute(sql`
      SELECT
        id,
        name,
        email,
        role,
        "createdAt"
      FROM "user"
      WHERE
        id = ${id}
        AND COALESCE(role, 'user') <> 'admin'
      LIMIT 1
    `);

  const customer =
    customerResult.rows[
      0
    ] as unknown as
      | Customer
      | undefined;

  if (!customer) {
    notFound();
  }

  const customerOrders =
    await db
      .select({
        id: orders.id,

        orderNumber:
          orders.orderNumber,

        companyName:
          orders.companyName,

        phone:
          orders.phone,

        shippingCity:
          orders.shippingCity,

        shippingState:
          orders.shippingState,

        shippingCountry:
          orders.shippingCountry,

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
          customer.id
        )
      )
      .orderBy(
        desc(orders.createdAt)
      );

  const totalOrders =
    customerOrders.length;

  const totalPaid =
    customerOrders
      .filter(
        (order) =>
          order.paymentStatus ===
          "paid"
      )
      .reduce(
        (total, order) =>
          total +
          order.totalCents,
        0
      );

  const openOrders =
    customerOrders.filter(
      (order) =>
        ![
          "completed",
          "cancelled",
        ].includes(
          order.orderStatus
        )
    ).length;

  const latestOrder =
    customerOrders[0] ??
    null;

  return (
    <div className="mx-auto w-full max-w-[1450px] px-4 py-5 sm:px-6 lg:px-8">
      {/* BACK */}
      <Link
        href="/admin/customers"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
      >
        <ArrowLeft
          size={14}
        />
        Back to customers
      </Link>

      {/* CUSTOMER HEADER */}
      <div className="mb-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5f4f0] text-neutral-600">
            <UserRound
              size={21}
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Customer
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
              {customer.name}
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              {customer.email}
            </p>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="mb-5 grid overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={
            <ShoppingBag
              size={16}
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
              size={16}
            />
          }
          label="Paid spend"
          value={formatMoney(
            totalPaid
          )}
        />

        <Metric
          icon={
            <ShoppingBag
              size={16}
            />
          }
          label="Open orders"
          value={String(
            openOrders
          )}
        />

        <Metric
          icon={
            <CalendarDays
              size={16}
            />
          }
          label="Customer since"
          value={formatDate(
            customer.createdAt
          )}
          last
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* LEFT — CUSTOMER DETAILS */}
        <aside className="self-start">
          <div className="min-h-[280px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <section className="p-5">
              <h2 className="font-semibold text-neutral-950">
                Customer details
              </h2>

              <div className="mt-5 space-y-4">
                <Info
                  icon={
                    <UserRound
                      size={15}
                    />
                  }
                  label="Name"
                  value={
                    customer.name
                  }
                />

                <Info
                  icon={
                    <Mail
                      size={15}
                    />
                  }
                  label="Email"
                  value={
                    customer.email
                  }
                />

                <Info
                  icon={
                    <CalendarDays
                      size={15}
                    />
                  }
                  label="Joined"
                  value={formatDate(
                    customer.createdAt
                  )}
                />
              </div>
            </section>

            {latestOrder && (
              <section className="border-t border-neutral-200 p-5">
                <h2 className="font-semibold text-neutral-950">
                  Latest business details
                </h2>

                <div className="mt-5 space-y-4">
                  <Info
                    icon={
                      <Building2
                        size={15}
                      />
                    }
                    label="Company"
                    value={
                      latestOrder.companyName
                    }
                  />

                  <Info
                    icon={
                      <Phone
                        size={15}
                      />
                    }
                    label="Phone"
                    value={
                      latestOrder.phone
                    }
                  />

                  <Info
                    icon={
                      <MapPin
                        size={15}
                      />
                    }
                    label="Location"
                    value={[
                      latestOrder.shippingCity,
                      latestOrder.shippingState,
                      latestOrder.shippingCountry,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(", ")}
                  />
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* RIGHT — ORDER HISTORY */}
        <section className="self-start overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          {/* ORDER HISTORY HEADER */}
          <div className="border-b border-neutral-200 px-5 py-5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
              Order history
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              All wholesale orders
              placed by this customer.
            </p>
          </div>

          {customerOrders.length ===
          0 ? (
            <div className="flex min-h-[176px] flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-50 text-neutral-500">
                <ShoppingBag
                  size={18}
                />
              </div>

              <h3 className="mt-4 font-semibold text-neutral-950">
                No orders yet
              </h3>

              <p className="mt-1 text-sm text-neutral-500">
                This buyer has
                registered but has
                not placed an order.
              </p>
            </div>
          ) : (
            <>
              {/* TABLE HEADER */}
              <div className="hidden grid-cols-[1.35fr_0.7fr_0.8fr_0.75fr_28px] gap-4 border-b border-neutral-200 bg-background px-5 py-3.5 lg:grid">
                <Heading>
                  Order
                </Heading>

                <Heading>
                  Total
                </Heading>

                <Heading>
                  Status
                </Heading>

                <Heading>
                  Payment
                </Heading>

                <div />
              </div>

              {/* ORDER ROWS */}
              <div className="divide-y divide-neutral-100">
                {customerOrders.map(
                  (order) => (
                    <Link
                      key={
                        order.id
                      }
                      href={`/admin/orders/${order.id}`}
                      className="group block px-5 py-4 transition hover:bg-background lg:grid lg:grid-cols-[1.35fr_0.7fr_0.8fr_0.75fr_28px] lg:items-center lg:gap-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">
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

                      <div className="mt-3 lg:mt-0">
                        <p className="text-sm font-semibold text-neutral-950">
                          {formatMoney(
                            order.totalCents
                          )}
                        </p>
                      </div>

                      <div className="mt-3 lg:mt-0">
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

                      <div className="mt-3 lg:mt-0">
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

                      <div className="hidden justify-end lg:flex">
                        <ChevronRight
                          size={16}
                          className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-700"
                        />
                      </div>
                    </Link>
                  )
                )}
              </div>
            </>
          )}
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

      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
          {label}
        </p>

        <p className="mt-1 truncate text-lg font-semibold text-neutral-950">
          {value}
        </p>
      </div>
    </div>
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
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-500">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-500">
          {label}
        </p>

        <p className="mt-0.5 break-words text-sm font-medium text-neutral-900">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function Heading({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">
      {children}
    </p>
  );
}