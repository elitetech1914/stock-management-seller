"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, CookingPot, Dumbbell, Grid2X2, House, Shirt, Smartphone, Sparkles, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CatalogCategory } from "@/lib/store-catalog";

const categoryIcons: [RegExp, LucideIcon][] = [
  [/electronics|tech|gadgets/i, Smartphone],
  [/clothing|fashion|apparel/i, Shirt],
  [/home|decor|furniture/i, House],
  [/kitchen|cook/i, CookingPot],
  [/beauty|cosmetics|skin/i, Sparkles],
  [/sports?|fitness|outdoor/i, Dumbbell],
];

export function CategoryStrip({ categories, categoryStatus, onRetryCategories }: {
  categories: CatalogCategory[];
  categoryStatus: "loading" | "ready" | "error";
  onRetryCategories: () => void;
}) {
  const pathname = usePathname();
  const scrollId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ left: false, right: false });

  const updateBounds = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const next = {
      left: element.scrollLeft > 1,
      right: element.scrollWidth - element.clientWidth - element.scrollLeft > 1,
    };
    setBounds((previous) => previous.left === next.left && previous.right === next.right ? previous : next);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const frame = requestAnimationFrame(updateBounds);
    const observer = new ResizeObserver(updateBounds);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [categories, categoryStatus, updateBounds]);

  function scroll(direction: number) {
    const element = scrollRef.current;
    element?.scrollBy({
      left: direction * element.clientWidth * .8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  const arrowClass = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand transition hover:bg-neutral-100 active:bg-neutral-200 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent";
  const linkClass = "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm text-brand transition hover:bg-neutral-100 active:bg-neutral-200";

  return (
    <nav aria-label="Category navigation" className="border-t border-border bg-white">
      <div className="mx-auto flex max-w-[1500px] items-center gap-1 px-4 py-1 sm:px-6 lg:px-8">
        <button type="button" aria-label="Scroll categories left" aria-controls={scrollId} disabled={!bounds.left} onClick={() => scroll(-1)} className={arrowClass}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div id={scrollId} ref={scrollRef} onScroll={updateBounds} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max min-w-full items-center gap-1 whitespace-nowrap p-1">
            <Link href="/products" aria-current={pathname === "/products" ? "page" : undefined} className={linkClass + (pathname === "/products" ? " bg-brand/10 font-semibold" : "")}>
              <Grid2X2 size={20} strokeWidth={1.6} aria-hidden="true" />All products
            </Link>
            {categories.map((category) => {
              const href = "/categories/" + category.slug;
              const Icon = categoryIcons.find(([pattern]) => pattern.test(category.slug + " " + category.name))?.[1] ?? Grid2X2;
              return <Link key={category.id} href={href} aria-current={pathname === href ? "page" : undefined} className={linkClass + (pathname === href ? " bg-brand/10 font-semibold" : "")}>
                <Icon size={20} strokeWidth={1.6} aria-hidden="true" />{category.name}
              </Link>;
            })}
            {categoryStatus === "loading" && <p role="status" className="flex min-h-11 items-center px-3 text-sm text-muted">Loading categories...</p>}
            {categoryStatus === "error" && <div role="alert" className="flex items-center gap-3 px-3 text-sm text-muted">
              <p>Categories could not load.</p>
              <button type="button" onClick={onRetryCategories} className="min-h-11 rounded-lg px-2 font-semibold text-brand underline underline-offset-4">Try again</button>
            </div>}
          </div>
        </div>
        <button type="button" aria-label="Scroll categories right" aria-controls={scrollId} disabled={!bounds.right} onClick={() => scroll(1)} className={arrowClass}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
