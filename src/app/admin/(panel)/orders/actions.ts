"use server";

import {
  eq,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  orderItems,
  orders,
  products,
  productVariants,
} from "@/db/schema";
import { auth } from "@/lib/auth";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "completed",
  "cancelled",
] as const;

const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
] as const;

type OrderStatus =
  (typeof ORDER_STATUSES)[number];

type PaymentStatus =
  (typeof PAYMENT_STATUSES)[number];

/*
 * Active orders may be corrected between
 * Confirmed / Processing / Shipped.
 *
 * Completed and Cancelled remain final.
 */
const allowedTransitions: Record<
  OrderStatus,
  readonly OrderStatus[]
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

async function requireAdmin() {
  const session =
    await auth.api.getSession({
      headers:
        await headers(),
    });

  if (
    !session?.user ||
    session.user.role !==
      "admin"
  ) {
    throw new Error(
      "Unauthorized"
    );
  }

  return session;
}

function isOrderStatus(
  value: string
): value is OrderStatus {
  return (
    ORDER_STATUSES as readonly string[]
  ).includes(value);
}

function isPaymentStatus(
  value: string
): value is PaymentStatus {
  return (
    PAYMENT_STATUSES as readonly string[]
  ).includes(value);
}

export async function updateOrderStatus(
  formData: FormData
) {
  await requireAdmin();

  const orderId =
    String(
      formData.get(
        "orderId"
      ) ?? ""
    );

  const nextStatusRaw =
    String(
      formData.get(
        "orderStatus"
      ) ?? ""
    );

  if (
    !orderId ||
    !isOrderStatus(
      nextStatusRaw
    )
  ) {
    throw new Error(
      "Invalid order status."
    );
  }

  const nextStatus =
    nextStatusRaw;

  await db.transaction(
    async (tx) => {
      /*
       * Lock the order row so two
       * fulfillment updates cannot run
       * against the same old status.
       */
      const [order] =
        await tx
          .select({
            id: orders.id,

            orderStatus:
              orders.orderStatus,
          })
          .from(orders)
          .where(
            eq(
              orders.id,
              orderId
            )
          )
          .for("update")
          .limit(1);

      if (!order) {
        throw new Error(
          "Order not found."
        );
      }

      const currentStatus =
        order.orderStatus as OrderStatus;

      /*
       * Submitting the current value is
       * harmless.
       */
      if (
        currentStatus ===
        nextStatus
      ) {
        return;
      }

      const allowed =
        allowedTransitions[
          currentStatus
        ];

      if (
        !allowed.includes(
          nextStatus
        )
      ) {
        throw new Error(
          `Order cannot move from ${currentStatus} to ${nextStatus}.`
        );
      }

      /*
       * Cancellation restores inventory.
       *
       * Since cancelled is final, this can
       * only happen once.
       */
      if (
        nextStatus ===
        "cancelled"
      ) {
        const items =
          await tx
            .select({
              productId:
                orderItems.productId,

              variantId:
                orderItems.variantId,

              variantName:
                orderItems.variantName,

              quantity:
                orderItems.quantity,
            })
            .from(orderItems)
            .where(
              eq(
                orderItems.orderId,
                orderId
              )
            );

        for (
          const item of items
        ) {
          /*
           * Variant item.
           *
           * Restore both:
           * - variant stock
           * - aggregate parent stock
           */
          if (
            item.variantId
          ) {
            const [variant] =
              await tx
                .select({
                  id:
                    productVariants.id,

                  productId:
                    productVariants.productId,
                })
                .from(
                  productVariants
                )
                .where(
                  eq(
                    productVariants.id,
                    item.variantId
                  )
                )
                .for(
                  "update"
                )
                .limit(1);

            if (variant) {
              await tx
                .update(
                  productVariants
                )
                .set({
                  stockQuantity:
                    sql`${productVariants.stockQuantity} + ${item.quantity}`,

                  updatedAt:
                    new Date(),
                })
                .where(
                  eq(
                    productVariants.id,
                    variant.id
                  )
                );

              await tx
                .update(
                  products
                )
                .set({
                  stockQuantity:
                    sql`${products.stockQuantity} + ${item.quantity}`,

                  updatedAt:
                    new Date(),
                })
                .where(
                  eq(
                    products.id,
                    variant.productId
                  )
                );

              continue;
            }

            /*
             * If the historical variant was
             * deleted, do not restore its
             * quantity into the base product.
             */
            continue;
          }

          /*
           * If the order snapshot says this
           * used to be a variant but the
           * variant record has since vanished,
           * don't treat it as base inventory.
           */
          if (
            item.variantName
          ) {
            continue;
          }

          /*
           * Base product item.
           */
          if (
            item.productId
          ) {
            await tx
              .update(
                products
              )
              .set({
                stockQuantity:
                  sql`${products.stockQuantity} + ${item.quantity}`,

                updatedAt:
                  new Date(),
              })
              .where(
                eq(
                  products.id,
                  item.productId
                )
              );
          }
        }
      }

      await tx
        .update(orders)
        .set({
          orderStatus:
            nextStatus,

          updatedAt:
            new Date(),
        })
        .where(
          eq(
            orders.id,
            orderId
          )
        );
    }
  );

  revalidatePath(
    "/admin"
  );

  revalidatePath(
    "/admin/orders"
  );

  revalidatePath(
    `/admin/orders/${orderId}`
  );

  revalidatePath(
    "/admin/inventory"
  );

  revalidatePath(
    "/admin/products"
  );

  revalidatePath(
    "/account"
  );

  revalidatePath(
    "/account/orders"
  );
}

export async function updatePaymentStatus(
  formData: FormData
) {
  await requireAdmin();

  const orderId =
    String(
      formData.get(
        "orderId"
      ) ?? ""
    );

  const paymentStatusRaw =
    String(
      formData.get(
        "paymentStatus"
      ) ?? ""
    );

  if (
    !orderId ||
    !isPaymentStatus(
      paymentStatusRaw
    )
  ) {
    throw new Error(
      "Invalid payment status."
    );
  }

  const [order] =
    await db
      .select({
        id: orders.id,
      })
      .from(orders)
      .where(
        eq(
          orders.id,
          orderId
        )
      )
      .limit(1);

  if (!order) {
    throw new Error(
      "Order not found."
    );
  }

  await db
    .update(orders)
    .set({
      paymentStatus:
        paymentStatusRaw,

      updatedAt:
        new Date(),
    })
    .where(
      eq(
        orders.id,
        orderId
      )
    );

  revalidatePath(
    "/admin"
  );

  revalidatePath(
    "/admin/orders"
  );

  revalidatePath(
    `/admin/orders/${orderId}`
  );

  revalidatePath(
    "/admin/analytics"
  );

  revalidatePath(
    "/account"
  );

  revalidatePath(
    "/account/orders"
  );
}