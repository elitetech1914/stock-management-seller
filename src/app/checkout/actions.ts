"use server";

import {
  and,
  eq,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  orderItems,
  orders,
  products,
  productVariants,
} from "@/db/schema";
import { auth } from "@/lib/auth";

type PlaceOrderInput = {
  details: {
    contactName: string;
    companyName: string;
    phone: string;

    addressLine1: string;
    addressLine2: string;

    city: string;
    state: string;
    postalCode: string;
    country: string;

    notes: string;
  };

  items: Array<{
    productId: string;
    variantId: string | null;
    quantity: number;
  }>;
};

type PlaceOrderResult =
  | {
      ok: true;
      orderNumber: string;
    }
  | {
      ok: false;
      error: string;
    };

class OrderValidationError extends Error {}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function placeOrder(
  input: PlaceOrderInput
): Promise<PlaceOrderResult> {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session) {
    return {
      ok: false,
      error:
        "Your session has expired. Please sign in again.",
    };
  }

  try {
    const details =
      validateCheckoutDetails(
        input?.details
      );

    const cartItems =
      validateAndGroupItems(
        input?.items
      );

    const result =
      await db.transaction(
        async (tx) => {
          const validatedItems: Array<{
            productId: string;
            variantId: string | null;
            productName: string;
            variantName: string | null;
            sku: string;
            unitPriceCents: number;
            quantity: number;
            lineTotalCents: number;
          }> = [];

          let subtotalCents = 0;

          /*
           * Items were sorted during
           * validation so locks are acquired
           * in a consistent order.
           */
          for (const cartItem of cartItems) {
            const [product] =
              await tx
                .select({
                  id: products.id,
                  title: products.title,
                  sku: products.sku,

                  wholesalePriceCents:
                    products.wholesalePriceCents,

                  stockQuantity:
                    products.stockQuantity,

                  minimumOrderQuantity:
                    products.minimumOrderQuantity,

                  caseQuantity:
                    products.caseQuantity,

                  isActive:
                    products.isActive,
                })
                .from(products)
                .where(
                  eq(
                    products.id,
                    cartItem.productId
                  )
                )
                .limit(1)
                .for("update");

            if (!product) {
              throw new OrderValidationError(
                "One of the products in your cart no longer exists."
              );
            }

            if (!product.isActive) {
              throw new OrderValidationError(
                `${product.title} is no longer available.`
              );
            }

            const minimumOrderQuantity =
              Math.max(
                1,
                product.minimumOrderQuantity
              );

            const caseQuantity =
              Math.max(
                1,
                product.caseQuantity
              );

            if (
              cartItem.quantity <
              minimumOrderQuantity
            ) {
              throw new OrderValidationError(
                `${product.title} requires a minimum order of ${minimumOrderQuantity} units.`
              );
            }

            if (
              cartItem.quantity %
                caseQuantity !==
              0
            ) {
              throw new OrderValidationError(
                `${product.title} must be ordered in multiples of ${caseQuantity}.`
              );
            }

            let variantId:
              | string
              | null = null;

            let variantName:
              | string
              | null = null;

            let sku = product.sku;

            let unitPriceCents =
              product.wholesalePriceCents;

            if (cartItem.variantId) {
              const [variant] =
                await tx
                  .select({
                    id: productVariants.id,

                    productId:
                      productVariants.productId,

                    sku: productVariants.sku,

                    option1Value:
                      productVariants.option1Value,

                    option2Value:
                      productVariants.option2Value,

                    option3Value:
                      productVariants.option3Value,

                    wholesalePriceCents:
                      productVariants.wholesalePriceCents,

                    stockQuantity:
                      productVariants.stockQuantity,

                    isActive:
                      productVariants.isActive,
                  })
                  .from(productVariants)
                  .where(
                    and(
                      eq(
                        productVariants.id,
                        cartItem.variantId
                      ),
                      eq(
                        productVariants.productId,
                        product.id
                      )
                    )
                  )
                  .limit(1)
                  .for("update");

              if (!variant) {
                throw new OrderValidationError(
                  `The selected variant for ${product.title} is no longer available.`
                );
              }

              if (!variant.isActive) {
                throw new OrderValidationError(
                  `The selected variant for ${product.title} is currently unavailable.`
                );
              }

              if (
                variant.stockQuantity <
                cartItem.quantity
              ) {
                throw new OrderValidationError(
                  `There is not enough stock available for ${product.title}.`
                );
              }

              variantId =
                variant.id;

              sku = variant.sku;

              unitPriceCents =
                variant.wholesalePriceCents;

              variantName =
                getVariantName(
                  variant
                );

              /*
               * Variant inventory is the
               * authoritative stock for a
               * variant product.
               */
              await tx
                .update(
                  productVariants
                )
                .set({
                  stockQuantity:
                    variant.stockQuantity -
                    cartItem.quantity,

                  updatedAt:
                    new Date(),
                })
                .where(
                  eq(
                    productVariants.id,
                    variant.id
                  )
                );

              /*
               * products.stockQuantity is
               * maintained as aggregate
               * variant stock.
               */
              await tx
                .update(products)
                .set({
                  stockQuantity:
                    Math.max(
                      0,
                      product.stockQuantity -
                        cartItem.quantity
                    ),

                  updatedAt:
                    new Date(),
                })
                .where(
                  eq(
                    products.id,
                    product.id
                  )
                );
            } else {
              /*
               * A client must not omit a
               * variant ID for a product
               * that actually has variants.
               */
              const [existingVariant] =
                await tx
                  .select({
                    id: productVariants.id,
                  })
                  .from(productVariants)
                  .where(
                    eq(
                      productVariants.productId,
                      product.id
                    )
                  )
                  .limit(1);

              if (existingVariant) {
                throw new OrderValidationError(
                  `Please select a variant for ${product.title}.`
                );
              }

              if (
                product.stockQuantity <
                cartItem.quantity
              ) {
                throw new OrderValidationError(
                  `There is not enough stock available for ${product.title}.`
                );
              }

              await tx
                .update(products)
                .set({
                  stockQuantity:
                    product.stockQuantity -
                    cartItem.quantity,

                  updatedAt:
                    new Date(),
                })
                .where(
                  eq(
                    products.id,
                    product.id
                  )
                );
            }

            if (
              unitPriceCents < 0
            ) {
              throw new OrderValidationError(
                `${product.title} currently has an invalid price.`
              );
            }

            const lineTotalCents =
              unitPriceCents *
              cartItem.quantity;

            if (
              !Number.isSafeInteger(
                lineTotalCents
              )
            ) {
              throw new OrderValidationError(
                "The order total is too large."
              );
            }

            subtotalCents +=
              lineTotalCents;

            if (
              !Number.isSafeInteger(
                subtotalCents
              )
            ) {
              throw new OrderValidationError(
                "The order total is too large."
              );
            }

            validatedItems.push({
              productId:
                product.id,

              variantId,

              productName:
                product.title,

              variantName,

              sku,

              unitPriceCents,

              quantity:
                cartItem.quantity,

              lineTotalCents,
            });
          }

          const shippingCents = 0;
          const taxCents = 0;

          const totalCents =
            subtotalCents +
            shippingCents +
            taxCents;

          const orderNumber =
            createOrderNumber();

          const [createdOrder] =
            await tx
              .insert(orders)
              .values({
                orderNumber,

                buyerUserId:
                  session.user.id,

                buyerEmail:
                  session.user.email,

                contactName:
                  details.contactName,

                companyName:
                  details.companyName,

                phone:
                  details.phone,

                shippingAddressLine1:
                  details.addressLine1,

                shippingAddressLine2:
                  details.addressLine2 ||
                  null,

                shippingCity:
                  details.city,

                shippingState:
                  details.state,

                shippingPostalCode:
                  details.postalCode,

                shippingCountry:
                  details.country,

                notes:
                  details.notes ||
                  null,

                subtotalCents,

                shippingCents,

                taxCents,

                totalCents,

                orderStatus:
                  "pending",

                paymentStatus:
                  "unpaid",
              })
              .returning({
                id: orders.id,
                orderNumber:
                  orders.orderNumber,
              });

          if (!createdOrder) {
            throw new Error(
              "Order insert failed."
            );
          }

          await tx
            .insert(orderItems)
            .values(
              validatedItems.map(
                (item) => ({
                  orderId:
                    createdOrder.id,

                  productId:
                    item.productId,

                  variantId:
                    item.variantId,

                  productName:
                    item.productName,

                  variantName:
                    item.variantName,

                  sku: item.sku,

                  unitPriceCents:
                    item.unitPriceCents,

                  quantity:
                    item.quantity,

                  lineTotalCents:
                    item.lineTotalCents,
                })
              )
            );

          return {
            orderNumber:
              createdOrder.orderNumber,
          };
        }
      );

    return {
      ok: true,
      orderNumber:
        result.orderNumber,
    };
  } catch (error) {
    if (
      error instanceof
      OrderValidationError
    ) {
      return {
        ok: false,
        error: error.message,
      };
    }

    console.error(
      "[place-order]",
      error
    );

    return {
      ok: false,
      error:
        "We couldn't place your order. Please try again.",
    };
  }
}

function validateCheckoutDetails(
  details:
    | PlaceOrderInput["details"]
    | undefined
) {
  if (
    !details ||
    typeof details !== "object"
  ) {
    throw new OrderValidationError(
      "Please complete your checkout details."
    );
  }

  return {
    contactName: requiredText(
      details.contactName,
      "Contact name",
      255
    ),

    companyName: requiredText(
      details.companyName,
      "Company name",
      255
    ),

    phone: requiredText(
      details.phone,
      "Phone number",
      100
    ),

    addressLine1: requiredText(
      details.addressLine1,
      "Shipping address",
      500
    ),

    addressLine2: optionalText(
      details.addressLine2,
      "Address line 2",
      500
    ),

    city: requiredText(
      details.city,
      "City",
      255
    ),

    state: requiredText(
      details.state,
      "State / region",
      255
    ),

    postalCode: requiredText(
      details.postalCode,
      "Postal code",
      100
    ),

    country: requiredText(
      details.country,
      "Country",
      255
    ),

    notes: optionalText(
      details.notes,
      "Order notes",
      5000
    ),
  };
}

function validateAndGroupItems(
  items:
    | PlaceOrderInput["items"]
    | undefined
) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new OrderValidationError(
      "Your cart is empty."
    );
  }

  if (items.length > 100) {
    throw new OrderValidationError(
      "Your cart contains too many items."
    );
  }

  const grouped = new Map<
    string,
    {
      productId: string;
      variantId: string | null;
      quantity: number;
    }
  >();

  for (const item of items) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      throw new OrderValidationError(
        "Your cart contains an invalid item."
      );
    }

    if (
      typeof item.productId !==
        "string" ||
      !UUID_PATTERN.test(
        item.productId
      )
    ) {
      throw new OrderValidationError(
        "Your cart contains an invalid product."
      );
    }

    const variantId =
      item.variantId === null ||
      item.variantId === undefined
        ? null
        : item.variantId;

    if (
      variantId !== null &&
      (typeof variantId !==
        "string" ||
        !UUID_PATTERN.test(
          variantId
        ))
    ) {
      throw new OrderValidationError(
        "Your cart contains an invalid product variant."
      );
    }

    if (
      !Number.isInteger(
        item.quantity
      ) ||
      item.quantity <= 0 ||
      item.quantity >
        1_000_000
    ) {
      throw new OrderValidationError(
        "Your cart contains an invalid quantity."
      );
    }

    const key =
      `${item.productId}:${variantId ?? "base"}`;

    const existing =
      grouped.get(key);

    if (existing) {
      existing.quantity +=
        item.quantity;

      if (
        existing.quantity >
        1_000_000
      ) {
        throw new OrderValidationError(
          "A product quantity is too large."
        );
      }
    } else {
      grouped.set(key, {
        productId:
          item.productId,

        variantId,

        quantity:
          item.quantity,
      });
    }
  }

  return Array.from(
    grouped.values()
  ).sort((a, b) => {
    const keyA =
      `${a.productId}:${a.variantId ?? ""}`;

    const keyB =
      `${b.productId}:${b.variantId ?? ""}`;

    return keyA.localeCompare(
      keyB
    );
  });
}

function requiredText(
  value: unknown,
  label: string,
  maxLength: number
) {
  if (
    typeof value !== "string"
  ) {
    throw new OrderValidationError(
      `${label} is required.`
    );
  }

  const cleaned = value.trim();

  if (!cleaned) {
    throw new OrderValidationError(
      `${label} is required.`
    );
  }

  if (
    cleaned.length >
    maxLength
  ) {
    throw new OrderValidationError(
      `${label} is too long.`
    );
  }

  return cleaned;
}

function optionalText(
  value: unknown,
  label: string,
  maxLength: number
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  if (
    typeof value !== "string"
  ) {
    throw new OrderValidationError(
      `${label} is invalid.`
    );
  }

  const cleaned = value.trim();

  if (
    cleaned.length >
    maxLength
  ) {
    throw new OrderValidationError(
      `${label} is too long.`
    );
  }

  return cleaned;
}

function getVariantName(variant: {
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
}) {
  const values = [
    variant.option1Value,
    variant.option2Value,
    variant.option3Value,
  ].filter(
    (
      value
    ): value is string =>
      Boolean(value)
  );

  return values.length > 0
    ? values.join(" / ")
    : null;
}

function createOrderNumber() {
  const date = new Date();

  const datePart = [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0"),

    String(
      date.getUTCDate()
    ).padStart(2, "0"),
  ].join("");

  const randomPart =
    randomUUID()
      .replaceAll("-", "")
      .slice(0, 10)
      .toUpperCase();

  return `STM-${datePart}-${randomPart}`;
}