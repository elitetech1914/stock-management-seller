"use client";

import Link from "next/link";
import { ArrowRight, Grid2X2, House, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string; slug: string }[];
  categoryStatus?: "loading" | "ready" | "error";
  onRetryCategories?: () => void;
};

export function StoreNavigation({ open, onOpenChange, categories, categoryStatus = "ready", onRetryCategories }: Props) {
  const pathname = usePathname();
  const close = () => onOpenChange(false);
  const linkClass = "flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-[#17352c] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17352c] active:bg-white/80";
  const current = (href: string) => pathname === href ? "page" as const : undefined;
  const selectedClass = (href: string) => linkClass + (current(href) ? " bg-white font-semibold shadow-sm" : "");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open navigation" aria-controls="store-navigation-menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-[#17352c]">
          <Menu size={22} />
        </button>
      </SheetTrigger>
      <SheetContent
        id="store-navigation-menu"
        side="left"
        showCloseButton={false}
        className="store-sheet glass-surface z-[130] w-[calc(100%-2rem)] gap-0 sm:max-w-[420px]"
        overlayClassName="store-sheet-overlay z-[120] bg-[#0f201a]/25 backdrop-blur-sm"
      >
        <SheetHeader className="shrink-0 flex-row items-center justify-between gap-4 border-b border-white/70 p-4 sm:p-5">
          <SheetTitle className="text-xl font-semibold tracking-tight text-[#17352c]">Browse Stockmora</SheetTitle>
          <SheetDescription className="sr-only">Browse wholesale products and categories.</SheetDescription>
          <SheetClose asChild>
            <button type="button" aria-label="Close navigation" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 hover:bg-white active:bg-white/80 focus-visible:outline-2 focus-visible:outline-[#17352c]"><X size={21} /></button>
          </SheetClose>
        </SheetHeader>
        <div className="store-sheet-content min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <nav aria-label="Shopping navigation" className="grid gap-1">
            <Link href="/" aria-current={current("/")} onClick={close} className={selectedClass("/")}><House size={20} className="shrink-0" />Home</Link>
            <Link href="/products" aria-current={current("/products")} onClick={close} className={selectedClass("/products")}><Grid2X2 size={20} className="shrink-0" />All products</Link>
            <Link href="/products?sort=newest" onClick={close} className={linkClass}>New arrivals<ArrowRight size={16} className="ml-auto shrink-0" /></Link>
          </nav>
          <nav aria-label="Product categories" className="mt-5 grid gap-1">
            <p className="ui-eyebrow px-3 pb-1">Categories</p>
            {categoryStatus === "loading" && <p role="status" className="px-3 py-3 text-sm text-muted">Loading categories...</p>}
            {categoryStatus === "error" && <div role="alert" className="ui-panel p-3 text-sm"><p>Categories could not load.</p><button type="button" onClick={onRetryCategories} className="mt-2 min-h-11 font-semibold underline underline-offset-4">Try again</button></div>}
            {categoryStatus === "ready" && !categories.length && <p className="px-3 py-3 text-sm text-muted">Browse all products while we add categories.</p>}
            {categories.map((category) => <Link key={category.id} href={"/categories/" + category.slug} aria-current={current("/categories/" + category.slug)} onClick={close} className={selectedClass("/categories/" + category.slug)}><span className="min-w-0 break-words">{category.name}</span></Link>)}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
