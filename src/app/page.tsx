export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PackageCheck } from "lucide-react";
import { HeroGraphic } from "@/components/store/hero-graphic";
import { ProductCard } from "@/components/store/product-card";
import { getStoreProducts } from "@/lib/store-products";
import { siteConfig } from "@/config/site";

export default async function Home() {
  const products = await getStoreProducts(8);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-3xl bg-[#e9efe5] lg:min-h-[440px] lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col justify-center px-5 py-8 sm:px-10 sm:py-12 lg:px-14">
            <p className="ui-eyebrow mb-4">Wholesale for independent retailers</p>
            <h1 className="max-w-xl text-[2.125rem] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-6xl">Products worth putting on your shelves.</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-muted">Discover products for your business, compare wholesale prices, and build your next order.</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/products" className="ui-button">Shop wholesale<ArrowRight size={18} /></Link>
              <Link href="/register" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4">Create buyer account</Link>
            </div>
          </div>
          <HeroGraphic />
        </div>
      </section>
      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="ui-eyebrow">Fresh additions</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">New wholesale products</h2></div><Link href="/products" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand">Shop all<ArrowRight size={16} /></Link></div>
        {products.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <div className="ui-panel px-6 py-12 text-center"><PackageCheck className="mx-auto text-muted" size={32} /><h3 className="mt-4 font-semibold">New products are on the way</h3><p className="mt-2 text-sm text-muted">Create a buyer account to get ready for your next order.</p><Link href="/register" className="ui-button mt-5">Create an account</Link></div>}
      </section>
      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-brand px-6 py-8 text-white sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-8"><div><p className="text-xs font-medium uppercase tracking-widest text-white/80">Buying for your business?</p><h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Your next wholesale order starts here.</h2><p className="mt-3 text-sm leading-6 text-white/80">Save products, manage orders, and shop with your buyer account.</p></div><Link href="/register" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand lg:mt-0 lg:shrink-0">Create an account<ArrowRight size={17} /></Link></div>
      </section>
      <footer className="mt-6 border-t border-border bg-white"><div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div><Link href="/" className="inline-flex min-h-11 items-center rounded-sm"><Image src="/Apex-logo.png" alt={siteConfig.name} width={10279} height={2742} sizes="160px" className="h-auto w-40 max-w-full object-contain" /></Link><p className="mt-1">{siteConfig.tagline}</p></div><p>&copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p></div></footer>
    </main>
  );
}
