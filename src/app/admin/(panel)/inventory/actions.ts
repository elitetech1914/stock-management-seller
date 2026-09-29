"use server";

import {
  eq,
} from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  products,
  productVariants,
} from "@/db/schema";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (
    !session?.user ||
    session.user.role !== "admin"
  ) {
    throw new Error("Unauthorized");
  }
}

export async function updateInventory(
  formData: FormData
) {
  await requireAdmin();

  const type = String(
    formData.get("type") ?? ""
  );

  const id = String(
    formData.get("id") ?? ""
  );

  const rawQuantity = String(
    formData.get(
      "stockQuantity"
    ) ?? ""
  );

  const stockQuantity =
    Number(rawQuantity);

  if (
    !id ||
    !Number.isInteger(
      stockQuantity
    ) ||
    stockQuantity < 0
  ) {
    throw new Error(
      "Invalid inventory quantity."
    );
  }

  if (type === "variant") {
    await db.transaction(
      async (tx) => {
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
                id
              )
            )
            .limit(1);

        if (!variant) {
          throw new Error(
            "Variant not found."
          );
        }

        await tx
          .update(
            productVariants
          )
          .set({
            stockQuantity,
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
         * Keep the parent product's
         * aggregate inventory synchronized
         * with all of its variants.
         */
        const variants =
          await tx
            .select({
              stockQuantity:
                productVariants.stockQuantity,
            })
            .from(
              productVariants
            )
            .where(
              eq(
                productVariants.productId,
                variant.productId
              )
            );

        const aggregateStock =
          variants.reduce(
            (total, item) =>
              total +
              item.stockQuantity,
            0
          );

        await tx
          .update(products)
          .set({
            stockQuantity:
              aggregateStock,

            updatedAt:
              new Date(),
          })
          .where(
            eq(
              products.id,
              variant.productId
            )
          );
      }
    );
  } else if (
    type === "product"
  ) {
    /*
     * A product with variants should be
     * managed through its variant rows.
     */
    const [variant] =
      await db
        .select({
          id:
            productVariants.id,
        })
        .from(productVariants)
        .where(
          eq(
            productVariants.productId,
            id
          )
        )
        .limit(1);

    if (variant) {
      throw new Error(
        "Products with variants must be updated through their variants."
      );
    }

    const [product] =
      await db
        .select({
          id: products.id,
        })
        .from(products)
        .where(
          eq(
            products.id,
            id
          )
        )
        .limit(1);

    if (!product) {
      throw new Error(
        "Product not found."
      );
    }

    await db
      .update(products)
      .set({
        stockQuantity,
        updatedAt: new Date(),
      })
      .where(
        eq(
          products.id,
          id
        )
      );
  } else {
    throw new Error(
      "Invalid inventory type."
    );
  }

  revalidatePath(
    "/admin/inventory"
  );

  revalidatePath(
    "/admin/products"
  );

  revalidatePath(
    "/products"
  );

  revalidatePath("/");
}