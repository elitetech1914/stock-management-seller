import {
  notFound,
} from "next/navigation";

import { ProductCard } from "@/components/store/product-card";
import {
  getStoreCatalogProducts,
  getStoreCategoryBySlug,
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

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    sort?: string;
  }>;
}) {
  const { slug } =
    await params;

  const query =
    await searchParams;

  const sort =
    normalizeSort(
      query.sort
    );

  const [
    category,
    products,
  ] = await Promise.all([
    getStoreCategoryBySlug(
      slug
    ),

    getStoreCatalogProducts({
      categorySlug: slug,
      sort,
    }),
  ]);

  if (!category) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-[1500px] px-4 sm:px-6 py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-5 border-b border-neutral-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              Category
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-neutral-950">
              {category.name}
            </h1>

            <p className="mt-2 text-sm text-neutral-500">
              {products.length}{" "}
              {products.length === 1
                ? "product"
                : "products"}
            </p>
          </div>

          <form method="GET" className="flex min-w-0 items-center gap-2">
            <select
              name="sort"
              defaultValue={sort}
              onChange={undefined}
              className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none"
            >
              <option value="newest">
                Newest
              </option>

              <option value="name">
                Name A–Z
              </option>

              <option value="price-asc">
                Price: Low to High
              </option>

              <option value="price-desc">
                Price: High to Low
              </option>
            </select>

            <button
              type="submit"
              className="h-11 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm font-medium transition hover:bg-neutral-100"
            >
              Sort
            </button>
          </form>
        </div>

        {products.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-20 text-center">
            <h2 className="font-semibold text-neutral-950">
              No products in this
              category yet
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              Products assigned to{" "}
              {category.name} will
              appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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