"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { slugify } from "@/lib/slugify";

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Category name is required.");
  }

  const slug = slugify(name);

  await db.insert(categories).values({
    name,
    slug,
  });

  revalidatePath("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) return;

  await db.delete(categories).where(eq(categories.id, id));

  revalidatePath("/admin/categories");
}