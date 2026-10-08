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
  Package,
  ShoppingCart,
  Store,
  UsersRound,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";

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

  return (
    <aside className="flex h-screen w-[255px] shrink-0 flex-col border-r border-neutral-200 bg-white">
      {/* BRAND */}
      <div className="border-b border-neutral-200 px-6 py-7">
        <Link
          href="/admin"
          className="text-[23px] font-semibold tracking-[-0.045em] text-neutral-950"
        >
          Stockmora
        </Link>

        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Administration
        </p>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
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
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? "bg-[#f3f2ee] text-[#17352c]"
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
        </div>
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
    </aside>
  );
}
