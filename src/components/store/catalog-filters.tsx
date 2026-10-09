"use client";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DropdownSelect } from "@/components/ui/dropdown-select";

type Category = { id: string; name: string; slug: string };
const sortOptions = [
  { label: "Newest", value: "newest" },
  { label: "Name A-Z", value: "name" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
];

export function CatalogFilters(props: { categories: Category[]; query: string; categorySlug?: string; sort: string }) {
  // A URL change starts a fresh draft, including browser back/forward navigation.
  return <FilterForm key={JSON.stringify([props.query, props.categorySlug, props.sort])} {...props} />;
}
function FilterForm({ categories, query, categorySlug, sort }: { categories: Category[]; query: string; categorySlug?: string; sort: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState(categorySlug ?? "");
  const [selectedSort, setSelectedSort] = useState(sort);
  const [expanded, setExpanded] = useState(false);
  function navigate(q: string, category: string, nextSort: string) {
    const params = new URLSearchParams(searchParams.toString());
    for (const name of ["q", "category", "sort"]) params.delete(name);
    if (q.trim()) params.set("q", q.trim());
    if (category) params.set("category", category);
    if (nextSort !== "newest") params.set("sort", nextSort);
    router.push(pathname + (params.size ? "?" + params.toString() : ""));
  }
  const activeCount = Number(Boolean(query)) + Number(Boolean(categorySlug)) + Number(sort !== "newest");
  const chips = [
    ...(query ? [{ label: "Search: " + query, clear: () => navigate("", categorySlug ?? "", sort) }] : []),
    ...(categorySlug ? [{ label: categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug, clear: () => navigate(query, "", sort) }] : []),
    ...(sort !== "newest" ? [{ label: sortOptions.find((o) => o.value === sort)?.label ?? sort, clear: () => navigate(query, categorySlug ?? "", "newest") }] : []),
  ];
  return <div className="relative z-30 mt-6 ui-panel p-4">
    <button type="button" aria-expanded={expanded} aria-controls="catalog-filter-fields" onClick={() => setExpanded(!expanded)} className="flex min-h-11 w-full items-center gap-2 text-sm font-semibold lg:hidden"><SlidersHorizontal size={18} />Search and filters{activeCount > 0 && <span className="rounded-full bg-background px-2 py-1 text-xs">{activeCount}</span>}<ChevronDown size={17} className={"ml-auto transition-transform " + (expanded ? "rotate-180" : "")} /></button>
    <form id="catalog-filter-fields" onSubmit={(event) => { event.preventDefault(); navigate(searchValue, selectedCategory, selectedSort); }} className={(expanded ? "grid" : "hidden") + " gap-4 pt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_210px_210px_auto] lg:items-end lg:pt-0"}>
      <div className="min-w-0"><label htmlFor="catalog-query" className="ui-label">Search products</label><div className="flex h-11 items-center rounded-xl border border-border bg-white px-3 focus-within:border-brand"><Search size={17} aria-hidden="true" className="shrink-0 text-muted" /><input id="catalog-query" type="search" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Product, SKU or brand" className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none lg:text-sm" /></div></div>
      <div><label id="catalog-category-label" htmlFor="catalog-category" className="ui-label">Category</label><DropdownSelect id="catalog-category" labelledBy="catalog-category-label" value={selectedCategory} onChange={setSelectedCategory} options={[{ label: "All categories", value: "" }, ...categories.map((c) => ({ label: c.name, value: c.slug }))]} /></div>
      <div><label id="catalog-sort-label" htmlFor="catalog-sort" className="ui-label">Sort by</label><DropdownSelect id="catalog-sort" labelledBy="catalog-sort-label" value={selectedSort} onChange={setSelectedSort} options={sortOptions} /></div>
      <button type="submit" className="ui-button">Apply filters</button>
    </form>
    {chips.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3" aria-label="Applied filters">{chips.map((chip) => <button type="button" key={chip.label} onClick={chip.clear} aria-label={"Remove filter " + chip.label} className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-lg bg-background px-3 text-xs font-medium"><span className="truncate">{chip.label}</span><X size={14} className="shrink-0" /></button>)}<button type="button" onClick={() => { setSearchValue(""); setSelectedCategory(""); setSelectedSort("newest"); navigate("", "", "newest"); }} className="min-h-11 px-2 text-sm font-semibold text-brand underline underline-offset-4">Reset all</button></div>}
  </div>;
}
export function CategorySort({ sort }: { sort: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <div className="w-full sm:w-[210px]"><label id="category-sort-label" htmlFor="category-sort" className="ui-label">Sort by</label><DropdownSelect id="category-sort" labelledBy="category-sort-label" value={sort} options={sortOptions} onChange={(value) => { const params = new URLSearchParams(searchParams.toString()); params.delete("sort"); if (value !== "newest") params.set("sort", value); router.push(pathname + (params.size ? "?" + params.toString() : "")); }} /></div>;
}
