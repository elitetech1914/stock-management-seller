import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { db } from "@/db";

import {
  categories,
  productImages,
  products,
  productVariants,
} from "@/db/schema";

import { updateProduct } from "../../actions";

function centsToMoney(cents: number) {
  return (cents / 100).toFixed(2);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  /*
   * Fetch existing product.
   */
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    notFound();
  }

  /*
   * Load categories for the dropdown.
   */
  const categoryList = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.name));

  /*
   * Load existing product images.
   */
  const images = await db
    .select()
    .from(productImages)
    .where(
      eq(
        productImages.productId,
        product.id
      )
    )
    .orderBy(productImages.position);

  /*
   * Load variants if this is an imported
   * Shopify-style product.
   */
  const variants = await db
    .select()
    .from(productVariants)
    .where(
      eq(
        productVariants.productId,
        product.id
      )
    )
    .orderBy(productVariants.createdAt);

  /*
   * Bind this product ID to the server
   * action so it knows which row to update.
   */
  const updateAction =
    updateProduct.bind(
      null,
      product.id
    );

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
          Edit product
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Editing{" "}
          <span className="font-medium text-neutral-800">
            {product.title}
          </span>
        </p>
      </div>

      <form
        action={updateAction}
        className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* PRODUCT INFO */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold">
              Product information
            </h2>

            <div className="mt-6 space-y-5">
              <Field
                label="Product title"
                name="title"
                defaultValue={
                  product.title
                }
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
                  defaultValue={
                    product.description ??
                    ""
                  }
                  className="w-full resize-none rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-[#17352c]"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="SKU"
                  name="sku"
                  defaultValue={
                    product.sku
                  }
                  required
                />

                <Field
                  label="Brand"
                  name="brand"
                  defaultValue={
                    product.brand ?? ""
                  }
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
                  defaultValue={
                    product.categoryId ??
                    ""
                  }
                  className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-[#17352c]"
                >
                  <option value="">
                    No category
                  </option>

                  {categoryList.map(
                    (category) => (
                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {
                          category.name
                        }
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </section>

          {/* PRICING */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold">
              Pricing
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              These values represent the
              parent/default product pricing.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <Field
                label="Cost price"
                name="costPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={centsToMoney(
                  product.costPriceCents
                )}
              />

              <Field
                label="Wholesale price"
                name="wholesalePrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={centsToMoney(
                  product.wholesalePriceCents
                )}
              />

              <Field
                label="MSRP"
                name="retailPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={centsToMoney(
                  product.retailPriceCents
                )}
              />
            </div>
          </section>

          {/* IMAGES */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold">
              Product images
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              One image URL per line.
            </p>

            <textarea
              name="imageUrls"
              rows={6}
              defaultValue={images
                .map(
                  (image) =>
                    image.url
                )
                .join("\n")}
              className="mt-5 w-full resize-none rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-[#17352c]"
            />
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* INVENTORY */}
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
                defaultValue={String(
                  product.stockQuantity
                )}
              />

              <Field
                label="Minimum order quantity"
                name="minimumOrderQuantity"
                type="number"
                min="1"
                defaultValue={String(
                  product.minimumOrderQuantity
                )}
              />

              <Field
                label="Case quantity"
                name="caseQuantity"
                type="number"
                min="1"
                defaultValue={String(
                  product.caseQuantity
                )}
              />
            </div>

            {variants.length > 0 && (
              <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                This product has{" "}
                <strong>
                  {
                    variants.length
                  }{" "}
                  variants
                </strong>
                . Parent stock is currently
                calculated from imported
                variant inventory.
              </p>
            )}
          </section>

          {/* STATUS */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold">
              Status
            </h2>

            <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={
                  product.isActive
                }
                className="h-4 w-4"
              />

              Active product
            </label>

            <p className="mt-2 text-xs leading-5 text-neutral-500">
              Inactive products remain in
              the database but can be hidden
              from buyers.
            </p>
          </section>

          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-[#17352c] text-sm font-semibold text-white transition hover:bg-[#24483d]"
          >
            Save changes
          </button>
        </div>
      </form>

      {/* VARIANTS */}
      {variants.length > 0 && (
        <section className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h2 className="font-semibold">
              Product variants
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              {variants.length} variants
              imported for this product.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-6 py-4 font-medium">
                    SKU
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Options
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Wholesale
                  </th>

                  <th className="px-6 py-4 font-medium">
                    MSRP
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Stock
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {variants.map(
                  (variant) => {
                    const options = [
                      variant.option1Name &&
                      variant.option1Value
                        ? `${variant.option1Name}: ${variant.option1Value}`
                        : null,

                      variant.option2Name &&
                      variant.option2Value
                        ? `${variant.option2Name}: ${variant.option2Value}`
                        : null,

                      variant.option3Name &&
                      variant.option3Value
                        ? `${variant.option3Name}: ${variant.option3Value}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" / ");

                    return (
                      <tr
                        key={
                          variant.id
                        }
                      >
                        <td className="px-6 py-4 font-medium">
                          {
                            variant.sku
                          }
                        </td>

                        <td className="px-6 py-4 text-neutral-600">
                          {options ||
                            "Default"}
                        </td>

                        <td className="px-6 py-4">
                          {formatMoney(
                            variant.wholesalePriceCents
                          )}
                        </td>

                        <td className="px-6 py-4 text-neutral-600">
                          {formatMoney(
                            variant.retailPriceCents
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {
                            variant.stockQuantity
                          }
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  step,
  min,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
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
        required={required}
        step={step}
        min={min}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-sm outline-none transition focus:border-[#17352c]"
      />
    </div>
  );
}