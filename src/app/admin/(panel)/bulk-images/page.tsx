import { BulkImages } from "@/components/admin/bulk-images";

export default function BulkImagesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 2xl:p-10">
      <p className="text-sm font-medium text-neutral-500">Catalog</p>
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl tracking-[-0.05em]">Bulk images</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
        Organize supplier images in separate import batches. Original filenames are preserved,
        and each image is optimized for your catalog.
      </p>
      <BulkImages />
    </div>
  );
}
