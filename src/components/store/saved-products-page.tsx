"use client";
import { Heart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSavedProducts } from "@/lib/saved-products";
import { ProductCard } from "@/components/store/product-card";
import { useHydrated } from "@/lib/use-hydrated";

export function SavedProductsPage() {
  const { products, totalSaved, clear } = useSavedProducts();
  const hydrated = useHydrated();
  return <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="ui-eyebrow">Your shortlist</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Saved products</h1><p className="mt-2 text-sm text-muted">{hydrated ? `${totalSaved} ${totalSaved === 1 ? "product" : "products"} saved` : "Loading saved products..."}</p></div>
      {hydrated && totalSaved > 0 && <button type="button" onClick={() => { if (window.confirm("Remove all saved products?")) clear(); }} className="ui-button ui-button-secondary text-red-700"><Trash2 size={16} />Clear saved</button>}
    </div>
    {!hydrated ? <div role="status" className="ui-panel mt-8 flex min-h-[300px] items-center justify-center px-6 text-sm text-muted">Loading your shortlist...</div> : !products.length ? <div className="ui-panel mt-8 flex min-h-[300px] flex-col items-center justify-center px-6 text-center"><Heart size={28} className="text-muted" /><h2 className="mt-4 font-semibold">Your shortlist starts here</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted">Tap the heart on any product to save it for your next wholesale order.</p><Link href="/products" className="ui-button mt-5">Browse products</Link></div> : <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div>}
  </section>;
}
