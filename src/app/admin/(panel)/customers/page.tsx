import { sql } from "drizzle-orm";
import {
  ChevronRight,
  CircleDollarSign,
  ShoppingBag,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { db } from "@/db";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: Date;
  totalOrders: number;
  paidSpendCents: number;
  latestOrderAt: Date | null;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(date: Date | string | null) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function AdminCustomersPage() {
  const result = await db.execute(sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u."createdAt" AS "createdAt",

      COUNT(o.id)::int AS "totalOrders",

      COALESCE(
        SUM(
          CASE
            WHEN o.payment_status = 'paid'
            THEN o.total_cents
            ELSE 0
          END
        ),
        0
      )::int AS "paidSpendCents",

      MAX(o.created_at) AS "latestOrderAt"

    FROM "user" u

    LEFT JOIN orders o
      ON o.buyer_user_id = u.id

    WHERE
      COALESCE(u.role, 'user') <> 'admin'

    GROUP BY
      u.id,
      u.name,
      u.email,
      u.role,
      u."createdAt"

    ORDER BY
      MAX(o.created_at) DESC NULLS LAST,
      u."createdAt" DESC
  `);

  const customers =
    result.rows as unknown as CustomerRow[];

  const totalCustomers =
    customers.length;

  const customersWithOrders =
    customers.filter(
      (customer) =>
        Number(customer.totalOrders) > 0
    ).length;

  const totalOrders =
    customers.reduce(
      (total, customer) =>
        total +
        Number(customer.totalOrders),
      0
    );

  const paidRevenue =
    customers.reduce(
      (total, customer) =>
        total +
        Number(customer.paidSpendCents),
      0
    );

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          Customer management
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
          Customers
        </h1>

        <p className="mt-1 text-sm text-neutral-500">
          View registered buyers and their wholesale
          order activity.
        </p>
      </div>

      {/* SUMMARY */}
      <div className="mb-5 grid overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem
          icon={<UsersRound size={16} />}
          label="Customers"
          value={String(totalCustomers)}
        />

        <SummaryItem
          icon={<UserRound size={16} />}
          label="With orders"
          value={String(customersWithOrders)}
        />

        <SummaryItem
          icon={<ShoppingBag size={16} />}
          label="Total orders"
          value={String(totalOrders)}
        />

        <SummaryItem
          icon={
            <CircleDollarSign size={16} />
          }
          label="Paid revenue"
          value={formatMoney(paidRevenue)}
          last
        />
      </div>

      {/* TABLE */}
      {customers.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
            <UsersRound size={19} />
          </div>

          <h2 className="mt-4 font-semibold text-neutral-950">
            No customers yet
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Registered buyer accounts will appear
            here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.4fr_1.6fr_0.65fr_0.85fr_0.9fr_28px] gap-4 border-b border-neutral-200 bg-[#fafaf8] px-6 py-3.5 lg:grid">
            <Heading>Customer</Heading>
            <Heading>Email</Heading>
            <Heading>Orders</Heading>
            <Heading>Paid spend</Heading>
            <Heading>Last order</Heading>
            <div />
          </div>

          <div className="divide-y divide-neutral-100">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/admin/customers/${customer.id}`}
                className="group block px-6 py-5 transition hover:bg-[#fafaf8] lg:grid lg:grid-cols-[1.4fr_1.6fr_0.65fr_0.85fr_0.9fr_28px] lg:items-center lg:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5f4f0] text-neutral-500">
                    <UserRound size={17} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-neutral-950">
                      {customer.name}
                    </p>

                    <p className="mt-0.5 text-xs text-neutral-400">
                      Joined{" "}
                      {formatDate(
                        customer.createdAt
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 min-w-0 lg:mt-0">
                  <p className="truncate text-sm text-neutral-700">
                    {customer.email}
                  </p>
                </div>

                <div className="mt-3 lg:mt-0">
                  <p className="text-[15px] font-semibold text-neutral-950">
                    {Number(
                      customer.totalOrders
                    )}
                  </p>
                </div>

                <div className="mt-3 lg:mt-0">
                  <p className="text-[15px] font-semibold text-neutral-950">
                    {formatMoney(
                      Number(
                        customer.paidSpendCents
                      )
                    )}
                  </p>
                </div>

                <div className="mt-3 lg:mt-0">
                  <p className="text-sm text-neutral-600">
                    {formatDate(
                      customer.latestOrderAt
                    )}
                  </p>
                </div>

                <div className="hidden justify-end lg:flex">
                  <ChevronRight
                    size={17}
                    className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-700"
                  />
                </div>
              </Link>
            ))}
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
        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-400">
          {label}
        </p>

        <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-neutral-950">
          {value}
        </p>
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