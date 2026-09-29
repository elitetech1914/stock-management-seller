import "dotenv/config";

import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required."
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",

  out: "./drizzle",

  dialect: "postgresql",

  dbCredentials: {
    url: process.env.DATABASE_URL,
  },

  /*
   * Only Stockmora application tables
   * are managed by Drizzle.
   *
   * Better Auth's user/session/account
   * tables remain managed separately.
   */
  tablesFilter: [
    "categories",
    "products",
    "product_images",
    "product_variants",
    "orders",
    "order_items",
  ],

  verbose: true,

  strict: true,
});