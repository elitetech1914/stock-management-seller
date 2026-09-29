"use server";

import {
  eq,
  or,
} from "drizzle-orm";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";

import { db } from "@/db";

import {
  categories,
  productImages,
  products,
  productVariants,
} from "@/db/schema";

import { auth } from "@/lib/auth";
import { slugify } from "@/lib/slugify";

import type { ImportState } from "./import-state";

type CsvRow = {
  title?: string;
  url_handle?: string;

  description?: string;
  brand?: string;
  category?: string;

  status?: string;
  published?: string;

  sku?: string;
  barcode?: string;

  option1_name?: string;
  option1_value?: string;

  option2_name?: string;
  option2_value?: string;

  option3_name?: string;
  option3_value?: string;

  cost_price?: string;

  wholesale_price?: string;
  retail_price?: string;

  stock?: string;

  moq?: string;
  case_quantity?: string;

  product_image_url?: string;
  image_position?: string;
  image_alt_text?: string;

  variant_image_url?: string;

  active?: string;
};

type ProductGroup = {
  key: string;
  rows: CsvRow[];
};

const headerAliases: Record<
  string,
  string
> = {
  // Product
  title: "title",
  name: "title",
  product_name: "title",
  product_title: "title",

  url_handle: "url_handle",
  handle: "url_handle",

  description: "description",
  product_description: "description",
  body_html: "description",

  vendor: "brand",
  brand: "brand",
  manufacturer: "brand",

  product_category: "category",
  category: "category",
  product_type: "category",

  status: "status",

  published_on_online_store:
    "published",

  published: "published",

  // Variant identity
  sku: "sku",
  product_sku: "sku",
  variant_sku: "sku",
  item_sku: "sku",

  barcode: "barcode",
  variant_barcode: "barcode",

  // Options
  option1_name: "option1_name",
  option1_value: "option1_value",

  option2_name: "option2_name",
  option2_value: "option2_value",

  option3_name: "option3_name",
  option3_value: "option3_value",

  // Pricing
  price: "wholesale_price",
  wholesale_price:
    "wholesale_price",
  selling_price:
    "wholesale_price",

  compare_at_price:
    "retail_price",

  retail_price: "retail_price",
  msrp: "retail_price",
  rrp: "retail_price",

  cost_per_item: "cost_price",
  cost_price: "cost_price",
  cost: "cost_price",

  // Inventory
  inventory_quantity: "stock",
  variant_inventory_qty: "stock",
  stock_quantity: "stock",
  quantity: "stock",
  stock: "stock",
  qty: "stock",

  // Wholesale-specific
  moq: "moq",
  minimum_order_quantity: "moq",

  case_quantity: "case_quantity",
  case_qty: "case_quantity",

  // Images
  product_image_url:
    "product_image_url",

  image_src:
    "product_image_url",

  image_url:
    "product_image_url",

  image_position:
    "image_position",

  image_alt_text:
    "image_alt_text",

  variant_image_url:
    "variant_image_url",

  variant_image:
    "variant_image_url",

  // Generic active column
  active: "active",
};

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

function emptyState(
  message: string
): ImportState {
  return {
    success: false,
    message,

    totalRows: 0,

    created: 0,
    updated: 0,

    variantsCreated: 0,
    variantsUpdated: 0,

    failed: 0,

    errors: [],
  };
}

function normalizeCsvHeader(
  header: string
) {
  const normalized = header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return (
    headerAliases[normalized] ??
    normalized
  );
}

function moneyToCents(
  value?: string
) {
  const cleaned = String(
    value ?? ""
  )
    .replace(/[$£€,\s]/g, "")
    .trim();

  if (!cleaned) {
    return 0;
  }

  const amount = Number(cleaned);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 100);
}

function toInteger(
  value: string | undefined,
  fallback: number,
  minimum = 0
) {
  const cleaned = String(
    value ?? ""
  )
    .replace(/,/g, "")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.trunc(parsed)
  );
}

function toBoolean(
  value: string | undefined,
  fallback = true
) {
  if (
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "active",
      "published",
      "enabled",
    ].includes(normalized)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "inactive",
      "draft",
      "disabled",
    ].includes(normalized)
  ) {
    return false;
  }

  return fallback;
}

function firstNonEmpty(
  rows: CsvRow[],
  key: keyof CsvRow
) {
  for (const row of rows) {
    const value = row[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function cleanCategoryName(
  category: string
) {
  if (!category) {
    return "";
  }

  /*
   * Shopify taxonomy example:
   *
   * Apparel & Accessories >
   * Clothing >
   * Clothing Tops >
   * T-Shirts
   *
   * For now Stockmora keeps the leaf:
   * T-Shirts
   */
  const parts = category
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    parts[parts.length - 1] ??
    category.trim()
  );
}

async function getOrCreateCategory(
  rawName: string
) {
  const cleanedName =
    cleanCategoryName(rawName);

  if (!cleanedName) {
    return null;
  }

  const categorySlug =
    slugify(cleanedName);

  const [existing] = await db
    .select({
      id: categories.id,
    })
    .from(categories)
    .where(
      eq(
        categories.slug,
        categorySlug
      )
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [created] = await db
    .insert(categories)
    .values({
      name: cleanedName,
      slug: categorySlug,
    })
    .returning({
      id: categories.id,
    });

  return created.id;
}

function groupRows(
  rows: CsvRow[]
): ProductGroup[] {
  const groups = new Map<
    string,
    CsvRow[]
  >();

  let fallbackIndex = 0;

  for (const row of rows) {
    const handle =
      row.url_handle?.trim();

    /*
     * Shopify rows belonging to the same
     * product all share the same handle.
     */
    const key =
      handle ||
      row.sku?.trim() ||
      `row-${fallbackIndex++}`;

    const existing =
      groups.get(key) ?? [];

    existing.push(row);

    groups.set(key, existing);
  }

  return Array.from(
    groups.entries()
  ).map(([key, groupedRows]) => ({
    key,
    rows: groupedRows,
  }));
}

function getProductImages(
  rows: CsvRow[]
) {
  const images = new Map<
    string,
    {
      url: string;
      position: number;
      altText: string | null;
    }
  >();

  for (const row of rows) {
    const url =
      row.product_image_url?.trim();

    if (!url) {
      continue;
    }

    if (images.has(url)) {
      continue;
    }

    images.set(url, {
      url,

      position: toInteger(
        row.image_position,
        images.size,
        0
      ),

      altText:
        row.image_alt_text?.trim() ||
        null,
    });
  }

  return Array.from(
    images.values()
  ).sort(
    (a, b) =>
      a.position - b.position
  );
}

function getVariantRows(
  rows: CsvRow[]
) {
  return rows.filter(
    (row) =>
      Boolean(row.sku?.trim())
  );
}

function minNonZero(
  values: number[]
) {
  const positive = values.filter(
    (value) => value > 0
  );

  if (!positive.length) {
    return 0;
  }

  return Math.min(...positive);
}

function maxValue(
  values: number[]
) {
  if (!values.length) {
    return 0;
  }

  return Math.max(...values);
}

export async function importProducts(
  previousState: ImportState,
  formData: FormData
): Promise<ImportState> {
  await requireAdmin();

  const file =
    formData.get("file");

  if (!(file instanceof File)) {
    return emptyState(
      "Please select a CSV file."
    );
  }

  if (
    !file.name
      .toLowerCase()
      .endsWith(".csv")
  ) {
    return emptyState(
      "Only CSV files are supported."
    );
  }

  if (file.size === 0) {
    return emptyState(
      "The selected CSV file is empty."
    );
  }

  let rows: CsvRow[];

  try {
    const csvText =
      await file.text();

    rows = parse(csvText, {
      columns: (
        headers: string[]
      ) =>
        headers.map(
          normalizeCsvHeader
        ),

      skip_empty_lines: true,

      trim: true,
      bom: true,

      relax_column_count: true,
    }) as CsvRow[];
  } catch (error) {
    console.error(
      "CSV parsing error:",
      error
    );

    return emptyState(
      "The CSV could not be parsed. Check the file formatting."
    );
  }

  if (!rows.length) {
    return emptyState(
      "The CSV contains no product rows."
    );
  }

  const detectedColumns =
    Object.keys(rows[0] ?? {});

  if (
    !detectedColumns.includes("sku")
  ) {
    return emptyState(
      `Could not find an SKU column. Detected columns: ${detectedColumns.join(
        ", "
      )}`
    );
  }

  const groups =
    groupRows(rows);

  let created = 0;
  let updated = 0;

  let variantsCreated = 0;
  let variantsUpdated = 0;

  let failed = 0;

  const errors: string[] = [];

  for (const group of groups) {
    const groupRows =
      group.rows;

    const title =
      firstNonEmpty(
        groupRows,
        "title"
      );

    const handle =
      firstNonEmpty(
        groupRows,
        "url_handle"
      );

    const variantRows =
      getVariantRows(groupRows);

    const firstVariant =
      variantRows[0];

    if (!title) {
      failed++;

      errors.push(
        `Product "${group.key}": could not determine a title.`
      );

      continue;
    }

    if (!firstVariant?.sku) {
      failed++;

      errors.push(
        `${title}: no SKU was found for the product.`
      );

      continue;
    }

    try {
      const description =
        firstNonEmpty(
          groupRows,
          "description"
        );

      const brand =
        firstNonEmpty(
          groupRows,
          "brand"
        );

      const category =
        firstNonEmpty(
          groupRows,
          "category"
        );

      const status =
        firstNonEmpty(
          groupRows,
          "status"
        );

      const genericActive =
        firstNonEmpty(
          groupRows,
          "active"
        );

      const productActive =
        status
          ? toBoolean(
              status,
              true
            )
          : toBoolean(
              genericActive,
              true
            );

      const categoryId =
        category
          ? await getOrCreateCategory(
              category
            )
          : null;

      const productSlug =
        handle
          ? slugify(handle)
          : slugify(
              `${title}-${firstVariant.sku}`
            );

      const option1Name =
        firstNonEmpty(
          groupRows,
          "option1_name"
        ) || null;

      const option2Name =
        firstNonEmpty(
          groupRows,
          "option2_name"
        ) || null;

      const option3Name =
        firstNonEmpty(
          groupRows,
          "option3_name"
        ) || null;

      const variantPrices =
        variantRows.map(
          (row) =>
            moneyToCents(
              row.wholesale_price
            )
        );

      const variantRetailPrices =
        variantRows.map(
          (row) =>
            moneyToCents(
              row.retail_price
            )
        );

      const variantCosts =
        variantRows.map(
          (row) =>
            moneyToCents(
              row.cost_price
            )
        );

      const aggregateStock =
        variantRows.reduce(
          (sum, row) =>
            sum +
            toInteger(
              row.stock,
              0,
              0
            ),
          0
        );

      const summaryWholesale =
        minNonZero(
          variantPrices
        );

      const summaryRetail =
        maxValue(
          variantRetailPrices
        );

      const summaryCost =
        minNonZero(
          variantCosts
        );

      /*
       * Important:
       * Earlier importer versions already
       * created the first row of some of
       * these products.
       *
       * Therefore match by either:
       * - Shopify handle/slug
       * - first/default SKU
       */
      const [existingProduct] =
        await db
          .select({
            id: products.id,
          })
          .from(products)
          .where(
            or(
              eq(
                products.slug,
                productSlug
              ),

              eq(
                products.sku,
                firstVariant.sku.trim()
              )
            )
          )
          .limit(1);

      let productId: string;

      const productValues = {
        title,
        slug: productSlug,

        sku:
          firstVariant.sku.trim(),

        description:
          description || null,

        brand:
          brand || null,

        categoryId,

        costPriceCents:
          summaryCost,

        wholesalePriceCents:
          summaryWholesale,

        retailPriceCents:
          summaryRetail,

        stockQuantity:
          aggregateStock,

        isActive:
          productActive,

        updatedAt:
          new Date(),
      };

      if (existingProduct) {
        await db
          .update(products)
          .set(productValues)
          .where(
            eq(
              products.id,
              existingProduct.id
            )
          );

        productId =
          existingProduct.id;

        updated++;
      } else {
        const [newProduct] =
          await db
            .insert(products)
            .values({
              ...productValues,

              minimumOrderQuantity:
                1,

              caseQuantity:
                1,
            })
            .returning({
              id: products.id,
            });

        productId =
          newProduct.id;

        created++;
      }

      /*
       * Product images.
       *
       * Only replace them if the CSV
       * actually provides product images.
       */
      const productImageRows =
        getProductImages(
          groupRows
        );

      if (
        productImageRows.length > 0
      ) {
        await db
          .delete(productImages)
          .where(
            eq(
              productImages.productId,
              productId
            )
          );

        await db
          .insert(productImages)
          .values(
            productImageRows.map(
              (image, index) => ({
                productId,

                url: image.url,

                altText:
                  image.altText ||
                  title,

                position:
                  image.position ??
                  index,
              })
            )
          );
      }

      /*
       * Variants.
       *
       * Shopify repeats option values on
       * each row, while option names may
       * only appear on the first row.
       */
      for (
        const variantRow
        of variantRows
      ) {
        const variantSku =
          variantRow.sku?.trim();

        if (!variantSku) {
          continue;
        }

        const [existingVariant] =
          await db
            .select({
              id:
                productVariants.id,
            })
            .from(productVariants)
            .where(
              eq(
                productVariants.sku,
                variantSku
              )
            )
            .limit(1);

        const variantValues = {
          productId,

          sku: variantSku,

          barcode:
            variantRow.barcode?.trim() ||
            null,

          option1Name,

          option1Value:
            variantRow.option1_value?.trim() ||
            null,

          option2Name,

          option2Value:
            variantRow.option2_value?.trim() ||
            null,

          option3Name,

          option3Value:
            variantRow.option3_value?.trim() ||
            null,

          costPriceCents:
            moneyToCents(
              variantRow.cost_price
            ),

          wholesalePriceCents:
            moneyToCents(
              variantRow.wholesale_price
            ),

          retailPriceCents:
            moneyToCents(
              variantRow.retail_price
            ),

          stockQuantity:
            toInteger(
              variantRow.stock,
              0,
              0
            ),

          imageUrl:
            variantRow.variant_image_url?.trim() ||
            null,

          isActive:
            productActive,

          updatedAt:
            new Date(),
        };

        if (existingVariant) {
          await db
            .update(
              productVariants
            )
            .set(
              variantValues
            )
            .where(
              eq(
                productVariants.id,
                existingVariant.id
              )
            );

          variantsUpdated++;
        } else {
          await db
            .insert(
              productVariants
            )
            .values(
              variantValues
            );

          variantsCreated++;
        }
      }
    } catch (error) {
      failed++;

      console.error(
        `Product import failed for ${group.key}:`,
        error
      );

      errors.push(
        `${group.key}: failed to import.`
      );
    }
  }

  revalidatePath(
    "/admin/products"
  );

  revalidatePath(
    "/admin/categories"
  );

  revalidatePath(
    "/admin"
  );

  revalidatePath("/");

  return {
    success:
      failed === 0,

    message:
      failed === 0
        ? "Import completed successfully."
        : "Import completed with some errors.",

    totalRows:
      rows.length,

    created,
    updated,

    variantsCreated,
    variantsUpdated,

    failed,

    errors:
      errors.slice(0, 50),
  };
}