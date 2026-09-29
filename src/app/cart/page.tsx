import type { Metadata } from "next";

import { CartPage } from "@/components/store/cart-page";

export const metadata: Metadata = {
  title: "Cart | Stockmora",
  description:
    "Review your Stockmora wholesale order.",
};

export default function Page() {
  return <CartPage />;
}