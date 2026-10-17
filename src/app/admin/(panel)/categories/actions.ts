"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { slugify } from "@/lib/slugify";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.role !== "admin") throw new Error("Unauthorized");
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
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
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  if (!id) return;

  await db.delete(categories).where(eq(categories.id, id));

  revalidatePath("/admin/categories");
}