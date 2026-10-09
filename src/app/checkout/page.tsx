import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/store/checkout-form";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Checkout | Stockmora",
  description:
    "Complete your Stockmora wholesale order.",
};

export default async function CheckoutPage() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Wholesale checkout
        </p>

        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
          Complete your order
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Enter your business and
          shipping information before
          submitting the wholesale order.
        </p>
      </div>

      <CheckoutForm
        buyerUserId={
          session.user.id
        }
        buyerName={
          session.user.name
        }
        buyerEmail={
          session.user.email
        }
      />
    </main>
  );
}