export const ADMIN_PRODUCTS_PAGE_SIZE = 50;
export const ADMIN_LOW_STOCK_LIMIT = 10;

export const ADMIN_PRODUCT_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name: A–Z" },
  { value: "name-desc", label: "Name: Z–A" },
  { value: "price-asc", label: "Wholesale: low to high" },
  { value: "price-desc", label: "Wholesale: high to low" },
  { value: "stock-asc", label: "Stock: low to high" },
  { value: "stock-desc", label: "Stock: high to low" },
] as const;

export type AdminProductFilters = {
  q: string;
  category: string;
  status: "all" | "active" | "archived";
  stock: "all" | "in" | "low" | "out";
  sort: typeof ADMIN_PRODUCT_SORTS[number]["value"];
  page: number;
};

export type AdminProductSearchParams = Record<string, string | string[] | undefined>;
export const PRODUCT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAdminProductFilters(params: AdminProductSearchParams): AdminProductFilters {
  const first = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const category = first("category");
  const status = first("status");
  const stock = first("stock");
  const sort = first("sort");
  const page = Number(first("page"));
  return {
    q: first("q").trim().slice(0, 200),
    category: category === "none" || PRODUCT_UUID.test(category) ? category : "",
    status: status === "active" || status === "archived" ? status : "all",
    stock: stock === "in" || stock === "low" || stock === "out" ? stock : "all",
    sort: ADMIN_PRODUCT_SORTS.find((option) => option.value === sort)?.value ?? "newest",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function adminProductsHref(filters: AdminProductFilters, page = filters.page) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.stock !== "all") params.set("stock", filters.stock);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return "/admin/products" + (query ? "?" + query : "");
}

export type AdminProductRow = {
  id: string;
  title: string;
  sku: string;
  brand: string | null;
  wholesalePriceCents: number;
  retailPriceCents: number;
  stockQuantity: number;
  isActive: boolean;
  categoryName: string | null;
};

export type AdminProductCategory = { id: string; name: string };
export type BulkProductState = { success: boolean; message: string };
export type BulkProductRequest = {
  ids: string[];
  operation: "archive" | "activate" | "category";
  categoryId: string | null;
};

export class AdminProductInputError extends Error {}

export function parseBulkProductRequest(formData: FormData): BulkProductRequest {
  const values = formData.getAll("ids");
  if (!values.length || values.length > ADMIN_PRODUCTS_PAGE_SIZE) {
    throw new AdminProductInputError("Select between 1 and 50 products on this page.");
  }
  if (values.some((value) => typeof value !== "string" || !PRODUCT_UUID.test(value))) {
    throw new AdminProductInputError("The product selection is invalid. Refresh and try again.");
  }
  const operation = formData.get("operation");
  if (operation !== "archive" && operation !== "activate" && operation !== "category") {
    throw new AdminProductInputError("Choose a bulk action.");
  }
  const category = formData.get("categoryId");
  if (operation === "category" && category !== "none" && (typeof category !== "string" || !PRODUCT_UUID.test(category))) {
    throw new AdminProductInputError("Choose the category to assign.");
  }
  return { ids: [...new Set(values as string[])], operation, categoryId: operation === "category" && category !== "none" ? category as string : null };
}
