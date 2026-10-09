"use client";

import Link from "next/link";
import { Archive, Loader2, Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { archiveProduct, bulkUpdateProducts } from "@/app/admin/(panel)/products/actions";
import { DeleteProductButton } from "@/components/admin/delete-product-button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ADMIN_LOW_STOCK_LIMIT, type AdminProductCategory, type AdminProductRow, type BulkProductState } from "@/lib/admin-product-filters";

const formatMoney = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const initialState: BulkProductState = { success: false, message: "" };

export function ProductsTable({ products, categories }: { products: AdminProductRow[]; categories: AdminProductCategory[] }) {
  const rowsKey = products.map((product) => product.id).join(",");
  const [selection, setSelection] = useState({ rowsKey, ids: [] as string[] });
  if (selection.rowsKey !== rowsKey) setSelection({ rowsKey, ids: [] });
  const selected = selection.rowsKey === rowsKey ? selection.ids : [];
  const [operation, setOperation] = useState("archive");
  const [categoryId, setCategoryId] = useState("");
  const [state, formAction, pending] = useActionState(async (previous: BulkProductState, formData: FormData) => {
    const result = await bulkUpdateProducts(previous, formData);
    if (result.success) setSelection({ rowsKey, ids: [] });
    return result;
  }, initialState);
  const allSelected = products.length > 0 && selected.length === products.length;
  const toggleAll = () => setSelection({ rowsKey, ids: allSelected ? [] : products.map((product) => product.id) });
  const toggle = (id: string) => setSelection({ rowsKey, ids: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id] });

  return (
    <section aria-label="Product results" className="mt-6 rounded-2xl border border-neutral-200 bg-white">
      <div className="rounded-t-2xl border-b border-border bg-neutral-50/70 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm font-medium text-brand">{selected.length ? `${selected.length} selected on this page` : "Select products to update them together"}</p>
          {selected.length > 0 && <button type="button" disabled={pending} onClick={() => setSelection({ rowsKey, ids: [] })} className="min-h-11 rounded-lg px-3 text-sm font-medium text-muted hover:bg-white disabled:opacity-50">Clear selection</button>}
        </div>
        <form action={formAction} aria-label="Bulk product actions" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {selected.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
          <input type="hidden" name="operation" value={operation} />
          <div className="min-w-0 sm:w-52">
            <label id="product-bulk-action-label" htmlFor="product-bulk-action" className="ui-label">Bulk action</label>
            <DropdownSelect id="product-bulk-action" labelledBy="product-bulk-action-label" value={operation} onChange={setOperation} disabled={pending} options={[{ value: "archive", label: "Archive products" }, { value: "activate", label: "Reactivate products" }, { value: "category", label: "Change category" }]} />
          </div>
          {operation === "category" && <div className="min-w-0 sm:w-56">
            <label id="product-bulk-category-label" htmlFor="product-bulk-category" className="ui-label">Assign category</label>
            <input type="hidden" name="categoryId" value={categoryId} />
            <DropdownSelect id="product-bulk-category" labelledBy="product-bulk-category-label" value={categoryId} onChange={setCategoryId} disabled={pending} options={[{ value: "", label: "Choose a category" }, { value: "none", label: "No category" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]} />
          </div>}
          <button type="submit" disabled={pending || !selected.length || (operation === "category" && !categoryId)} aria-busy={pending} className="ui-button shrink-0">
            {pending ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" />Updating...</> : `Apply to ${selected.length} product${selected.length === 1 ? "" : "s"}`}
          </button>
        </form>
        {state.message && <p role={state.success ? "status" : "alert"} className={"mt-3 text-sm " + (state.success ? "text-emerald-700" : "text-red-700")}>{state.message}</p>}
      </div>

      <div className="grid gap-3 rounded-b-2xl bg-background p-3 lg:hidden">
        <SelectAll checked={allSelected} mixed={selected.length > 0 && !allSelected} disabled={pending} onChange={toggleAll} label={`Select all ${products.length} products on this page`} />
        {products.map((product) => <article key={product.id} className={"ui-panel p-4 " + (selected.includes(product.id) ? "ring-2 ring-brand/20" : "")}>
          <div className="flex items-start gap-2">
            <ProductCheckbox product={product} checked={selected.includes(product.id)} disabled={pending} onChange={() => toggle(product.id)} />
            <Link href={`/admin/products/${product.id}/edit`} className="min-w-0 flex-1 break-words pt-2 text-base font-semibold text-brand">{product.title}</Link>
            <ProductStatus active={product.isActive} />
          </div>
          <p className="mt-2 break-words text-xs text-muted">SKU: {product.sku}</p>
          {product.brand && <p className="mt-1 break-words text-xs text-muted">{product.brand}</p>}
          <p className="mt-3 text-sm text-muted">{product.categoryName ?? "No category"}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-border py-3 text-sm">
            <div><dt className="text-xs text-muted">Wholesale</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(product.wholesalePriceCents)}</dd></div>
            <div><dt className="text-xs text-muted">MSRP</dt><dd className="mt-1 tabular-nums">{formatMoney(product.retailPriceCents)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted">Stock</dt><dd className="mt-1 font-medium">{product.stockQuantity} units{product.stockQuantity <= 0 ? " — Out of stock" : product.stockQuantity <= ADMIN_LOW_STOCK_LIMIT ? " — Low stock" : ""}</dd></div>
          </dl>
          <div className="mt-3"><ProductActions product={product} /></div>
        </article>)}
      </div>

      <div className="hidden overflow-x-auto rounded-b-2xl lg:block">
        <table className="w-full min-w-[950px] text-left text-sm">
          <thead className="border-b border-border bg-neutral-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="w-14"><SelectAll checked={allSelected} mixed={selected.length > 0 && !allSelected} disabled={pending} onChange={toggleAll} label={`Select all ${products.length} products on this page`} compact /></th>
              <th scope="col" className="font-medium">Product</th><th scope="col" className="font-medium">Category</th>
              <th scope="col" className="text-right font-medium">Wholesale</th><th scope="col" className="text-right font-medium">MSRP</th>
              <th scope="col" className="text-right font-medium">Stock</th><th scope="col" className="font-medium">Status</th><th scope="col" className="font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {products.map((product) => <tr key={product.id} className={"transition hover:bg-neutral-50/70 " + (selected.includes(product.id) ? "bg-[#f0f5f1]" : "")}>
              <td><ProductCheckbox product={product} checked={selected.includes(product.id)} disabled={pending} onChange={() => toggle(product.id)} /></td>
              <td><Link href={`/admin/products/${product.id}/edit`} className="font-medium text-neutral-900 hover:text-brand hover:underline">{product.title}</Link><p className="mt-1 text-xs text-muted">SKU: {product.sku}</p>{product.brand && <p className="mt-1 text-xs text-muted">{product.brand}</p>}</td>
              <td className="text-muted">{product.categoryName ?? "No category"}</td>
              <td className="text-right font-medium tabular-nums">{formatMoney(product.wholesalePriceCents)}</td>
              <td className="text-right text-muted tabular-nums">{formatMoney(product.retailPriceCents)}</td>
              <td className={"text-right tabular-nums " + (product.stockQuantity <= 0 ? "font-medium text-red-700" : product.stockQuantity <= ADMIN_LOW_STOCK_LIMIT ? "font-medium text-amber-700" : "")}>{product.stockQuantity}</td>
              <td><ProductStatus active={product.isActive} /></td><td><ProductActions product={product} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SelectAll({ checked, mixed, disabled, onChange, label, compact = false }: { checked: boolean; mixed: boolean; disabled: boolean; onChange: () => void; label: string; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed]);
  return <label className="flex min-h-11 min-w-11 cursor-pointer items-center gap-3 text-sm font-medium normal-case tracking-normal text-brand">
    <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} aria-label={label} className="h-4 w-4 shrink-0 accent-brand disabled:cursor-not-allowed" />
    <span className={compact ? "sr-only" : ""}>{label}</span>
  </label>;
}

function ProductCheckbox({ product, checked, disabled, onChange }: { product: AdminProductRow; checked: boolean; disabled: boolean; onChange: () => void }) {
  return <label className="flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} aria-label={`Select ${product.title} (${product.sku})`} className="h-4 w-4 accent-brand disabled:cursor-not-allowed" />
  </label>;
}

function ProductStatus({ active }: { active: boolean }) {
  return <span className={"inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " + (active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600")}>{active ? "Active" : "Archived"}</span>;
}

function ProductActions({ product }: { product: AdminProductRow }) {
  return <div className="flex flex-wrap items-center gap-2">
    <Link href={`/admin/products/${product.id}/edit`} aria-label={`Edit ${product.title}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-brand hover:bg-background"><Pencil size={15} />Edit</Link>
    {product.isActive && <form action={archiveProduct}><input type="hidden" name="id" value={product.id} /><button type="submit" aria-label={`Archive ${product.title}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted hover:bg-amber-50 hover:text-amber-800"><Archive size={15} />Archive</button></form>}
    <DeleteProductButton id={product.id} title={product.title} />
  </div>;
}
