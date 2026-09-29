"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  productImages,
  products,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/slugify";

async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

function moneyToCents(
  value: FormDataEntryValue | null
) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 100);
}

/**
 * CREATE PRODUCT
 */
export async function createProduct(
  formData: FormData
) {
  await requireAdmin();

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const sku = String(
    formData.get("sku") ?? ""
  ).trim();

  if (!title) {
    throw new Error("Product title is required.");
  }

  if (!sku) {
    throw new Error("SKU is required.");
  }

  const description = String(
    formData.get("description") ?? ""
  ).trim();

  const brand = String(
    formData.get("brand") ?? ""
  ).trim();

  const categoryValue = String(
    formData.get("categoryId") ?? ""
  ).trim();

  const categoryId =
    categoryValue.length > 0
      ? categoryValue
      : null;

  const stockQuantity = Math.max(
    0,
    Number(formData.get("stockQuantity")) || 0
  );

  const minimumOrderQuantity = Math.max(
    1,
    Number(
      formData.get("minimumOrderQuantity")
    ) || 1
  );

  const caseQuantity = Math.max(
    1,
    Number(formData.get("caseQuantity")) || 1
  );

  const slug = slugify(`${title}-${sku}`);

  const [product] = await db
    .insert(products)
    .values({
      title,
      slug,
      sku,

      description:
        description.length > 0
          ? description
          : null,

      brand:
        brand.length > 0
          ? brand
          : null,

      categoryId,

      costPriceCents: moneyToCents(
        formData.get("costPrice")
      ),

      wholesalePriceCents: moneyToCents(
        formData.get("wholesalePrice")
      ),

      retailPriceCents: moneyToCents(
        formData.get("retailPrice")
      ),

      stockQuantity,
      minimumOrderQuantity,
      caseQuantity,

      isActive: true,
    })
    .returning();

  const imageUrls = String(
    formData.get("imageUrls") ?? ""
  )
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);

  if (imageUrls.length > 0) {
    await db.insert(productImages).values(
      imageUrls.map((url, index) => ({
        productId: product.id,
        url,
        altText: title,
        position: index,
      }))
    );
  }

  revalidatePath("/admin/products");
  revalidatePath("/");

  redirect("/admin/products");
}

/**
 * UPDATE PRODUCT
 */
export async function updateProduct(
  id: string,
  formData: FormData
) {
  await requireAdmin();

  const title = String(
    formData.get("title") ?? ""
  ).trim();

  const sku = String(
    formData.get("sku") ?? ""
  ).trim();

  if (!title) {
    throw new Error("Product title is required.");
  }

  if (!sku) {
    throw new Error("SKU is required.");
  }

  const description = String(
    formData.get("description") ?? ""
  ).trim();

  const brand = String(
    formData.get("brand") ?? ""
  ).trim();

  const categoryValue = String(
    formData.get("categoryId") ?? ""
  ).trim();

  const categoryId =
    categoryValue.length > 0
      ? categoryValue
      : null;

  const stockQuantity = Math.max(
    0,
    Number(formData.get("stockQuantity")) || 0
  );

  const minimumOrderQuantity = Math.max(
    1,
    Number(
      formData.get("minimumOrderQuantity")
    ) || 1
  );

  const caseQuantity = Math.max(
    1,
    Number(formData.get("caseQuantity")) || 1
  );

  const imageUrls = String(
    formData.get("imageUrls") ?? ""
  )
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        title,

        slug: slugify(`${title}-${sku}`),

        sku,

        description:
          description.length > 0
            ? description
            : null,

        brand:
          brand.length > 0
            ? brand
            : null,

        categoryId,

        costPriceCents: moneyToCents(
          formData.get("costPrice")
        ),

        wholesalePriceCents: moneyToCents(
          formData.get("wholesalePrice")
        ),

        retailPriceCents: moneyToCents(
          formData.get("retailPrice")
        ),

        stockQuantity,
        minimumOrderQuantity,
        caseQuantity,

        isActive:
          formData.get("isActive") === "on",

        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    /*
     * For now, editing image URLs replaces
     * the entire image set for the product.
     */
    await tx
      .delete(productImages)
      .where(eq(productImages.productId, id));

    if (imageUrls.length > 0) {
      await tx.insert(productImages).values(
        imageUrls.map((url, index) => ({
          productId: id,
          url,
          altText: title,
          position: index,
        }))
      );
    }
  });

  revalidatePath("/admin/products");
  revalidatePath(
    `/admin/products/${id}/edit`
  );
  revalidatePath("/");

  redirect("/admin/products");
}

/**
 * ARCHIVE PRODUCT
 */
export async function archiveProduct(
  formData: FormData
) {
  await requireAdmin();

  const id = String(
    formData.get("id") ?? ""
  ).trim();

  if (!id) {
    return;
  }

  await db
    .update(products)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/");
}
export async function deleteProduct(
  formData: FormData
) {
  await requireAdmin();

  const id = String(
    formData.get("id") ?? ""
  ).trim();

  if (!id) {
    return;
  }

  await db
    .delete(products)
    .where(eq(products.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/");
}