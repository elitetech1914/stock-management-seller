import { Header } from "@/components/site/header";
import { SavedProductsPage } from "@/components/store/saved-products-page";

export default function SavedPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />

      <SavedProductsPage />
    </main>
  );
}