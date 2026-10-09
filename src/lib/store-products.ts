import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  productImages,
  products,
} from "@/db/schema";

export type StoreProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  categoryName: string | null;

  wholesalePriceCents: number;
  retailPriceCents: number;

  stockQuantity: number;
  minimumOrderQuantity: number;

  imageUrl: string | null;
};

export async function getStoreProducts(
  limit?: number
): Promise<StoreProduct[]> {
  const query = db
    .select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      brand: products.brand,

      categoryName:
        categories.name,

      wholesalePriceCents:
        products.wholesalePriceCents,

      retailPriceCents:
        products.retailPriceCents,

      stockQuantity:
        products.stockQuantity,

      minimumOrderQuantity:
        products.minimumOrderQuantity,

      createdAt:
        products.createdAt,
    })
    .from(products)
    .leftJoin(
      categories,
      eq(
        products.categoryId,
        categories.id
      )
    )
    .where(
      eq(products.isActive, true)
    )
    .orderBy(
      desc(products.createdAt)
    );

  const rows = limit
    ? await query.limit(limit)
    : await query;

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map(
    (product) => product.id
  );

  const images = await db
    .select({
      productId:
        productImages.productId,

      url:
        productImages.url,

      position:
        productImages.position,
    })
    .from(productImages)
    .where(
      inArray(
        productImages.productId,
        ids
      )
    )
    .orderBy(
      productImages.position
    );

  const firstImageByProduct =
    new Map<string, string>();

  for (const image of images) {
    if (
      !firstImageByProduct.has(
        image.productId
      )
    ) {
      firstImageByProduct.set(
        image.productId,
        image.url
      );
    }
  }

  return rows.map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    categoryName:
      product.categoryName,

    wholesalePriceCents:
      product.wholesalePriceCents,

    retailPriceCents:
      product.retailPriceCents,

    stockQuantity:
      product.stockQuantity,

    minimumOrderQuantity:
      product.minimumOrderQuantity,

    imageUrl:
      firstImageByProduct.get(
        product.id
      ) ?? null,
  }));
}
