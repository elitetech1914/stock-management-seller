// Apply only the generated media migration. Never replay or baseline commerce.
import pg from "pg";
import { inspectMediaMigration, printMediaMigrationStatus, validateMediaMigrationSql } from "./media-migration-plan.mjs";

if (!process.env.DATABASE_URL) {
  try { (await import("dotenv")).config({ quiet: true }); } catch { /* Coolify supplies runtime variables. */ }
}
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--apply")) {
  console.error("Usage: npm run db:media-migrate [-- --apply]. Without --apply this is a read-only preview.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
const apply = args.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '30s'");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL search_path = public");
  if (apply) await client.query("SELECT pg_advisory_xact_lock(hashtext('media-upload-foundation-migration'))");
  const status = await inspectMediaMigration(client);
  printMediaMigrationStatus(status);
  if (status.plan.state === "blocked" || status.plan.state === "fresh") {
    process.exitCode = 2;
    await client.query("ROLLBACK");
  } else if (status.plan.state === "ready") {
    console.log("No SQL executed: the media tables already exist.");
    await client.query("ROLLBACK");
  } else {
    const statements = validateMediaMigrationSql(status.migration.sql);
    if (!apply) {
      console.log("Preview only: creates import_batches and media_assets with their constraints/indexes. Existing commerce and authentication tables remain untouched.");
      console.log("After backup and review, apply with: npm run db:media-migrate -- --apply");
      await client.query("ROLLBACK");
    } else {
      for (const statement of statements) await client.query(statement);
      if (status.plan.recordMigration) {
        await client.query("INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)", [status.migration.hash, status.migration.when]);
      }
      await client.query("COMMIT");
      console.log("Media migration applied successfully. Reload Admin > Bulk Images.");
      if (!status.plan.recordMigration) {
        console.log("Legacy migration history was left unchanged. Audit the commerce baseline and record both applied migrations before switching to general db:migrate commands.");
      }
    }
  }
} catch (error) {
  if (client) await client.query("ROLLBACK").catch(() => {});
  // Show only a sanitized code, never a database message, URL or parameters.
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{3,30}$/.test(error.code) ? ` (${error.code})` : "";
  console.error(`Media migration failed${code}. Check database status before retrying; migration changes are made in one transaction.`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
