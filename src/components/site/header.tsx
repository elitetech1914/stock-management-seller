"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { siteConfig } from "@/config/site";
import { authClient } from "@/lib/auth-client";
import { useCart } from "@/lib/cart";
import { useSavedProducts } from "@/lib/saved-products";

type HeaderCategory = {
  id: string;
  name: string;
  slug: string;
};

export function Header() {
  const { totalItems } = useCart();
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
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  const [
    categories,
    setCategories,
  ] = useState<
    HeaderCategory[]
  >([]);

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

  const mobileMenuRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const categoryNavRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /*
   * CLOSE FLOATING MENUS
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
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(
          target
        )
      ) {
        setMobileOpen(false);
      }
    }

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape"
      ) {
        setAccountOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  /*
   * LOAD REAL CATEGORIES
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
        // Keep header usable
        // if category loading fails.
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * DESKTOP CATEGORY CAROUSEL
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
    direction:
      | "left"
      | "right"
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

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  async function handleSignOut() {
    setAccountOpen(false);
    setMobileOpen(false);

    await authClient.signOut();

    window.location.assign("/");
  }

  return (
    <>
      {/* WHOLESALE BAR */}
      <div className="bg-[#17352c] px-4 py-2.5 text-center text-xs font-medium text-white">
        Wholesale pricing for independent retailers
      </div>

      <header className="relative z-50 border-b border-neutral-200 bg-white">
        {/* MAIN HEADER */}
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center gap-5 px-5 lg:gap-7 lg:px-8">
          {/* MOBILE MENU */}
          <div
            ref={mobileMenuRef}
            className="relative lg:hidden"
          >
            <button
              type="button"
              onClick={() => {
                setMobileOpen(
                  (current) =>
                    !current
                );

                setAccountOpen(false);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                mobileOpen
                  ? "bg-neutral-100"
                  : "hover:bg-neutral-100"
              }`}
              aria-label={
                mobileOpen
                  ? "Close navigation"
                  : "Open navigation"
              }
              aria-expanded={
                mobileOpen
              }
            >
              {mobileOpen ? (
                <X size={20} />
              ) : (
                <Menu size={21} />
              )}
            </button>

            {/* FLOATING GLASS MOBILE MENU */}
            {mobileOpen && (
              <div
                className="absolute left-0 top-[calc(100%+12px)] z-[200] w-[310px] max-w-[calc(100vw-30px)] overflow-y-auto rounded-[22px] border border-white/65 bg-white/45 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.13)] backdrop-blur-[28px]"
                style={{
                  maxHeight:
                    "calc(100vh - 120px)",
                  scrollbarWidth:
                    "none",
                  msOverflowStyle:
                    "none",
                }}
              >
                {/* SEARCH */}
                <form
                  action="/products"
                  method="GET"
                  onSubmit={() =>
                    setMobileOpen(
                      false
                    )
                  }
                  className="flex h-11 items-center rounded-2xl border border-white/70 bg-white/55 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
                >
                  <Search
                    size={16}
                    className="shrink-0 text-neutral-400"
                  />

                  <input
                    type="search"
                    name="q"
                    placeholder="Search products..."
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                  />
                </form>

                {/* MAIN LINKS */}
                <div className="mt-2 space-y-1">
                  <MobileMenuLink
                    href="/products"
                    onClick={
                      closeMobileMenu
                    }
                  >
                    All Products
                  </MobileMenuLink>

                  <MobileMenuLink
                    href="/saved"
                    onClick={
                      closeMobileMenu
                    }
                    badge={
                      totalSaved > 0
                        ? String(
                            totalSaved
                          )
                        : undefined
                    }
                  >
                    Saved Products
                  </MobileMenuLink>

                  <MobileMenuLink
                    href="/cart"
                    onClick={
                      closeMobileMenu
                    }
                    badge={
                      totalItems > 0
                        ? totalItems > 99
                          ? "99+"
                          : String(
                              totalItems
                            )
                        : undefined
                    }
                  >
                    Cart
                  </MobileMenuLink>

                  <MobileMenuLink
                    href="/products?sort=newest"
                    onClick={
                      closeMobileMenu
                    }
                  >
                    New Arrivals
                  </MobileMenuLink>
                </div>

                {/* CATEGORIES */}
                {categories.length >
                  0 && (
                  <>
                    <GlassDivider />

                    <p className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-400">
                      Categories
                    </p>

                    <div className="space-y-1">
                      {categories.map(
                        (
                          category
                        ) => (
                          <MobileMenuLink
                            key={
                              category.id
                            }
                            href={`/categories/${category.slug}`}
                            onClick={
                              closeMobileMenu
                            }
                          >
                            {
                              category.name
                            }
                          </MobileMenuLink>
                        )
                      )}
                    </div>
                  </>
                )}

                <GlassDivider />

                {/* ACCOUNT */}
                {!isPending &&
                session?.user ? (
                  <div className="space-y-1">
                    <div className="mb-2 rounded-2xl border border-white/65 bg-white/40 px-3.5 py-3">
                      <p className="truncate text-sm font-semibold text-neutral-950">
                        {
                          session.user
                            .name
                        }
                      </p>

                      <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                        {
                          session.user
                            .email
                        }
                      </p>
                    </div>

                    <MobileMenuLink
                      href="/account"
                      onClick={
                        closeMobileMenu
                      }
                    >
                      Account
                    </MobileMenuLink>

                    <MobileMenuLink
                      href="/account/orders"
                      onClick={
                        closeMobileMenu
                      }
                    >
                      My Orders
                    </MobileMenuLink>

                    {session.user
                      .role ===
                      "admin" && (
                      <MobileMenuLink
                        href="/admin"
                        onClick={
                          closeMobileMenu
                        }
                      >
                        Admin Dashboard
                      </MobileMenuLink>
                    )}

                    <button
                      type="button"
                      onClick={
                        handleSignOut
                      }
                      className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-white/10 px-3.5 py-2.5 text-left text-sm font-medium text-red-600 transition hover:border-red-100/60 hover:bg-white/55"
                    >
                      <LogOut
                        size={15}
                      />

                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/login"
                      onClick={
                        closeMobileMenu
                      }
                      className="flex h-10 items-center justify-center rounded-xl border border-white/70 bg-white/50 text-sm font-semibold text-neutral-800 transition hover:bg-white/75"
                    >
                      Sign in
                    </Link>

                    <Link
                      href="/register"
                      onClick={
                        closeMobileMenu
                      }
                      className="flex h-10 items-center justify-center rounded-xl bg-[#17352c] text-sm font-semibold text-white shadow-sm transition hover:bg-[#24483d]"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* LOGO */}
          <Link
            href="/"
            className="shrink-0 text-[27px] font-semibold tracking-[-0.045em] text-neutral-950"
          >
            {siteConfig.name}
          </Link>

          {/* DESKTOP SEARCH */}
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
              <Search
                size={18}
              />
            </button>

            <input
              type="search"
              name="q"
              placeholder="Search products, brands and categories"
              className="h-11 w-full bg-transparent px-3 text-sm outline-none placeholder:text-neutral-500"
            />
          </form>

          {/* RIGHT NAV */}
          <nav className="ml-auto flex items-center gap-3 md:gap-4">
            <button
              type="button"
              className="hidden text-sm font-medium text-neutral-700 transition hover:text-neutral-950 md:block"
            >
              Help
            </button>

            {!isPending &&
              !session?.user && (
                <>
                  <Link
                    href="/login"
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

            {/* SAVED */}
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
                    onClick={() => {
                      setAccountOpen(
                        (current) =>
                          !current
                      );

                      setMobileOpen(
                        false
                      );
                    }}
                    aria-label="Account menu"
                    aria-expanded={
                      accountOpen
                    }
                    className="flex h-9 items-center gap-1.5 rounded-full px-2 transition hover:bg-neutral-100"
                  >
                    <UserRound
                      size={20}
                    />

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
                    <div className="absolute right-0 top-[46px] z-[200] w-[270px] overflow-hidden rounded-[22px] border border-white/65 bg-white/45 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.13)] backdrop-blur-[28px]">
                      <div className="rounded-2xl border border-white/65 bg-white/45 px-4 py-3.5">
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

                      <div className="mt-2 border-t border-white/60 pt-2">
                        <button
                          type="button"
                          onClick={
                            handleSignOut
                          }
                          className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:border-red-100 hover:bg-white/55"
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
                  aria-label="Sign in"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-neutral-100 md:hidden"
                >
                  <UserRound
                    size={20}
                  />
                </Link>
              )}
            </div>

            {/* CART */}
            <Link
              href="/cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-neutral-100"
              aria-label={
                totalItems > 0
                  ? `Shopping cart with ${totalItems} items`
                  : "Shopping cart"
              }
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
          </nav>
        </div>

        {/* DESKTOP CATEGORY NAV */}
        <div className="border-t border-neutral-100">
          <div className="mx-auto hidden h-[48px] max-w-[1500px] items-center gap-2 px-5 lg:flex lg:px-8">
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

function GlassDivider() {
  return (
    <div className="mx-2 my-2 h-px bg-white/60" />
  );
}

function MobileMenuLink({
  href,
  onClick,
  children,
  badge,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between gap-4 rounded-xl border border-transparent bg-white/10 px-3.5 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-white/60 hover:bg-white/55 hover:text-neutral-950"
    >
      <span className="truncate">
        {children}
      </span>

      {badge && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#17352c] px-1.5 text-[9px] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
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
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-transparent bg-white/10 px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-white/60 hover:bg-white/55 hover:text-neutral-950"
    >
      <span className="text-neutral-500">
        {icon}
      </span>

      {children}
    </Link>
  );
}