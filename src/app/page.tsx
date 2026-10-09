export const dynamic = "force-dynamic";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Box,
  PackageCheck,
  RefreshCcw,
} from "lucide-react";

import { ProductCard } from "@/components/store/product-card";
import { getStoreProducts } from "@/lib/store-products";

const categories = [
  "Home & Living",
  "Kitchen",
  "Beauty",
  "Fashion",
  "Kids",
  "Pet",
  "Stationery",
  "Gifts",
];


export default async function Home() {
  const products =
    await getStoreProducts(8);
  return (
    <main className="min-h-screen bg-white text-[#151515]">
      <section className="mx-auto max-w-[1500px] px-4 sm:px-6 py-5 lg:px-8">
        <div className="grid min-h-[540px] overflow-hidden rounded-[28px] bg-[#e8e1d3] lg:grid-cols-2">
          <div className="flex flex-col justify-center px-5 py-10 sm:px-12 sm:py-14 lg:px-16">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#4d625b]">
              Wholesale for modern retailers
            </p>

            <h1 className="max-w-xl text-[clamp(2.25rem,8vw,2.875rem)] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[60px] lg:text-[70px]">
              Products worth putting on your shelves.
            </h1>

            <p className="mt-7 max-w-lg text-base leading-7 text-neutral-700 sm:text-lg">
              Discover wholesale products across home, kitchen, beauty,
              accessories and more. Built for businesses that want better
              products at better margins.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#17352c] px-6 text-sm font-semibold text-white transition hover:bg-[#24483d]"
              >
                Shop wholesale
                <ArrowRight size={17} />
              </Link>

              <Link
                href="/register"
                className="inline-flex h-12 items-center rounded-full border border-neutral-700 px-6 text-sm font-semibold transition hover:bg-white/50"
              >
                Create buyer account
              </Link>
            </div>
          </div>

          <div className="relative min-h-[280px] sm:min-h-[400px] overflow-hidden bg-[#c9d2c6]">
            <div className="absolute left-[10%] top-[16%] h-[230px] w-[190px] rotate-[-7deg] rounded-[80px_80px_32px_32px] bg-[#e8ddd2] shadow-2xl" />

            <div className="absolute right-[14%] top-[20%] h-[250px] w-[210px] rotate-[6deg] rounded-[22px] bg-[#b08c63] shadow-2xl" />

            <div className="absolute bottom-[9%] left-[29%] h-[180px] w-[240px] rounded-[120px_120px_32px_32px] bg-[#f1eee6] shadow-2xl" />

            <div className="absolute bottom-8 right-8 max-w-[210px] rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur">
              <p className="text-xs text-neutral-500">Retail margin</p>
              <p className="mt-1 text-2xl font-semibold">Up to 60%</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Competitive wholesale pricing for growing retailers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 sm:px-6 py-12 lg:px-8">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Browse
            </p>

            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
              Shop by category
            </h2>
          </div>

          <Link
            href="/products"
            className="hidden items-center gap-1 text-sm font-medium sm:flex"
          >
            View all
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((category, index) => (
            <Link
              href={`/products?category=${encodeURIComponent(category)}`}
              key={category}
              className="group"
            >
              <div
                className={`aspect-square rounded-2xl ${
                  [
                    "bg-[#e6dfd3]",
                    "bg-[#d7dfd7]",
                    "bg-[#ece3dc]",
                    "bg-[#ded9cf]",
                    "bg-[#e8ddd4]",
                    "bg-[#dbe2df]",
                    "bg-[#e3dfd8]",
                    "bg-[#d8cbbd]",
                  ][index]
                }`}
              >
                <div className="flex h-full items-center justify-center text-xs font-medium text-black/30">
                  Image
                </div>
              </div>

              <p className="mt-3 text-sm font-medium group-hover:underline">
                {category}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-[#faf9f6]">
        <div className="mx-auto grid max-w-[1500px] gap-6 px-4 sm:px-6 py-9 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <Benefit
            icon={<BadgeCheck size={22} />}
            title="Wholesale pricing"
            description="Pricing built specifically for business buyers."
          />

          <Benefit
            icon={<Box size={22} />}
            title="Low minimums"
            description="Flexible minimum quantities across the catalog."
          />

          <Benefit
            icon={<PackageCheck size={22} />}
            title="Simple ordering"
            description="Build your order online and submit it in minutes."
          />

          <Benefit
            icon={<RefreshCcw size={22} />}
            title="Easy reordering"
            description="Quickly reorder products your business already loves."
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 sm:px-6 py-14 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Curated for retailers
            </p>

            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Trending wholesale
            </h2>
          </div>

          <Link
            href="/products"
            className="hidden items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium sm:flex"
          >
            Shop all
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard product={product} key={product.id} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[28px] bg-[#17352c] px-5 py-10 sm:py-14 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Buying for your business?
            </p>

            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Create your wholesale account and start building your next order.
            </h2>
          </div>

          <Link
            href="/register"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#17352c] lg:mt-0"
          >
            Create an account
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 sm:px-6 py-10 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <p className="text-xl font-semibold tracking-[-0.04em] text-black">
              Stockmora
            </p>
            <p className="mt-1">Wholesale made simple.</p>
          </div>

          <p>© 2026 Stockmora. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

function Benefit({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-5 text-neutral-500">
          {description}
        </p>
      </div>
    </div>
  );
}