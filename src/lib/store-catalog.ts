import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  productImages,
  products,
} from "@/db/schema";

export type CatalogProduct = {
  id: string;
  title: string;
  slug: string;
  sku: string;
  brand: string | null;

  categoryName: string | null;
  categorySlug: string | null;

  wholesalePriceCents: number;
  retailPriceCents: number;

  stockQuantity: number;
  minimumOrderQuantity: number;

  imageUrl: string | null;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
};

export type CatalogSort =
  | "newest"
  | "name"
  | "price-asc"
  | "price-desc";

export async function getStoreCategories() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .orderBy(asc(categories.name));
}

export async function getStoreCategoryBySlug(
  slug: string
) {
  const [category] =
    await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      })
      .from(categories)
      .where(
        eq(
          categories.slug,
          slug
        )
      )
      .limit(1);

  return category ?? null;
}

export async function getStoreCatalogProducts({
  query = "",
  categorySlug,
  sort = "newest",
}: {
  query?: string;
  categorySlug?: string;
  sort?: CatalogSort;
} = {}): Promise<CatalogProduct[]> {
  const conditions: SQL[] = [
    eq(
      products.isActive,
      true
    ),
  ];

  const cleanQuery =
    query.trim();

  if (categorySlug) {
    conditions.push(
      eq(
        categories.slug,
        categorySlug
      )
    );
  }

  if (cleanQuery) {
    const pattern =
      `%${cleanQuery}%`;

    const searchCondition =
      or(
        ilike(
          products.title,
          pattern
        ),
        ilike(
          products.sku,
          pattern
        ),
        ilike(
          products.brand,
          pattern
        ),
        ilike(
          products.description,
          pattern
        ),
        ilike(
          categories.name,
          pattern
        )
      );

    if (searchCondition) {
      conditions.push(
        searchCondition
      );
    }
  }

  let orderBy;

  switch (sort) {
    case "name":
      orderBy =
        asc(products.title);
      break;

    case "price-asc":
      orderBy =
        asc(
          products.wholesalePriceCents
        );
      break;

    case "price-desc":
      orderBy =
        desc(
          products.wholesalePriceCents
        );
      break;

    case "newest":
    default:
      orderBy =
        desc(
          products.updatedAt
        );
      break;
  }

  return db
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      sku: products.sku,
      brand: products.brand,

      categoryName:
        categories.name,

      categorySlug:
        categories.slug,

      wholesalePriceCents:
        products.wholesalePriceCents,

      retailPriceCents:
        products.retailPriceCents,

      stockQuantity:
        products.stockQuantity,

      minimumOrderQuantity:
        products.minimumOrderQuantity,

      imageUrl:
        sql<string | null>`
          (
            SELECT
              ${productImages.url}
            FROM ${productImages}
            WHERE
              ${productImages.productId}
              = ${products.id}
            ORDER BY
              ${productImages.position}
              ASC
            LIMIT 1
          )
        `,
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
      and(...conditions)
    )
    .orderBy(orderBy);
}