import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  productImages,
  products,
  productVariants,
} from "@/db/schema";

export type StoreVariant = {
  id: string;
  sku: string;
  barcode: string | null;

  option1Name: string | null;
  option1Value: string | null;

  option2Name: string | null;
  option2Value: string | null;

  option3Name: string | null;
  option3Value: string | null;

  costPriceCents: number;
  wholesalePriceCents: number;
  retailPriceCents: number;

  stockQuantity: number;

  imageUrl: string | null;

  isActive: boolean;
};

export type StoreProductDetail = {
  id: string;
  slug: string;
  title: string;
  sku: string;

  description: string | null;
  brand: string | null;

  categoryName: string | null;

  wholesalePriceCents: number;
  retailPriceCents: number;

  stockQuantity: number;

  minimumOrderQuantity: number;
  caseQuantity: number;

  images: {
    id: string;
    url: string;
    altText: string | null;
  }[];

  variants: StoreVariant[];
};

export async function getStoreProductBySlug(
  slug: string
): Promise<StoreProductDetail | null> {
  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      sku: products.sku,

      description:
        products.description,

      brand:
        products.brand,

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

      caseQuantity:
        products.caseQuantity,
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
      and(
        eq(products.slug, slug),
        eq(products.isActive, true)
      )
    )
    .limit(1);

  if (!product) {
    return null;
  }

  const images = await db
    .select({
      id: productImages.id,
      url: productImages.url,
      altText: productImages.altText,
      position: productImages.position,
    })
    .from(productImages)
    .where(
      eq(
        productImages.productId,
        product.id
      )
    )
    .orderBy(
      asc(productImages.position)
    );

  const variants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      barcode: productVariants.barcode,

      option1Name:
        productVariants.option1Name,

      option1Value:
        productVariants.option1Value,

      option2Name:
        productVariants.option2Name,

      option2Value:
        productVariants.option2Value,

      option3Name:
        productVariants.option3Name,

      option3Value:
        productVariants.option3Value,

      costPriceCents:
        productVariants.costPriceCents,

      wholesalePriceCents:
        productVariants.wholesalePriceCents,

      retailPriceCents:
        productVariants.retailPriceCents,

      stockQuantity:
        productVariants.stockQuantity,

      imageUrl:
        productVariants.imageUrl,

      isActive:
        productVariants.isActive,
    })
    .from(productVariants)
    .where(
      and(
        eq(
          productVariants.productId,
          product.id
        ),
        eq(
          productVariants.isActive,
          true
        )
      )
    )
    .orderBy(
      asc(productVariants.createdAt)
    );

  return {
    ...product,

    images: images.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.altText,
    })),

    variants,
  };
}