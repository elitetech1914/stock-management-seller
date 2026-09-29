import { getStoreCategories } from "@/lib/store-catalog";

export async function GET() {
  const categories =
    await getStoreCategories();

  return Response.json(
    categories
  );
}