import { Header } from "@/components/site/header";
import { CatalogFilters } from "@/components/store/catalog-filters";
import { ProductCard } from "@/components/store/product-card";

import {
  getStoreCatalogProducts,
  getStoreCategories,
  type CatalogSort,
} from "@/lib/store-catalog";

function normalizeSort(
  value?: string
): CatalogSort {
  switch (value) {
    case "name":
    case "price-asc":
    case "price-desc":
    case "newest":
      return value;

    default:
      return "newest";
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
  }>;
}) {
  const params =
    await searchParams;

  const query =
    params.q?.trim() ?? "";

  const categorySlug =
    params.category?.trim() ||
    undefined;

  const sort =
    normalizeSort(
      params.sort
    );

  const [
    products,
    categories,
  ] = await Promise.all([
    getStoreCatalogProducts({
      query,
      categorySlug,
      sort,
    }),

    getStoreCategories(),
  ]);

  return (
    <main className="min-h-screen bg-white">
      <Header />

      <section className="mx-auto max-w-[1500px] px-5 py-8 lg:px-8 lg:py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Wholesale catalog
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
            {query
              ? `Search results for “${query}”`
              : "All Products"}
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            {products.length}{" "}
            {products.length === 1
              ? "product"
              : "products"}
          </p>
        </div>

        <CatalogFilters
          categories={
            categories
          }
          query={query}
          categorySlug={
            categorySlug
          }
          sort={sort}
        />

        {products.length ===
        0 ? (
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-20 text-center">
            <h2 className="font-semibold text-neutral-950">
              No products found
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              Try another search
              or category.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map(
              (product) => (
                <ProductCard
                  key={
                    product.id
                  }
                  product={
                    product
                  }
                />
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
}