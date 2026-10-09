import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Package, Plus } from "lucide-react";
import { db } from "@/db";
import { ProductFilters } from "@/components/admin/product-filters";
import { ProductsTable } from "@/components/admin/products-table";
import { getAdminProducts } from "@/lib/admin-products";
import { ADMIN_PRODUCTS_PAGE_SIZE, adminProductsHref, parseAdminProductFilters, type AdminProductFilters, type AdminProductSearchParams } from "@/lib/admin-product-filters";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<AdminProductSearchParams> }) {
  const params = await searchParams;
  const { filters, total, totalPages, productList, categoryList } = await getAdminProducts(db, params);
  if (parseAdminProductFilters(params).page !== filters.page) redirect(adminProductsHref(filters));
  const hasFilters = Boolean(filters.q || filters.category || filters.status !== "all" || filters.stock !== "all");
  const filtersKey = adminProductsHref(filters);
  return (
    <div className="p-4 sm:p-6 lg:p-8 2xl:p-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">Catalog</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Products</h1>
          <p className="mt-2 text-sm text-muted">Manage products, pricing and inventory.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/import" className="ui-button ui-button-secondary">Import CSV</Link>
          <Link href="/admin/products/new" className="ui-button"><Plus size={17} />Add product</Link>
        </div>
      </div>
      <ProductFilters key={filtersKey} filters={filters} categories={categoryList} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-brand">{total.toLocaleString("en-US")} {hasFilters ? "matching " : ""}product{total === 1 ? "" : "s"}</p>
        <p className="text-muted">{ADMIN_PRODUCTS_PAGE_SIZE} products per page</p>
      </div>
      {productList.length ? <>
        <ProductsTable key={filtersKey} products={productList} categories={categoryList} />
        <ProductPagination filters={filters} total={total} totalPages={totalPages} pageCount={productList.length} />
      </> : <section className="ui-panel mt-6 flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ef] text-brand"><Package size={24} /></div>
        <h2 className="mt-5 text-lg font-semibold">{hasFilters ? "No products match these filters" : "No products yet"}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{hasFilters ? "Try a different search or clear the filters to see more products." : "Add your first product or import your supplier catalog using CSV."}</p>
        <Link href={hasFilters ? "/admin/products" : "/admin/products/new"} className="ui-button mt-5">{hasFilters ? "Clear filters" : "Add product"}</Link>
      </section>}
    </div>
  );
}

function ProductPagination({ filters, total, totalPages, pageCount }: { filters: AdminProductFilters; total: number; totalPages: number; pageCount: number }) {
  const start = (filters.page - 1) * ADMIN_PRODUCTS_PAGE_SIZE + 1;
  const pages = [...new Set([1, totalPages, ...Array.from({ length: 5 }, (_, index) => filters.page + index - 2).filter((page) => page > 0 && page <= totalPages)])].sort((a, b) => a - b);
  const linkClass = "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-border bg-white px-3 text-sm font-medium text-brand transition hover:bg-neutral-100";
  return <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
    <p className="text-sm text-muted">Showing {start.toLocaleString("en-US")}–{(start + pageCount - 1).toLocaleString("en-US")} of {total.toLocaleString("en-US")} products</p>
    <nav aria-label="Products pagination" className="flex flex-wrap items-center gap-1">
      {filters.page > 1 ? <Link href={adminProductsHref(filters, filters.page - 1)} prefetch={false} rel="prev" className={linkClass}><ChevronLeft size={16} /><span className="sr-only sm:not-sr-only">Previous</span></Link> : <span aria-disabled="true" className={linkClass + " opacity-40"}><ChevronLeft size={16} /><span className="sr-only sm:not-sr-only">Previous</span></span>}
      {pages.map((page, index) => <span key={page} className="flex items-center gap-1">
        {index > 0 && page - pages[index - 1] > 1 && <span aria-hidden="true" className="px-1 text-muted">…</span>}
        <Link href={adminProductsHref(filters, page)} prefetch={false} aria-label={"Page " + page} aria-current={page === filters.page ? "page" : undefined} className={linkClass + (page === filters.page ? " border-brand bg-brand! text-white! hover:bg-brand!" : "")}>{page}</Link>
      </span>)}
      {filters.page < totalPages ? <Link href={adminProductsHref(filters, filters.page + 1)} prefetch={false} rel="next" className={linkClass}><span className="sr-only sm:not-sr-only">Next</span><ChevronRight size={16} /></Link> : <span aria-disabled="true" className={linkClass + " opacity-40"}><span className="sr-only sm:not-sr-only">Next</span><ChevronRight size={16} /></span>}
    </nav>
    <p className="text-xs text-muted sm:basis-full">Page {filters.page} of {totalPages}</p>
  </div>;
}
