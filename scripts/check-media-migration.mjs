// Read-only deployment gate. Never applies SQL or changes migration history.
import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

dotenv.config({ quiet: true });
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Use a dedicated development database for local tests.");
  process.exit(1);
}
const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
const hashes = journal.entries.map((entry) => ({
  ...entry,
  hash: createHash("sha256").update(readFileSync(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url))).digest("hex"),
}));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '5s'");
  const names = ["categories", "products", "product_images", "product_variants", "orders", "order_items", "import_batches", "media_assets"];
  const { rows: tables } = await client.query("SELECT name, to_regclass('public.' || name) IS NOT NULL AS present FROM unnest($1::text[]) AS name", [names]);
  const commerceCount = tables.slice(0, 6).filter((table) => table.present).length;
  const mediaCount = tables.slice(6).filter((table) => table.present).length;
  const { rows: [journalTable] } = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present");
  const records = journalTable.present ? (await client.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows : [];
  const recorded = (migration) => records.some((record) => record.hash === migration.hash && String(record.created_at) === String(migration.when));
  if (commerceCount === 0 && mediaCount === 0 && records.length === 0) {
    console.log("Fresh database: npm run db:migrate will create the commerce and media tables. Better Auth remains separate.");
  } else if (commerceCount === 6 && mediaCount === 2 && recorded(hashes[0]) && recorded(hashes[1])) {
    console.log("Media migration is recorded and both media tables exist.");
  } else if (commerceCount === 6 && mediaCount === 0 && recorded(hashes[0]) && records.length === 1) {
    console.log("Initial migration is recorded; the media migration is pending. After backup and review, run npm run db:migrate.");
  } else {
    console.error("STOP: database tables and migration history do not match the expected baseline. Review docs/product-media.md before migrating. No changes were made.");
    process.exitCode = 2;
  }
  await client.query("ROLLBACK");
} catch {
  console.error("Migration status could not be read. Check database access/configuration. No changes were made.");
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
