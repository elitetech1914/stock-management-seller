"use client";

import Link from "next/link";
import { Grid2X2, Heart, House, LogOut, Menu, MoreHorizontal, Package, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type StoreMenu = "categories" | "more";

type Props = {
  menu: StoreMenu | null;
  onMenuChange: (menu: StoreMenu | null) => void;
  categories: { id: string; name: string; slug: string }[];
  totalItems: number;
  totalSaved: number;
  signedIn: boolean;
  isAdmin: boolean;
  onSignOut: () => void;
  onSignIn: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function StoreNavigation({ menu, onMenuChange, categories, totalItems, totalSaved, signedIn, isAdmin, onSignOut, onSignIn }: Props) {
  const pathname = usePathname();
  const openerRef = useRef<HTMLElement | null>(null);
  const [lastMenu, setLastMenu] = useState<StoreMenu>(menu ?? "categories");
  if (menu && menu !== lastMenu) setLastMenu(menu);
  const section = menu ?? lastMenu;
  const open = menu !== null;
  const close = () => onMenuChange(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const dismiss = () => {
      if (desktop.matches) onMenuChange(null);
    };
    desktop.addEventListener("change", dismiss);
    return () => desktop.removeEventListener("change", dismiss);
  }, [onMenuChange]);

  function openMenu(next: StoreMenu) {
    if (window.matchMedia("(width < 1024px)").matches) onMenuChange(next);
  }
  const categoryActive = pathname.startsWith("/categories") || pathname.startsWith("/products");
  const cartActive = pathname === "/cart" || pathname === "/checkout";
  const moreActive = !categoryActive && !cartActive && pathname !== "/";
  const itemClass = (active: boolean) => `mobile-nav-item ${active ? "is-active" : ""}`;
  const linkClass = "flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#17352c] transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17352c] active:bg-white/80";

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <button type="button" onClick={() => openMenu("categories")} aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={open} aria-controls="store-navigation-menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-[#17352c] lg:hidden">
        <Menu size={22} />
      </button>

      <nav className="mobile-bottom-nav glass-surface" aria-label="Mobile navigation">
        <Link href="/" className={itemClass(pathname === "/")} aria-current={pathname === "/" ? "page" : undefined}><House size={23} strokeWidth={1.8} /><span>Home</span></Link>
        <button type="button" onClick={() => openMenu("categories")} className={itemClass(categoryActive)} aria-label="Browse categories" aria-haspopup="dialog" aria-controls="store-navigation-menu" aria-expanded={open && section === "categories"}><Grid2X2 size={23} strokeWidth={1.8} /><span>Categories</span></button>
        <Link href="/cart" className={itemClass(cartActive)} aria-current={pathname === "/cart" ? "page" : undefined} aria-label={`Cart${totalItems ? ` with ${totalItems} items` : ""}`}><span className="relative"><ShoppingBag size={23} strokeWidth={1.8} />{totalItems > 0 && <span className="mobile-cart-count">{totalItems > 99 ? "99+" : totalItems}</span>}</span><span>Cart</span></Link>
        <button type="button" onClick={() => openMenu("more")} className={itemClass(moreActive)} aria-label="More navigation" aria-haspopup="dialog" aria-controls="store-navigation-menu" aria-expanded={open && section === "more"}><MoreHorizontal size={23} /><span>More</span></button>
      </nav>

      <SheetContent
        id="store-navigation-menu"
        side={section === "categories" ? "left" : "right"}
        showCloseButton={false}
        className="store-sheet glass-surface z-[130] w-[calc(100%-2rem)] gap-0 sm:max-w-[420px]"
        overlayClassName="store-sheet-overlay z-[120] bg-[#0f201a]/25 backdrop-blur-sm"
        onOpenAutoFocus={() => { openerRef.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (openerRef.current?.isConnected && openerRef.current.getClientRects().length) openerRef.current.focus();
        }}
      >
        <SheetHeader className="shrink-0 flex-row items-center justify-between gap-4 border-b border-white/70 p-4 sm:p-5">
          <SheetTitle className="text-xl font-semibold tracking-tight text-[#17352c]">{section === "categories" ? "Browse Stockmora" : "Your Stockmora"}</SheetTitle>
          <SheetDescription className="sr-only">{section === "categories" ? "Search products and browse wholesale categories." : "Manage your account, saved products, and orders."}</SheetDescription>
          <SheetClose asChild>
            <button type="button" aria-label="Close navigation" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 hover:bg-white focus-visible:outline-2 focus-visible:outline-[#17352c]"><X size={21} /></button>
          </SheetClose>
        </SheetHeader>
        <div className="store-sheet-content min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {section === "categories" ? <>
            <form action="/products" method="GET" className="mb-4 flex items-center rounded-2xl border border-white/90 bg-white/65 px-3 focus-within:ring-2 focus-within:ring-[#17352c]/30">
              <Search size={19} className="shrink-0 text-neutral-500" />
              <input aria-label="Search products" type="search" name="q" placeholder="Search products…" className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none" />
              <button type="submit" aria-label="Submit search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#17352c] hover:bg-white"><Search size={18} /></button>
            </form>
            <nav aria-label="Product categories" className="grid gap-1">
              <Link href="/products" onClick={close} className={`${linkClass} bg-white/55`}><Grid2X2 size={18} className="shrink-0" />All Products</Link>
              {categories.map((category) => <Link key={category.id} href={`/categories/${category.slug}`} onClick={close} className={linkClass}><span className="min-w-0 break-words">{category.name}</span></Link>)}
              <Link href="/products?sort=newest" onClick={close} className={linkClass}>New Arrivals</Link>
            </nav>
          </> : <nav aria-label="Account navigation" className="grid gap-1">
            <Link href={signedIn ? "/account" : "/login"} onClick={(event) => { close(); if (!signedIn) onSignIn(event); }} className={linkClass}><UserRound size={18} className="shrink-0" />{signedIn ? "My account" : "Sign in"}</Link>
            {!signedIn && <Link href="/register" onClick={close} className={linkClass}>Create buyer account</Link>}
            <Link href="/saved" onClick={close} className={linkClass}><Heart size={18} className="shrink-0" />Saved products{totalSaved > 0 && <span className="ml-auto">{totalSaved}</span>}</Link>
            {signedIn && <Link href="/account/orders" onClick={close} className={linkClass}><Package size={18} className="shrink-0" />My orders</Link>}
            {isAdmin && <Link href="/admin" onClick={close} className={linkClass}><Grid2X2 size={18} className="shrink-0" />Admin dashboard</Link>}
            <Link href="/products" onClick={close} className={linkClass}><ShoppingBag size={18} className="shrink-0" />Browse products</Link>
            {signedIn && <button type="button" onClick={() => { close(); onSignOut(); }} className={`${linkClass} text-left`}><LogOut size={18} className="shrink-0" />Sign out</button>}
          </nav>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
