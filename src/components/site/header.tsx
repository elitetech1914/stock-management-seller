"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  LogOut,
  Package,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { StoreNavigation, type StoreMenu } from "./store-navigation";

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
  const [mobileMenu, setMobileMenu] = useState<{ pathname: string; section: StoreMenu | null }>({ pathname, section: null });
  if (mobileMenu.pathname !== pathname) setMobileMenu({ pathname, section: null });
  const activeMenu = mobileMenu.pathname === pathname ? mobileMenu.section : null;
  const handleMobileMenuChange = useCallback((section: StoreMenu | null) => {
    setMobileMenu({ pathname, section });
  }, [pathname]);
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

const [
    categories,
    setCategories,
  ] = useState<HeaderCategory[]>(
    []
  );

  const [
    canScrollLeft,
    setCanScrollLeft,
  ] = useState(false);

  const [
    canScrollRight,
    setCanScrollRight,
  ] = useState(false);

  const accountRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const cartRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const categoryNavRef =
    useRef<HTMLDivElement | null>(
      null
    );

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
      event: MouseEvent
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
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
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

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as HeaderCategory[];

        if (!cancelled) {
          setCategories(data);
        }
      } catch {
        // Keep the header usable
        // if category loading fails.
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Category navigation arrows.
   */
  useEffect(() => {
    const element =
      categoryNavRef.current;

    if (!element) {
      return;
    }

    function updateButtons() {
      const el =
        categoryNavRef.current;

      if (!el) {
        return;
      }

      setCanScrollLeft(
        el.scrollLeft > 4
      );

      setCanScrollRight(
        el.scrollLeft +
          el.clientWidth <
          el.scrollWidth - 4
      );
    }

    updateButtons();

    requestAnimationFrame(
      updateButtons
    );

    element.addEventListener(
      "scroll",
      updateButtons
    );

    window.addEventListener(
      "resize",
      updateButtons
    );

    return () => {
      element.removeEventListener(
        "scroll",
        updateButtons
      );

      window.removeEventListener(
        "resize",
        updateButtons
      );
    };
  }, [categories]);

  function scrollCategories(
    direction: "left" | "right"
  ) {
    categoryNavRef.current?.scrollBy(
      {
        left:
          direction === "right"
            ? 420
            : -420,
        behavior: "smooth",
      }
    );
  }

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

    if (window.matchMedia("(width < 1024px)").matches) {
      setAccountOpen(false);
      handleMobileMenuChange("more");
      return;
    }

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
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center gap-2 px-3 sm:gap-5 sm:px-5 lg:gap-7 lg:px-8">
          {/* MOBILE MENU */}
          <StoreNavigation menu={activeMenu} onMenuChange={handleMobileMenuChange} categories={categories} totalItems={totalItems} totalSaved={totalSaved} signedIn={Boolean(session?.user)} isAdmin={session?.user?.role === "admin"} onSignIn={handleBuyerSignIn} onSignOut={handleSignOut} />

          {/* LOGO */}
          <Link
            href="/"
            className="min-w-0 text-[24px] sm:shrink-0 sm:text-[27px] font-semibold tracking-[-0.045em] text-neutral-950"
          >
            {siteConfig.name}
          </Link>

          {/* SEARCH */}
          <form
            action="/products"
            method="GET"
            className="hidden max-w-2xl flex-1 items-center rounded-full border border-neutral-300 bg-neutral-50 px-4 transition focus-within:border-neutral-500 lg:flex"
          >
            <button
              type="submit"
              aria-label="Search products"
              className="flex shrink-0 items-center justify-center text-neutral-500"
            >
              <Search size={18} />
            </button>

            <input
              type="search"
              name="q"
              placeholder="Search products, brands and categories"
              className="h-11 w-full bg-transparent px-3 text-sm outline-none placeholder:text-neutral-500"
            />
          </form>

          {/* RIGHT NAV */}
          <nav className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3 md:gap-4">
            <button
              type="button"
              className="hidden text-sm font-medium text-neutral-700 transition hover:text-neutral-950 md:block"
            >
              Help
            </button>

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
              className="relative hidden h-9 w-9 items-center justify-center rounded-full transition hover:bg-neutral-100 sm:flex"
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

            {/* ACCOUNT */}
            <div
              ref={accountRef}
              className="relative"
            >
              {session?.user ? (
                <>
                  <button
                    type="button"
                    onClick={
                      handleAccountToggle
                    }
                    aria-label="Account menu"
                    aria-expanded={
                      accountOpen || activeMenu === "more"
                    }
                    className="flex h-11 items-center gap-1.5 rounded-full px-2 transition hover:bg-neutral-100 lg:h-9"
                  >
                    <UserRound
                      size={20}
                    />

                    <ChevronDown
                      size={13}
                      className={`hidden transition-transform md:block ${
                        accountOpen || activeMenu === "more"
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>

                  {accountOpen && (
                    <div className="absolute right-0 top-[46px] z-[100] hidden w-[270px] overflow-hidden rounded-[22px] border border-white/80 bg-white/70 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl lg:block">
                      {/* USER CARD */}
                      <div className="rounded-2xl border border-white/80 bg-white/55 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                        <p className="truncate text-sm font-semibold text-neutral-950">
                          {
                            session.user
                              .name
                          }
                        </p>

                        <p className="mt-0.5 truncate text-xs text-neutral-500">
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
                          className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:border-red-100 hover:bg-white/75"
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

            {/* CART */}
            <div
              ref={cartRef}
              className="relative"
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
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#17352c] px-1 text-[9px] font-semibold leading-none text-white">
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
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#17352c] px-1 text-[9px] font-semibold leading-none text-white">
                    {totalItems > 99
                      ? "99+"
                      : totalItems}
                  </span>
                )}
              </Link>

              {/* MINI CART */}
              {cartOpen && (
                <div className="absolute right-0 top-[46px] z-[110] hidden w-[380px] overflow-hidden rounded-[22px] border border-white/80 bg-white/70 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl md:block">
                  {/* CART HEADER */}
                  <div className="rounded-2xl border border-white/80 bg-white/55 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
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
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/55 text-neutral-500 shadow-sm">
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
                                className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl border border-white/80 bg-white/55 shadow-sm"
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
                                  <div className="flex h-full w-full items-center justify-center text-neutral-400">
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
                        <div className="rounded-2xl border border-white/80 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-medium text-neutral-500">
                                Subtotal
                              </p>

                              <p className="mt-0.5 text-[11px] text-neutral-400">
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
          </nav>
        </div>

        {/* DESKTOP CATEGORY NAV */}
        <div className="border-t border-neutral-100">
          <div className="mx-auto hidden h-[48px] max-w-[1500px] items-center gap-2 px-5 lg:flex lg:px-8">
            {/* PREVIOUS */}
            <button
              type="button"
              onClick={() =>
                scrollCategories(
                  "left"
                )
              }
              disabled={
                !canScrollLeft
              }
              aria-label="Previous categories"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50 disabled:cursor-default disabled:opacity-25"
            >
              <ChevronLeft
                size={16}
              />
            </button>

            {/* CATEGORY TRACK */}
            <div
              ref={
                categoryNavRef
              }
              className="flex min-w-0 flex-1 items-center gap-8 overflow-x-hidden scroll-smooth whitespace-nowrap"
            >
              <Link
                href="/products"
                className="shrink-0 text-sm font-medium transition hover:text-[#17352c]"
              >
                All Products
              </Link>

              {categories.map(
                (category) => (
                  <Link
                    key={
                      category.id
                    }
                    href={`/categories/${category.slug}`}
                    className="shrink-0 text-sm text-neutral-700 transition hover:text-[#17352c]"
                  >
                    {
                      category.name
                    }
                  </Link>
                )
              )}

              <Link
                href="/products?sort=newest"
                className="shrink-0 text-sm font-semibold text-[#a7422c]"
              >
                New Arrivals
              </Link>
            </div>

            {/* NEXT */}
            <button
              type="button"
              onClick={() =>
                scrollCategories(
                  "right"
                )
              }
              disabled={
                !canScrollRight
              }
              aria-label="Next categories"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50 disabled:cursor-default disabled:opacity-25"
            >
              <ChevronRight
                size={16}
              />
            </button>
          </div>
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
      className="flex items-center gap-3 rounded-xl border border-transparent bg-white/30 px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-white/80 hover:bg-white/75 hover:text-neutral-950 hover:shadow-sm"
    >
      <span className="text-neutral-500">
        {icon}
      </span>

      {children}
    </Link>
  );
}
