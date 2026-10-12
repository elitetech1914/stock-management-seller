import {
  CheckCircle2,
  Info,
} from "lucide-react";
import Link from "next/link";

import { ImportProductsForm } from "@/components/admin/import-products-form";

export default function ImportProductsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 2xl:p-10">
      <div>
        <p className="text-sm font-medium text-neutral-500">
          Catalog
        </p>

        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl tracking-[-0.05em]">
          Import products
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Create or update products in bulk
          using a CSV file. Products are
          matched using their SKU.
        </p>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ImportProductsForm />

        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <Info
                size={19}
                className="text-[#17352c]"
              />

              <h2 className="font-semibold">
                CSV columns
              </h2>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <Column
                name="sku"
                required
              />

              <Column
                name="title"
                required
              />

              <Column name="description" />
              <Column name="category" />
              <Column name="brand" />
              <Column name="cost_price" />
              <Column name="wholesale_price" />
              <Column name="retail_price" />
              <Column name="stock" />
              <Column name="moq" />
              <Column name="case_quantity" />
              <Column name="product_image_url" />
              <Column name="image_position" />
              <Column name="image_alt_text" />
              <Column name="variant_image_url" />
              <Column name="image_1" />
              <Column name="image_2" />
              <Column name="image_3" />
              <Column name="image_4" />
              <Column name="image_5" />
              <Column name="active" />
            </div>
            <p className="mt-5 text-xs leading-5 text-muted">image_1–image_5 contain exact uploaded filenames, including extensions, from the selected image batch. product_image_url also accepts image_src or image_url. Shopify’s Image Src is supported.</p>
            <p className="mt-3 text-xs leading-5 text-muted">sku accepts product_sku, variant_sku or item_sku. title accepts name, product_name or product_title. Every product needs a title and at least one SKU.</p>
            <a href="/product-images-example.csv" download className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand underline underline-offset-4">Download example CSV</a>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2
                size={19}
                className="text-[#17352c]"
              />

              <h2 className="font-semibold">
                Import behavior
              </h2>
            </div>

            <div className="mt-5 space-y-3 text-sm leading-6 text-neutral-600">
              <p>
                <strong>New SKU:</strong>{" "}
                creates a new product.
              </p>

              <p>
                <strong>
                  Existing SKU:
                </strong>{" "}
                updates the existing product.
              </p>

              <p>
                <strong>
                  New category:
                </strong>{" "}
                automatically creates the
                category.
              </p>

              <p>
                <strong>Images:</strong>{" "}
                filenames in image_1–image_5 are matched exactly within your selected batch. URLs still work through product_image_url and variant_image_url.
              </p>
              <p><strong>Check first:</strong> missing images or invalid product identities block the import before anything changes. Changing the file or batch requires a new check.</p>
              <p><strong>Gallery order:</strong> numbered images come first, followed by URL images. Blank image fields keep existing product images.</p>
              <Link href="/admin/bulk-images" className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4">Open Bulk Images</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Column({
  name,
  required = false,
}: {
  name: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <code className="rounded bg-neutral-100 px-2 py-1 text-xs">
        {name}
      </code>

      <span
        className={`text-xs ${
          required
            ? "font-medium text-red-600"
            : "text-neutral-500"
        }`}
      >
        {required
          ? "Required"
          : "Optional"}
      </span>
    </div>
  );
}
