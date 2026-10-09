import "server-only";

import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { categories, products } from "@/db/schema";
import { ADMIN_LOW_STOCK_LIMIT, ADMIN_PRODUCTS_PAGE_SIZE, AdminProductInputError, parseAdminProductFilters, type AdminProductSearchParams, type BulkProductRequest } from "./admin-product-filters";

export async function getAdminProducts(database: Pick<NodePgDatabase, "select">, params: AdminProductSearchParams) {
  const filters = parseAdminProductFilters(params);
  const conditions: SQL[] = [];
  if (filters.q) {
    // Supplier SKUs can contain '%' and '_'; search them literally.
    const pattern = "%" + filters.q.replace(/[\\%_]/g, "\\$&") + "%";
    conditions.push(or(ilike(products.title, pattern), ilike(products.sku, pattern), ilike(products.brand, pattern))!);
  }
  if (filters.category === "none") conditions.push(isNull(products.categoryId));
  else if (filters.category) conditions.push(eq(products.categoryId, filters.category));
  if (filters.status !== "all") conditions.push(eq(products.isActive, filters.status === "active"));
  if (filters.stock === "in") conditions.push(gt(products.stockQuantity, 0));
  if (filters.stock === "low") conditions.push(and(gt(products.stockQuantity, 0), lte(products.stockQuantity, ADMIN_LOW_STOCK_LIMIT))!);
  if (filters.stock === "out") conditions.push(lte(products.stockQuantity, 0));
  const where = and(...conditions);
  const [[{ total }], categoryList] = await Promise.all([
    database.select({ total: count() }).from(products).where(where),
    database.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name), asc(categories.id)),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const ordering = {
    newest: desc(products.createdAt), oldest: asc(products.createdAt),
    "name-asc": asc(products.title), "name-desc": desc(products.title),
    "price-asc": asc(products.wholesalePriceCents), "price-desc": desc(products.wholesalePriceCents),
    "stock-asc": asc(products.stockQuantity), "stock-desc": desc(products.stockQuantity),
  };
  const productList = await database.select({
    id: products.id, title: products.title, sku: products.sku, brand: products.brand,
    wholesalePriceCents: products.wholesalePriceCents, retailPriceCents: products.retailPriceCents,
    stockQuantity: products.stockQuantity, isActive: products.isActive, categoryName: categories.name,
  }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(where)
    .orderBy(ordering[filters.sort], asc(products.id))
    .limit(ADMIN_PRODUCTS_PAGE_SIZE).offset((page - 1) * ADMIN_PRODUCTS_PAGE_SIZE);
  return { filters: { ...filters, page }, total, totalPages, productList, categoryList };
}

export async function applyBulkProductUpdate(database: Pick<NodePgDatabase, "transaction">, request: BulkProductRequest) {
  return database.transaction(async (tx) => {
    const selected = await tx.select({ id: products.id }).from(products).where(inArray(products.id, request.ids)).orderBy(asc(products.id)).for("update");
    if (selected.length !== request.ids.length) {
      throw new AdminProductInputError("Some selected products no longer exist. Refresh the page and select again.");
    }
    if (request.operation === "category" && request.categoryId) {
      const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, request.categoryId)).for("key share");
      if (!category) throw new AdminProductInputError("That category no longer exists. Choose another category.");
    }
    const changes = request.operation === "category" ? { categoryId: request.categoryId } : { isActive: request.operation === "activate" };
    const updated = await tx.update(products).set({ ...changes, updatedAt: new Date() }).where(inArray(products.id, request.ids)).returning({ id: products.id });
    return updated.length;
  });
}

