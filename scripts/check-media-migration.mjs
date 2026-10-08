// Read-only deployment gate. Never applies SQL or changes migration history.
import pg from "pg";
import { inspectMediaMigration, printMediaMigrationStatus } from "./media-migration-plan.mjs";

// Coolify provides DATABASE_URL at runtime. dotenv is optional so this command
// also works in images that install only production dependencies.
if (!process.env.DATABASE_URL) {
  try { (await import("dotenv")).config({ quiet: true }); } catch { /* Use runtime environment. */ }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Use a dedicated development database for local tests.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '5s'");
  const status = await inspectMediaMigration(client);
  printMediaMigrationStatus(status);
  if (status.plan.state === "blocked") process.exitCode = 2;
} catch {
  console.error("Migration status could not be read. Check database access/configuration. No changes were made.");
  process.exitCode = 1;
} finally {
  if (client) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
  await pool.end();
}
