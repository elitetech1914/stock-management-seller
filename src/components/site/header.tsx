"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  LogOut,
  Package,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { StoreNavigation } from "./store-navigation";

import { siteConfig } from "@/config/site";
import { authClient } from "@/lib/auth-client";
import { useCart } from "@/lib/cart";
import { useSavedProducts } from "@/lib/saved-products";

type HeaderCategory = {
  id: string;
  name: string;
  slug: string;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function Header() {
  const pathname = usePathname();
  const [navigation, setNavigation] = useState({ pathname, open: false });
  const navigationOpen = navigation.pathname === pathname && navigation.open;
  const [mobileSearch, setMobileSearch] = useState({ pathname, open: false });
  if (mobileSearch.pathname !== pathname) setMobileSearch({ pathname, open: false });
  const mobileSearchOpen = mobileSearch.pathname === pathname && mobileSearch.open;
  const {
    items,
    totalItems,
    subtotalCents,
  } = useCart();

  const { totalSaved } =
    useSavedProducts();

  const {
    data: session,
    isPending,
  } = authClient.useSession();

  const [
    accountOpen,
    setAccountOpen,
  ] = useState(false);

  const [
    cartOpen,
    setCartOpen,
  ] = useState(false);

  if (navigation.pathname !== pathname) {
    setNavigation({ pathname, open: false });
    setAccountOpen(false);
    setCartOpen(false);
  }

  const handleNavigationChange = useCallback((open: boolean) => {
    setNavigation({ pathname, open });
    if (open) {
      setAccountOpen(false);
      setCartOpen(false);
    }
  }, [pathname]);

  const [
    categories,
    setCategories,
  ] = useState<HeaderCategory[]>(
    []
  );

  const [categoryStatus, setCategoryStatus] = useState<"loading" | "ready" | "error">("loading");
  const [categoryAttempt, setCategoryAttempt] = useState(0);

  const accountRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const cartRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mobileSearchTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const accountInitial = Array.from(session?.user?.name?.trim() || session?.user?.email?.trim() || "Account")[0].toLocaleUpperCase();

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const focusFrame = requestAnimationFrame(() => mobileSearchInputRef.current?.focus({ preventScroll: true }));
    const desktop = window.matchMedia("(min-width: 1024px)");
    const dismissOnDesktop = () => {
      if (desktop.matches) {
        setMobileSearch({ pathname, open: false });
        desktopSearchInputRef.current?.focus();
      }
    };
    desktop.addEventListener("change", dismissOnDesktop);
    return () => {
      cancelAnimationFrame(focusFrame);
      desktop.removeEventListener("change", dismissOnDesktop);
    };
  }, [mobileSearchOpen, pathname]);

  function openMobileSearch() {
    setAccountOpen(false);
    setCartOpen(false);
    setNavigation({ pathname, open: false });
    setMobileSearch({ pathname, open: true });
  }

  function closeMobileSearch() {
    setMobileSearch({ pathname, open: false });
    requestAnimationFrame(() => mobileSearchTriggerRef.current?.focus());
  }

  /*
   * Show a maximum of three cart lines.
   * Recently added/updated lines appear
   * first because cart.ts appends them.
   */
  const previewItems = items
    .slice(-3)
    .reverse();

  const hiddenProductCount =
    Math.max(
      0,
      items.length -
        previewItems.length
    );

  /*
   * Close account/cart dropdowns
   * when clicking outside them.
   */
  useEffect(() => {
    function handleClickOutside(
      event: PointerEvent
    ) {
      const target =
        event.target as Node;

      if (
        accountRef.current &&
        !accountRef.current.contains(
          target
        )
      ) {
        setAccountOpen(false);
      }

      if (
        cartRef.current &&
        !cartRef.current.contains(
          target
        )
      ) {
        setCartOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleClickOutside
      );
    };
  }, []);

  /*
   * Load category navigation
   * dynamically.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response =
          await fetch(
            "/api/store/categories"
          );

        if (!response.ok) throw new Error("Could not load categories");

        const data =
          (await response.json()) as HeaderCategory[];

        if (!cancelled) {
          setCategories(data);
          setCategoryStatus("ready");
        }
      } catch {
        if (!cancelled) setCategoryStatus("error");
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, [categoryAttempt]);

  /*
   * Remember where the buyer was
   * before sending them to login.
   */
  function handleBuyerSignIn(
    event: React.MouseEvent<HTMLAnchorElement>
  ) {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    const pathname =
      window.location.pathname;

    const currentPage = `${pathname}${window.location.search}${window.location.hash}`;

    const returnTo =
      pathname === "/login" ||
      pathname === "/register" ||
      pathname ===
        "/admin/login"
        ? "/"
        : currentPage;

    const loginUrl =
      `/login?next=${encodeURIComponent(
        returnTo
      )}`;

    window.location.assign(
      loginUrl
    );
  }

  function handleAccountToggle() {
    setCartOpen(false);

    setAccountOpen(
      (current) => !current
    );
  }

  function handleCartToggle() {
    setAccountOpen(false);

    setCartOpen(
      (current) => !current
    );
  }

  async function handleSignOut() {
    setAccountOpen(false);
    setCartOpen(false);

    await authClient.signOut();

    window.location.assign("/");
  }

  return (
    <>
      {/* WHOLESALE BAR */}
      <div className="bg-[#17352c] px-4 py-2.5 text-center text-xs font-medium text-white">
        Wholesale pricing for
        independent retailers
      </div>

      <header className="border-b border-neutral-200 bg-white">
        {/* MAIN HEADER */}
        <div className="relative mx-auto h-[76px] max-w-[1500px]">
        <div className={`store-header-content flex h-full items-center gap-1 px-2 sm:gap-5 sm:px-5 lg:gap-7 lg:px-8 ${mobileSearchOpen ? "invisible opacity-0" : "visible opacity-100"}`} inert={mobileSearchOpen} aria-hidden={mobileSearchOpen || undefined}>
          {/* NAVIGATION MENU */}
          <StoreNavigation open={navigationOpen} onOpenChange={handleNavigationChange} categories={categories} categoryStatus={categoryStatus} onRetryCategories={() => { setCategoryStatus("loading"); setCategoryAttempt((attempt) => attempt + 1); }} />

          {/* LOGO */}
          <Link
            href="/"
            className="min-w-0 truncate text-[22px] max-[360px]:text-[14px] sm:shrink-0 sm:text-[27px] font-semibold tracking-[-0.045em] text-neutral-950"
          >
            {siteConfig.name}
          </Link>

          {/* SEARCH */}
          <form
            role="search"
            aria-label="Search products"
            action="/products"
            method="GET"
            className="store-header-search-field hidden max-w-2xl flex-1 items-center rounded-full border border-neutral-300 bg-neutral-50 px-4 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 lg:flex"
          >
            <button
              type="submit"
              aria-label="Search products"
              className="flex shrink-0 items-center justify-center text-neutral-500"
            >
              <Search size={18} />
            </button>

            <input
              ref={desktopSearchInputRef}
              type="search"
              aria-label="Search products, brands and categories"
              name="q"
              placeholder="Search products, brands and categories"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-neutral-500"
            />
          </form>

          {/* RIGHT NAV */}
          <nav aria-label="Header actions" className="ml-auto flex shrink-0 items-center gap-0 sm:gap-3 md:gap-4">
            <button type="button" ref={mobileSearchTriggerRef} onClick={openMobileSearch} aria-label="Open search" aria-expanded={mobileSearchOpen} aria-controls="store-mobile-search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-neutral-100 active:bg-neutral-200 lg:hidden"><Search size={20} /></button>
{/* SIGN IN / REGISTER */}
            {!isPending &&
              !session?.user && (
                <>
                  <Link
                    href="/login"
                    onClick={
                      handleBuyerSignIn
                    }
                    className="hidden text-sm font-medium text-neutral-700 transition hover:text-neutral-950 md:block"
                  >
                    Sign in
                  </Link>

                  <Link
                    href="/register"
                    className="hidden h-9 items-center justify-center rounded-lg border border-neutral-300 px-3.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 md:flex"
                  >
                    Register
                  </Link>
                </>
              )}

            {/* SAVED PRODUCTS */}
            <Link
              href="/saved"
              aria-label={
                totalSaved > 0
                  ? `${totalSaved} saved products`
                  : "Saved products"
              }
              className="relative flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-neutral-100 active:bg-neutral-200 sm:h-9 sm:w-9"
            >
              <Heart
                size={20}
                fill={
                  totalSaved > 0
                    ? "currentColor"
                    : "none"
                }
              />

              {totalSaved > 0 && (
                <span className="absolute right-[2px] top-[2px] h-2.5 w-2.5 rounded-full border-2 border-white bg-[#17352c]" />
              )}
            </Link>

            {/* CART */}
            <div
              ref={cartRef}
              className="store-header-cart relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setCartOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && cartOpen) {
                  event.preventDefault();
                  event.stopPropagation();
                  setCartOpen(false);
                  cartRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
                }
              }}
            >
              {/* DESKTOP CART BUTTON */}
              <button
                type="button"
                onClick={
                  handleCartToggle
                }
                aria-expanded={
                  cartOpen
                }
                aria-haspopup="true"
                aria-label={
                  totalItems > 0
                    ? `Shopping cart with ${totalItems} items`
                    : "Shopping cart"
                }
                className="relative hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-neutral-100 md:flex"
              >
                <ShoppingBag
                  size={21}
                />

                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#17352c] px-1 text-xs font-semibold leading-none text-white">
                    {totalItems > 99
                      ? "99+"
                      : totalItems}
                  </span>
                )}
              </button>

              {/* MOBILE CART */}
              <Link
                href="/cart"
                aria-label={
                  totalItems > 0
                    ? `Shopping cart with ${totalItems} items`
                    : "Shopping cart"
                }
                className="relative flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-neutral-100 md:hidden"
              >
                <ShoppingBag
                  size={21}
                />

                {totalItems > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#17352c] px-1 text-xs font-semibold leading-none text-white">
                    {totalItems > 99
                      ? "99+"
                      : totalItems}
                  </span>
                )}
              </Link>

              {/* MINI CART */}
              {cartOpen && (
                <div className="absolute right-0 top-[46px] z-[110] hidden w-[380px] overflow-hidden rounded-[22px] glass-surface p-2 md:block">
                  {/* CART HEADER */}
                  <div className="rounded-2xl border border-border bg-white px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">
                          Your cart
                        </p>

                        <p className="mt-0.5 text-xs text-neutral-500">
                          {totalItems ===
                          0
                            ? "No items yet"
                            : `${totalItems} ${
                                totalItems ===
                                1
                                  ? "item"
                                  : "items"
                              }`}
                        </p>
                      </div>

                      <ShoppingBag
                        size={18}
                        className="text-neutral-500"
                      />
                    </div>
                  </div>

                  {items.length === 0 ? (
                    /* EMPTY CART */
                    <div className="mt-2 rounded-2xl border border-white/80 bg-white/30 px-5 py-7 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-neutral-500 shadow-sm">
                        <ShoppingBag
                          size={19}
                        />
                      </div>

                      <p className="mt-4 text-sm font-semibold text-neutral-950">
                        Your cart is
                        empty
                      </p>

                      <p className="mx-auto mt-1.5 max-w-[230px] text-xs leading-5 text-neutral-500">
                        Add wholesale
                        products to start
                        building your
                        order.
                      </p>

                      <Link
                        href="/products"
                        onClick={() =>
                          setCartOpen(
                            false
                          )
                        }
                        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#102a22]"
                      >
                        Browse products
                      </Link>
                    </div>
                  ) : (
                    <>
                      {/* PRODUCT LIST */}
                      <div className="mt-2 space-y-1">
                        {previewItems.map(
                          (item) => (
                            <div
                              key={
                                item.lineId
                              }
                              className="flex gap-3 rounded-xl border border-transparent bg-white/30 p-2.5 transition hover:border-white/80 hover:bg-white/75 hover:shadow-sm"
                            >
                              {/* IMAGE */}
                              <Link
                                href={`/products/${item.productSlug}`}
                                onClick={() =>
                                  setCartOpen(
                                    false
                                  )
                                }
                                className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm"
                              >
                                {item.imageUrl ? (
                                  <img
                                    src={
                                      item.imageUrl
                                    }
                                    alt={
                                      item.productName
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-neutral-500">
                                    <ShoppingBag
                                      size={
                                        19
                                      }
                                    />
                                  </div>
                                )}
                              </Link>

                              {/* PRODUCT INFO */}
                              <div className="min-w-0 flex-1 py-0.5">
                                <Link
                                  href={`/products/${item.productSlug}`}
                                  onClick={() =>
                                    setCartOpen(
                                      false
                                    )
                                  }
                                  className="block truncate text-sm font-semibold text-neutral-950 transition hover:text-[#17352c]"
                                >
                                  {
                                    item.productName
                                  }
                                </Link>

                                {item.variantName && (
                                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                                    {
                                      item.variantName
                                    }
                                  </p>
                                )}

                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <span className="text-xs text-neutral-500">
                                    Qty{" "}
                                    {
                                      item.quantity
                                    }
                                  </span>

                                  <span className="text-xs font-semibold text-neutral-900">
                                    {formatMoney(
                                      item.priceCents *
                                        item.quantity
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      {/* EXTRA PRODUCT COUNT */}
                      {hiddenProductCount >
                        0 && (
                        <div className="mt-1 rounded-xl border border-transparent bg-white/30 px-3 py-2.5 text-center">
                          <p className="text-xs font-medium text-neutral-500">
                            +{" "}
                            {
                              hiddenProductCount
                            }{" "}
                            more{" "}
                            {hiddenProductCount ===
                            1
                              ? "product"
                              : "products"}{" "}
                            in your cart
                          </p>
                        </div>
                      )}

                      {/* CART FOOTER */}
                      <div className="mt-2 border-t border-white/70 pt-2">
                        <div className="rounded-2xl border border-border bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-medium text-neutral-500">
                                Subtotal
                              </p>

                              <p className="mt-0.5 text-xs text-neutral-500">
                                Before
                                shipping
                              </p>
                            </div>

                            <p className="text-base font-semibold tracking-[-0.02em] text-neutral-950">
                              {formatMoney(
                                subtotalCents
                              )}
                            </p>
                          </div>

                          <Link
                            href="/cart"
                            onClick={() =>
                              setCartOpen(
                                false
                              )
                            }
                            className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#102a22]"
                          >
                            View cart
                          </Link>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ACCOUNT */}
            <div
              ref={accountRef}
              className="static sm:relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && accountOpen) {
                  event.preventDefault();
                  event.stopPropagation();
                  setAccountOpen(false);
                  accountRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
                }
              }}
            >
              {session?.user ? (
                <>
                  <button
                    type="button"
                    onClick={
                      handleAccountToggle
                    }
                    aria-label={`Account menu for ${session.user.name || session.user.email}`}
                    aria-controls="store-account-menu"
                    aria-expanded={
                      accountOpen
                    }
                    className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-full transition hover:bg-neutral-100 active:bg-neutral-200 sm:w-auto sm:px-2"
                  >
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#17352c] text-sm font-semibold text-white">{accountInitial}</span>

                    <ChevronDown
                      size={13}
                      className={`hidden transition-transform md:block ${
                        accountOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>

                  {accountOpen && (
                    <div id="store-account-menu" className="absolute right-3 top-[calc(100%-0.5rem)] z-[100] max-h-[calc(100dvh-8rem)] w-[min(270px,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-[22px] glass-surface p-2 sm:right-0 sm:top-[46px]">
                      {/* USER CARD */}
                      <div className="rounded-2xl border border-border bg-white px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                        <p className="break-words text-sm font-semibold text-neutral-950">
                          {
                            session.user
                              .name
                          }
                        </p>

                        <p className="mt-0.5 break-words text-xs text-neutral-500">
                          {
                            session.user
                              .email
                          }
                        </p>
                      </div>

                      <div className="mt-2 space-y-1">
                        <GlassAccountLink
                          href="/account"
                          onClick={() =>
                            setAccountOpen(
                              false
                            )
                          }
                          icon={
                            <UserRound
                              size={16}
                            />
                          }
                        >
                          Account
                        </GlassAccountLink>

                        <GlassAccountLink
                          href="/account/orders"
                          onClick={() =>
                            setAccountOpen(
                              false
                            )
                          }
                          icon={
                            <Package
                              size={16}
                            />
                          }
                        >
                          My orders
                        </GlassAccountLink>

                        {session.user
                          .role ===
                          "admin" && (
                          <GlassAccountLink
                            href="/admin"
                            onClick={() =>
                              setAccountOpen(
                                false
                              )
                            }
                            icon={
                              <ShoppingBag
                                size={16}
                              />
                            }
                          >
                            Admin dashboard
                          </GlassAccountLink>
                        )}
                      </div>

                      <div className="mt-2 border-t border-white/70 pt-2">
                        <button
                          type="button"
                          onClick={
                            handleSignOut
                          }
                          className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:border-red-100 hover:bg-white/75 active:bg-white"
                        >
                          <LogOut
                            size={16}
                          />

                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={
                    handleBuyerSignIn
                  }
                  aria-label="Sign in"
                  className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-neutral-100 md:hidden"
                >
                  <UserRound
                    size={20}
                  />
                </Link>
              )}
            </div>

          </nav>
        </div>
        <form id="store-mobile-search" role="search" action="/products" method="GET" aria-label="Search products" aria-hidden={!mobileSearchOpen} inert={!mobileSearchOpen} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMobileSearch(); } }} className={`store-header-search absolute inset-0 z-40 flex items-center gap-2 bg-white px-3 sm:px-5 lg:hidden ${mobileSearchOpen ? "visible translate-x-0 scale-100 opacity-100" : "invisible translate-x-3 scale-[0.98] opacity-0"}`}>
          <div className="store-header-search-field flex min-w-0 flex-1 items-center rounded-full border border-neutral-300 bg-neutral-50 pl-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
            <Search size={20} aria-hidden="true" className="shrink-0 text-neutral-500" />
            <input ref={mobileSearchInputRef} type="search" name="q" aria-label="Search products, brands and categories" placeholder="Search products..." className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none" />
            <button type="submit" aria-label="Submit search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand transition hover:bg-neutral-200 active:bg-neutral-300"><ChevronRight size={20} /></button>
          </div>
          <button type="button" onClick={closeMobileSearch} aria-label="Close search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-neutral-100 active:bg-neutral-200"><X size={21} /></button>
        </form>
        </div>

      </header>
    </>
  );
}

function GlassAccountLink({
  href,
  onClick,
  icon,
  children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-11 items-center gap-3 rounded-xl border border-transparent bg-white/30 px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-white/80 hover:bg-white/75 hover:text-neutral-950 hover:shadow-sm active:bg-white"
    >
      <span className="text-neutral-500">
        {icon}
      </span>

      {children}
    </Link>
  );
}
