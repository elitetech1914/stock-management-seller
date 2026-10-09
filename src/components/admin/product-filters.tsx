"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ADMIN_PRODUCT_SORTS, type AdminProductCategory, type AdminProductFilters } from "@/lib/admin-product-filters";

export function ProductFilters({ filters, categories }: { filters: AdminProductFilters; categories: AdminProductCategory[] }) {
  const [category, setCategory] = useState<string>(filters.category);
  const [status, setStatus] = useState<string>(filters.status);
  const [stock, setStock] = useState<string>(filters.stock);
  const [sort, setSort] = useState<string>(filters.sort);
  const categoryOptions = [{ value: "", label: "All categories" }, { value: "none", label: "No category" }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  if (filters.category && !categoryOptions.some((option) => option.value === filters.category)) {
    categoryOptions.push({ value: filters.category, label: "Unavailable category" });
  }

  return (
    <form action="/admin/products" method="GET" role="search" aria-label="Filter products" className="ui-panel mt-8 space-y-5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="admin-product-search" className="ui-label">Search products</label>
          <div className="flex items-center rounded-xl border border-neutral-300 bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
            <Search size={18} aria-hidden="true" className="shrink-0 text-muted" />
            <input id="admin-product-search" name="q" type="search" defaultValue={filters.q} maxLength={200} placeholder="Search by product name, SKU, or brand" className="admin-product-search h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none sm:text-sm" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button type="submit" className="ui-button flex-1 sm:flex-none">Apply filters</button>
          <Link href="/admin/products" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted hover:bg-neutral-100">Reset</Link>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect id="product-category-filter" label="Category" name="category" value={category} onChange={setCategory} options={categoryOptions} />
        <FilterSelect id="product-status-filter" label="Status" name="status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
        <FilterSelect id="product-stock-filter" label="Stock" name="stock" value={stock} onChange={setStock} options={[{ value: "all", label: "All stock levels" }, { value: "in", label: "In stock" }, { value: "low", label: "Low stock (1–10)" }, { value: "out", label: "Out of stock" }]} />
        <FilterSelect id="product-sort-filter" label="Sort by" name="sort" value={sort} onChange={setSort} options={[...ADMIN_PRODUCT_SORTS]} />
      </div>
    </form>
  );
}

function FilterSelect({ id, label, name, ...props }: { id: string; label: string; name: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <div className="min-w-0">
    <label id={id + "-label"} htmlFor={id} className="ui-label">{label}</label>
    <input type="hidden" name={name} value={props.value} />
    <DropdownSelect id={id} labelledBy={id + "-label"} {...props} />
  </div>;
}
