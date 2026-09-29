"use client";

import Link from "next/link";
import {
  Check,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";

import { addCartItem } from "@/lib/cart";

type AddToOrderButtonProps = {
  productId: string;
  productSlug: string;
  productName: string;

  variantId?: string | null;
  variantName?: string | null;

  sku?: string | null;
  imageUrl?: string | null;

  priceCents: number;
  quantity: number;

  minimumOrderQuantity: number;
  caseQuantity: number;

  availableStock?: number | null;

  disabled?: boolean;
};

export function AddToOrderButton({
  productId,
  productSlug,
  productName,

  variantId = null,
  variantName = null,

  sku = null,
  imageUrl = null,

  priceCents,
  quantity,

  minimumOrderQuantity,
  caseQuantity,

  availableStock = null,

  disabled = false,
}: AddToOrderButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "added" | "error"
  >("idle");

  const [message, setMessage] = useState("");

  function handleAddToOrder() {
    setStatus("idle");
    setMessage("");

    const result = addCartItem(
      {
        productId,
        productSlug,
        productName,

        variantId,
        variantName,

        sku,
        imageUrl,

        priceCents,

        minOrderQuantity:
          minimumOrderQuantity,

        caseQuantity,

        availableStock,
      },
      quantity,
    );

    if (!result.ok) {
      setStatus("error");

      if (
        result.error ===
        "insufficient_stock"
      ) {
        setMessage(
          "There is not enough stock available for this quantity.",
        );
      } else {
        setMessage(
          "Please select a valid quantity.",
        );
      }

      return;
    }

    setStatus("added");
    setMessage("Added to your order.");
  }

  const isOutOfStock =
    availableStock !== null &&
    availableStock <= 0;

  const isDisabled =
    disabled ||
    isOutOfStock ||
    quantity <= 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleAddToOrder}
          disabled={isDisabled}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {status === "added" ? (
            <>
              <Check className="h-4 w-4" />
              Added to order
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              Add to order
            </>
          )}
        </button>

        {status === "added" ? (
          <Link
            href="/cart"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
          >
            View cart
          </Link>
        ) : null}
      </div>

      {status === "added" ? (
        <p className="text-xs font-medium text-emerald-700">
          {message}
        </p>
      ) : null}

      {status === "error" ? (
        <p className="text-xs font-medium text-red-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}