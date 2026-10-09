import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const categoryList = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.name));

  return (
    <div className="p-4 sm:p-6 lg:p-8 2xl:p-10">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-black"
      >
        <ArrowLeft size={16} />
        Back to products
      </Link>

      <div className="mt-6">
        <p className="text-sm font-medium text-neutral-500">
          Catalog
        </p>

        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl tracking-[-0.05em]">
          Add product
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Create a new wholesale product.
        </p>
      </div>

      <form
        action={createProduct}
        className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold">
              Product information
            </h2>

            <div className="mt-6 space-y-5">
              <Field
                label="Product title"
                name="title"
                placeholder="Textured Ceramic Vase"
                required
              />

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium"
                >
                  Description
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={7}
                  placeholder="Describe the product..."
                  className="w-full resize-none rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-[#17352c]"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="SKU"
                  name="sku"
                  placeholder="VASE-001"
                  required
                />

                <Field
                  label="Brand"
                  name="brand"
                  placeholder="Stockmora"
                />
              </div>

              <div>
                <label
                  htmlFor="categoryId"
                  className="mb-2 block text-sm font-medium"
                >
                  Category
                </label>

                <select
                  id="categoryId"
                  name="categoryId"
                  className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#17352c]"
                >
                  <option value="">
                    No category
                  </option>

                  {categoryList.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold">
              Pricing
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Cost is used internally to calculate
              your profit.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <Field
                label="Cost price"
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="8.50"
              />

              <Field
                label="Wholesale price"
                name="wholesalePrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="12.50"
              />

              <Field
                label="MSRP"
                name="retailPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="29.99"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold">
              Images
            </h2>

            <p className="mt-1 text-sm leading-6 text-neutral-500">
              Enter one image URL per line. We will
              add direct file uploads to Cloudflare
              R2 later.
            </p>

            <textarea
              name="imageUrls"
              rows={6}
              placeholder={`https://example.com/image-1.jpg\nhttps://example.com/image-2.jpg`}
              className="mt-5 w-full resize-none rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-[#17352c]"
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold">
              Inventory
            </h2>

            <div className="mt-6 space-y-5">
              <Field
                label="Stock quantity"
                name="stockQuantity"
                type="number"
                min="0"
                defaultValue="0"
              />

              <Field
                label="Minimum order quantity"
                name="minimumOrderQuantity"
                type="number"
                min="1"
                defaultValue="1"
              />

              <Field
                label="Case quantity"
                name="caseQuantity"
                type="number"
                min="1"
                defaultValue="1"
              />
            </div>
          </section>

          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-[#17352c] text-sm font-semibold text-white transition hover:bg-[#24483d]"
          >
            Create product
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  step,
  min,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium"
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        step={step}
        min={min}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none transition focus:border-[#17352c]"
      />
    </div>
  );
}