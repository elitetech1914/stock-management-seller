import type { Metadata } from "next";

import { CartPage } from "@/components/store/cart-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Cart",
  description:
    `Review your ${siteConfig.name} wholesale order.`,
};

export default function Page() {
  return <CartPage />;
}
