import { asc } from "drizzle-orm";
import {
  FolderTree,
  Plus,
  Trash2,
} from "lucide-react";

import { db } from "@/db";
import { categories } from "@/db/schema";
import {
  createCategory,
  deleteCategory,
} from "./actions";

export default async function CategoriesPage() {
  const categoryList = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.name));

  return (
    <div className="p-4 sm:p-6 lg:p-8 2xl:p-10">
      {/* HEADER */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Catalog
          </p>

          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl tracking-[-0.05em]">
            Categories
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            Organize products into storefront categories.
          </p>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="mt-10 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT — ALL CATEGORIES */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                <FolderTree size={19} />
              </div>

              <div>
                <h2 className="font-semibold text-neutral-950">
                  All categories
                </h2>

                <p className="text-sm text-neutral-500">
                  {categoryList.length}{" "}
                  {categoryList.length === 1
                    ? "category"
                    : "categories"}
                </p>
              </div>
            </div>
          </div>

          {categoryList.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-neutral-500">
              No categories yet.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {categoryList.map(
                (category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-950">
                        {category.name}
                      </p>

                      <p className="mt-1 truncate text-xs text-neutral-400">
                        /{category.slug}
                      </p>
                    </div>

                    <form
                      action={
                        deleteCategory
                      }
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={
                          category.id
                        }
                      />

                      <button
                        type="submit"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Delete ${category.name}`}
                      >
                        <Trash2
                          size={17}
                        />
                      </button>
                    </form>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* RIGHT — ADD CATEGORY */}
        <section className="self-start rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ef] text-[#17352c]">
              <Plus size={19} />
            </div>

            <div>
              <h2 className="font-semibold text-neutral-950">
                Add category
              </h2>

              <p className="text-sm text-neutral-500">
                Create a new catalog category.
              </p>
            </div>
          </div>

          <form
            action={createCategory}
            className="mt-6 space-y-4"
          >
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-neutral-800"
              >
                Category name
              </label>

              <input
                id="name"
                name="name"
                required
                placeholder="Home & Living"
                className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none transition focus:border-[#17352c]"
              />
            </div>

            <button
              type="submit"
              className="h-11 w-full rounded-xl bg-[#17352c] text-sm font-semibold text-white transition hover:bg-[#24483d]"
            >
              Add category
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}