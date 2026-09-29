import { notFound } from "next/navigation";

import { Header } from "@/components/site/header";
import { ProductDetail } from "@/components/store/product-detail";

import { getStoreProductBySlug } from "@/lib/store-product-detail";

export default async function ProductPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;

  const product =
    await getStoreProductBySlug(
      slug
    );

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <Header />

     <section className="mx-auto max-w-[1400px] px-5 py-6 lg:px-8 lg:py-8">
        <ProductDetail
          product={product}
        />
      </section>
    </main>
  );
}