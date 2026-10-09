"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  FolderTree,
  Grid2X2,
  Import,
  Images,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Store,
  UsersRound,
  X,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { useNavigationDialog } from "@/components/site/use-navigation-dialog";

const navigation = [
  {
    label: "Overview",
    href: "/admin",
    icon: Grid2X2,
    exact: true,
  },
  {
    label: "Products",
    href: "/admin/products",
    icon: Package,
  },
  {
    label: "Categories",
    href: "/admin/categories",
    icon: FolderTree,
  },
  {
    label: "Import Products",
    href: "/admin/import",
    icon: Import,
  },
  {
    label: "Bulk Images",
    href: "/admin/bulk-images",
    icon: Images,
  },
  {
    label: "Inventory",
    href: "/admin/inventory",
    icon: Boxes,
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    label: "Customers",
    href: "/admin/customers",
    icon: UsersRound,
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { dialogRef, open, show, close, onClose } = useNavigationDialog(1280);

  function isActive(
    href: string,
    exact?: boolean
  ) {
    if (exact) {
      return pathname === href;
    }

    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`
      )
    );
  }

  async function handleSignOut() {
    await authClient.signOut();

    window.location.assign(
      "/admin/login"
    );
  }

  const content = (
    <>
      {/* BRAND */}
      <div className="border-b border-neutral-200 px-6 py-7">
        <Link
          href="/admin"
          className="text-[23px] font-semibold tracking-[-0.045em] text-neutral-950"
        >
          Stockmora
        </Link>

        <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
          Administration
        </p>
      </div>

      {/* NAVIGATION */}
      <nav aria-label="Admin navigation" className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {[{ label: "Workspace", items: navigation.slice(0, 1) }, { label: "Catalog", items: navigation.slice(1, 6) }, { label: "Sales", items: navigation.slice(6) }].map((group) => <div key={group.label} className="space-y-1">
          <p className="ui-eyebrow px-3 pb-2">{group.label}</p>
          {group.items.map((item) => {
            const Icon =
              item.icon;

            const active =
              isActive(
                item.href,
                item.exact
              );

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? "bg-[#eaf0e7] text-[#17352c]"
                    : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950"
                }`}
              >
                <Icon
                  size={17}
                  strokeWidth={1.8}
                  className={
                    active
                      ? "text-[#17352c]"
                      : "text-neutral-500"
                  }
                />

                <span>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>)}
      </nav>

      {/* BOTTOM */}
      <div className="border-t border-neutral-200 px-4 py-4">
        <Link
          href="/"
          className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-950"
        >
          <Store
            size={17}
            strokeWidth={1.8}
            className="text-neutral-500"
          />

          View storefront
        </Link>

        <button
          type="button"
          onClick={
            handleSignOut
          }
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-neutral-700 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut
            size={17}
            strokeWidth={1.8}
            className="text-neutral-500"
          />

          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 hidden h-dvh shrink-0 xl:block">
        <aside className="flex h-full w-[255px] flex-col border-r border-neutral-200 bg-white">{content}</aside>
      </div>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur-xl xl:hidden">
        <Link href="/admin" className="text-xl font-semibold tracking-tight">Stockmora <span className="text-xs font-normal text-neutral-500">Admin</span></Link>
        <button type="button" onClick={show} aria-label="Open admin navigation" aria-expanded={open} aria-haspopup="dialog" aria-controls="admin-navigation-menu" className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-[#17352c]"><Menu size={22} /></button>
      </header>
      <dialog ref={dialogRef} id="admin-navigation-menu" className="navigation-dialog admin-menu" aria-label="Admin navigation" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <button type="button" onClick={close} aria-label="Close admin navigation" className="absolute right-3 top-4 flex h-11 w-11 items-center justify-center rounded-full hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-[#17352c]"><X size={21} /></button>
        <div className="flex h-full flex-col" onClick={(event) => { if ((event.target as Element).closest("a")) close(); }}>{content}</div>
      </dialog>
    </>
  );
}
