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
import { AdminProductInputError, parseBulkProductRequest, type BulkProductState } from "@/lib/admin-product-filters";
import { applyBulkProductUpdate } from "@/lib/admin-products";
import { parseProductGallery, ProductGalleryError, type ProductEditState } from "@/lib/media/product-gallery";
import { resolveProductGallery } from "@/lib/media/product-gallery-server";
import { UUID_PATTERN } from "@/lib/media/shared";

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
export async function updateProduct(id: string, previous: ProductEditState, formData: FormData): Promise<ProductEditState> {
  void previous;
  try {
    await requireAdmin();
    if (!UUID_PATTERN.test(id)) throw new ProductGalleryError("This product is invalid. Reload the editor.");
    const title = String(formData.get("title") ?? "").trim();
    const sku = String(formData.get("sku") ?? "").trim();
    if (!title) throw new ProductGalleryError("Product title is required.");
    if (!sku) throw new ProductGalleryError("SKU is required.");
    const description = String(formData.get("description") ?? "").trim();
    const brand = String(formData.get("brand") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
    const gallery = parseProductGallery(formData.get("imageGallery"));
    await db.transaction(async (tx) => {
      const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).for("update");
      if (!product) throw new ProductGalleryError("This product no longer exists. Return to the product list.");
      const images = await resolveProductGallery(tx, id, gallery, title);
      await tx.update(products).set({
        title, slug: slugify(title + "-" + sku), sku,
        description: description || null, brand: brand || null, categoryId,
        costPriceCents: moneyToCents(formData.get("costPrice")),
        wholesalePriceCents: moneyToCents(formData.get("wholesalePrice")),
        retailPriceCents: moneyToCents(formData.get("retailPrice")),
        stockQuantity: Math.max(0, Number(formData.get("stockQuantity")) || 0),
        minimumOrderQuantity: Math.max(1, Number(formData.get("minimumOrderQuantity")) || 1),
        caseQuantity: Math.max(1, Number(formData.get("caseQuantity")) || 1),
        isActive: formData.get("isActive") === "on", updatedAt: new Date(),
      }).where(eq(products.id, id));
      await tx.delete(productImages).where(eq(productImages.productId, id));
      if (images.length) await tx.insert(productImages).values(images.map((image) => ({ ...image, productId: id })));
    });
  } catch (error) {
    return { error: error instanceof ProductGalleryError ? error.message : "Could not save the product. Check your admin access and product details, then try again." };
  }
  for (const path of ["/admin/products", "/admin", "/admin/categories", "/admin/inventory", "/products", "/"]) revalidatePath(path);
  revalidatePath("/admin/products/" + id + "/edit");
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/categories/[slug]", "page");
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

export async function bulkUpdateProducts(previous: BulkProductState, formData: FormData): Promise<BulkProductState> {
  void previous;
  try {
    await requireAdmin();
    const request = parseBulkProductRequest(formData);
    const updated = await applyBulkProductUpdate(db, request);
    for (const path of ["/admin/products", "/admin", "/admin/inventory", "/admin/categories", "/products", "/"]) revalidatePath(path);
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/categories/[slug]", "page");
    revalidatePath("/admin/products/[id]/edit", "page");
    const verb = request.operation === "archive" ? "archived" : request.operation === "activate" ? "reactivated" : "updated with the selected category";
    return { success: true, message: `${updated} product${updated === 1 ? "" : "s"} ${verb}.` };
  } catch (error) {
    return { success: false, message: error instanceof AdminProductInputError ? error.message : "Could not update products. Please check your access and try again." };
  }
}
