import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import  BuyerAuthForm  from "@/components/store/buyer-auth-form";

export const metadata: Metadata = {
  title: "Create Buyer Account | Stockmora",
  description:
    "Create your Stockmora wholesale buyer account.",
};

export default function RegisterPage() {
  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#fafaf8]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/cart"
          className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-950"
        >
          <ArrowLeft size={15} />
          Back to cart
        </Link>

        <div className="flex justify-center py-4 sm:py-10">
          <BuyerAuthForm mode="register" />
        </div>
      </div>
    </main>
  );
}